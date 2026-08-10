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

// Same fromFirestoreValue/fromFirestoreFields convention as
// extension/lib/firestore.js — duplicated here for the same cross-package
// reason toFirestoreValue/toFirestoreFields above are duplicated (this app
// and extension/ are separate packages with independent module resolution).
// Parses Firestore REST's typed `{fields: {key: {stringValue: "..."}}}`
// shape back into a plain JS object/array/primitive tree.
function fromFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return parseInt(String(v.integerValue), 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) {
    const arr = (v.arrayValue as { values?: unknown[] } | undefined)?.values || [];
    return arr.map(fromFirestoreValue);
  }
  if ("mapValue" in v) {
    const fields = (v.mapValue as { fields?: Record<string, unknown> } | undefined)?.fields || {};
    return fromFirestoreFields(fields);
  }
  return null;
}

function fromFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(fields)) {
    obj[key] = fromFirestoreValue(val);
  }
  return obj;
}

// Firestore's REST API returns each document's full resource name, e.g.
// "projects/p/databases/(default)/documents/users/u/applications/AbC123".
// We only ever want the last segment as the usable document ID — same as
// idFromDocName in extension/lib/firestore.js.
function idFromDocName(name: string): string {
  return name.split("/").pop() as string;
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

// Generic "get a user's top-level doc, parsed back into plain JS" helper —
// used by gmail-sync.ts to read users/{uid}.gmail (the refresh token,
// processedMessageIds, pendingReview, etc.) via the admin/service-account
// path, since that data was deliberately written where a user's own idToken
// cannot read it (see this file's header comment). Returns null on 404
// (doc doesn't exist yet) rather than throwing, mirroring getUserDoc's
// not-found handling in extension/lib/firestore.js.
export async function adminGetUserDoc(
  uid: string
): Promise<Record<string, unknown> | null> {
  const res = await adminFirestoreFetch(`users/${uid}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Firestore GET users/${uid} failed: ${res.status} ${await res.text()}`
    );
  }
  const doc = (await res.json()) as { fields?: Record<string, unknown> };
  return fromFirestoreFields(doc.fields || {});
}

// Convenience wrapper over adminGetUserDoc for the one field gmail-sync.ts
// actually needs to read (the Gmail connection sub-object) — kept as a thin
// helper rather than a second parsing path, per the task's own suggestion of
// "add one (or a generic admin get user doc helper)".
export async function adminGetUserGmailConnection(
  uid: string
): Promise<Record<string, unknown> | null> {
  const userDoc = await adminGetUserDoc(uid);
  const gmail = userDoc?.gmail;
  return gmail && typeof gmail === "object" ? (gmail as Record<string, unknown>) : null;
}

// Generic partial-update helper for users/{uid}, keyed by dotted field paths
// (e.g. "gmail.status", "gmail.processedMessageIds") exactly like
// adminSetUserGmailConnection's updateMask.fieldPaths construction above,
// but reusable for any field set instead of only the gmail-connection ones.
// Builds the nested `fields` body Firestore expects from the dotted paths.
export async function adminPatchUserFields(
  uid: string,
  fields: Record<string, unknown>
): Promise<void> {
  const fieldPaths = Object.keys(fields)
    .map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
    .join("&");

  const nested: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(fields)) {
    const parts = path.split(".");
    let cursor = nested;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      if (typeof cursor[key] !== "object" || cursor[key] === null) {
        cursor[key] = {};
      }
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }

  const res = await adminFirestoreFetch(`users/${uid}?${fieldPaths}`, {
    method: "PATCH",
    body: JSON.stringify({ fields: toFirestoreFields(nested) }),
  });

  if (!res.ok) {
    throw new Error(
      `Firestore PATCH users/${uid} (fields ${Object.keys(fields).join(", ")}) failed: ${res.status} ${await res.text()}`
    );
  }
}

export interface AdminApplicationRecord {
  id: string;
  [key: string]: unknown;
}

// Lists users/{uid}/applications via the admin path — used by gmail-sync.ts
// to match incoming email classifications against existing applications.
// Note: Firestore's default list page size caps at 300 docs; this task
// doesn't paginate (mirrors the deliberate no-pageToken simplification used
// for Gmail's messages.list in gmail-sync.ts) since a first version's
// per-user application count is expected to be small.
export async function adminListApplications(
  uid: string
): Promise<AdminApplicationRecord[]> {
  const res = await adminFirestoreFetch(`users/${uid}/applications`);
  if (!res.ok) {
    throw new Error(
      `Firestore GET users/${uid}/applications failed: ${res.status} ${await res.text()}`
    );
  }
  const doc = (await res.json()) as {
    documents?: Array<{ name: string; fields?: Record<string, unknown> }>;
  };
  return (doc.documents || []).map((d) => ({
    id: idFromDocName(d.name),
    ...fromFirestoreFields(d.fields || {}),
  }));
}

// Creates a new application doc, mirroring addApplication's shape in
// extension/lib/firestore.js but authorized via the service account.
export async function adminCreateApplication(
  uid: string,
  application: Record<string, unknown>
): Promise<AdminApplicationRecord> {
  const res = await adminFirestoreFetch(`users/${uid}/applications`, {
    method: "POST",
    body: JSON.stringify({ fields: toFirestoreFields(application) }),
  });
  if (!res.ok) {
    throw new Error(
      `Firestore POST users/${uid}/applications failed: ${res.status} ${await res.text()}`
    );
  }
  const doc = (await res.json()) as { name: string };
  return { id: idFromDocName(doc.name), ...application };
}

// Partial-updates an existing application doc, mirroring updateApplication's
// PATCH + updateMask.fieldPaths shape in extension/lib/firestore.js.
export async function adminUpdateApplication(
  uid: string,
  applicationId: string,
  patch: Record<string, unknown>
): Promise<void> {
  const fieldPaths = Object.keys(patch)
    .map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
    .join("&");

  const res = await adminFirestoreFetch(
    `users/${uid}/applications/${applicationId}?${fieldPaths}`,
    {
      method: "PATCH",
      body: JSON.stringify({ fields: toFirestoreFields(patch) }),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Firestore PATCH users/${uid}/applications/${applicationId} failed: ${res.status} ${await res.text()}`
    );
  }
}

// Admin equivalent of addTimelineEvent in extension/lib/firestore.js — same
// subcollection shape (users/{uid}/applications/{applicationId}/timeline),
// but authorized via the service account instead of a user idToken, since
// gmail-sync.ts's writes must work with no live user session (Phase 4 batch
// job) as well as from this task's route handler.
export async function adminAddTimelineEvent(
  uid: string,
  applicationId: string,
  event: Record<string, unknown>
): Promise<{ id: string } & Record<string, unknown>> {
  const res = await adminFirestoreFetch(
    `users/${uid}/applications/${applicationId}/timeline`,
    {
      method: "POST",
      body: JSON.stringify({ fields: toFirestoreFields(event) }),
    }
  );
  if (!res.ok) {
    throw new Error(
      `Firestore POST users/${uid}/applications/${applicationId}/timeline failed: ${res.status} ${await res.text()}`
    );
  }
  const doc = (await res.json()) as { name: string };
  return { id: idFromDocName(doc.name), ...event };
}
