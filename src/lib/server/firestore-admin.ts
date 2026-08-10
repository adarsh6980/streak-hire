// Server-only, service-account-authenticated access to Firestore.
//
// This intentionally does NOT use firebase-admin or google-auth-library —
// per this project's convention (see extension/lib/firestore.js and
// extension/lib/auth.js), every Google/Firebase interaction is a hand-built
// `fetch` call. Here we hand-roll the Google service-account JWT-bearer OAuth
// flow (RFC 7523 / "Using OAuth 2.0 for Server to Server Applications") using
// only Node's built-in `crypto`, then use the resulting access token to call
// the Firestore REST API directly — mirroring the request/body shape already
// used client-side in extension/lib/firestore.js (toFirestoreFields, the
// `${BASE}${path}${query}` URL construction, PATCH + updateMask.fieldPaths
// for partial writes).
//
// IMPORTANT: This path uses Google Cloud IAM (service-account) authentication,
// which is a completely separate authorization mechanism from Firebase Auth
// ID tokens. Firestore Security Rules (see extension/firestore.rules) only
// apply to requests authenticated with a Firebase Auth ID token; they do NOT
// apply to requests authenticated as a service account via IAM. That is
// exactly why secrets like a Gmail OAuth refresh token must be written via
// this module rather than via a user's own idToken through the client-style
// firestoreFetch in extension/lib/firestore.js — a client-side call, even a
// legitimate one made by our own frontend, would be bound by the security
// rules (which allow a user to read their own `users/{uid}` doc), and so
// would make the refresh token readable by client-side code. This module's
// requests are authorized independently of those rules.

import { createSign } from "crypto";

// Same Firebase project as extension/lib/firebase-config.js's FIREBASE_CONFIG.projectId.
// The extension hardcodes this value (it's not sourced from a shared config file across
// packages), so we mirror that same choice here rather than inventing a shared-config import.
const FIRESTORE_PROJECT_ID = "streakhire-d91b6";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
}

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0; // epoch ms

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getServiceAccount(): ServiceAccountKey {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY env var is not set (expected the service account key JSON as a string)"
    );
  }
  let parsed: ServiceAccountKey;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY JSON is missing client_email or private_key"
    );
  }
  return parsed;
}

// Builds and signs a Google service-account JWT (RFC 7523 JWT-bearer assertion),
// self-contained via Node's `crypto` module — no jsonwebtoken / google-auth-library.
function buildSignedJwt(serviceAccount: ServiceAccountKey): string {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope: DATASTORE_SCOPE,
    aud: TOKEN_URL,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaims = base64url(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key);

  return `${signingInput}.${base64url(signature)}`;
}

// Exchanges the signed JWT for a Google OAuth access token scoped to Firestore
// (`datastore`), caching it in-memory for the lifetime of this server process
// (a simple module-level variable is sufficient for a single free-tier instance —
// no distributed cache needed).
async function getAccessToken(): Promise<string> {
  const now = Date.now();
  // Refresh a little early (60s) to avoid racing against expiry mid-request.
  if (cachedAccessToken && now < cachedAccessTokenExpiresAt - 60_000) {
    return cachedAccessToken;
  }

  const serviceAccount = getServiceAccount();
  const jwt = buildSignedJwt(serviceAccount);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(
      `Failed to obtain service-account access token: ${res.status} ${await res.text()}`
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = data.access_token;
  cachedAccessTokenExpiresAt = now + Number(data.expires_in) * 1000;
  return cachedAccessToken;
}

// Same typed-value convention as toFirestoreFields in extension/lib/firestore.js —
// duplicated here (rather than imported) because this app and extension/ are
// separate packages with independent module resolution; this is the same
// small, self-contained helper, not a second convention.
function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: toFirestoreFields(value as Record<string, unknown>) } };
  }
  throw new Error(`Unsupported Firestore value type: ${typeof value}`);
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    fields[key] = toFirestoreValue(val);
  }
  return fields;
}

// Mirrors the `${BASE}${path}${query}` URL construction used by firestoreFetch
// in extension/lib/firestore.js, but authorizes with the service-account access
// token instead of a user's Firebase idToken.
export async function adminFirestoreFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${FIRESTORE_BASE}/${path.replace(/^\//, "")}`, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export interface GmailConnection {
  refreshToken: string;
  connectedAt: string;
  status: string;
}

// Writes users/{uid}.gmail via a PATCH with updateMask.fieldPaths, matching the
// partial-update convention used by setUserDoc/updateApplication in
// extension/lib/firestore.js. This must go through adminFirestoreFetch (the
// service-account path) — never through a user's own idToken — since the
// refresh token must never be exposed to a client-side Firestore REST call.
export async function adminSetUserGmailConnection(
  uid: string,
  data: GmailConnection
): Promise<void> {
  const fieldPaths = [
    "gmail.refreshToken",
    "gmail.connectedAt",
    "gmail.status",
  ]
    .map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
    .join("&");

  const res = await adminFirestoreFetch(`users/${uid}?${fieldPaths}`, {
    method: "PATCH",
    body: JSON.stringify({
      fields: toFirestoreFields({
        gmail: {
          refreshToken: data.refreshToken,
          connectedAt: data.connectedAt,
          status: data.status,
        },
      }),
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Firestore PATCH users/${uid} (gmail connection) failed: ${res.status} ${await res.text()}`
    );
  }
}
