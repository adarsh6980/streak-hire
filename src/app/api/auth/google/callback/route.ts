import { NextRequest, NextResponse } from "next/server";
import { adminSetUserGmailConnection } from "@/lib/server/firestore-admin";

// Same Firebase project config as extension/lib/firebase-config.js's
// FIREBASE_CONFIG. The apiKey is a public identifier (safe to be public per
// that file's own comment — Firestore/Firebase security comes from rules /
// IAM, not from hiding this value), so we mirror the extension's choice to
// hardcode it rather than invent a new env var the task doesn't call for.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBoB2VaFnf0aA3p3Hz3UYzzraoLLUdTUJE",
  projectId: "streakhire-d91b6",
};

const IDENTITY_BASE = "https://identitytoolkit.googleapis.com/v1";

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface SignInWithIdpResponse {
  localId: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  email?: string;
  displayName?: string;
  photoUrl?: string;
  error?: { message: string };
}

function getRedirectUri(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}

// Ports the REST-call shape of signInWithIdp from extension/lib/auth.js to
// fetch on the server — same endpoint, same body shape. requestUri is the
// redirect URI used earlier in the flow (mirrors chrome.identity.getRedirectURL()
// in the extension version, which is that context's equivalent redirect target).
async function signInWithIdp(
  googleAccessToken: string,
  requestUri: string
): Promise<SignInWithIdpResponse> {
  const res = await fetch(
    `${IDENTITY_BASE}/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${googleAccessToken}&providerId=google.com`,
        requestUri,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );
  const data = (await res.json()) as SignInWithIdpResponse;
  if (!res.ok) {
    throw new Error(
      `Firebase sign-in failed: ${res.status} ${data.error?.message ?? JSON.stringify(data)}`
    );
  }
  return data;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const storedState = request.cookies.get("google_oauth_state")?.value;

  // CSRF protection: the state we handed back to Google in the authorize
  // request must come back unchanged. Do not skip this check.
  if (!state || !storedState || state !== storedState) {
    return NextResponse.json(
      { error: "Invalid or missing OAuth state (possible CSRF)" },
      { status: 400 }
    );
  }

  if (oauthError || !code) {
    return NextResponse.json(
      { error: `Google OAuth error: ${oauthError ?? "missing code"}` },
      { status: 400 }
    );
  }

  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!clientId || !clientSecret || !siteUrl) {
    return NextResponse.json(
      {
        error:
          "Server is missing GOOGLE_WEB_CLIENT_ID, GOOGLE_CLIENT_SECRET, or NEXT_PUBLIC_SITE_URL",
      },
      { status: 500 }
    );
  }

  const redirectUri = getRedirectUri(siteUrl);

  // Exchange the authorization code for Google tokens (access_token +
  // refresh_token). This step doesn't exist in the extension's implicit
  // flow at all — chrome.identity.launchWebAuthFlow got an access token
  // directly with no code/secret exchange.
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok) {
    return NextResponse.json(
      {
        error: `Google token exchange failed: ${tokenData.error ?? tokenRes.status} ${tokenData.error_description ?? ""}`,
      },
      { status: 502 }
    );
  }

  if (!tokenData.refresh_token) {
    // With access_type=offline and prompt=consent this should always be
    // present. The one case it isn't is when Google decides not to re-issue
    // one (rare, but possible for edge cases outside our control) — the fix
    // is for the user to revoke this app's access at myaccount.google.com
    // and retry, which forces a fresh consent + refresh token.
    return NextResponse.json(
      {
        error:
          "Google did not return a refresh token. Please revoke Streakhire's access at https://myaccount.google.com/permissions and try connecting again.",
      },
      { status: 400 }
    );
  }

  let idp: SignInWithIdpResponse;
  try {
    idp = await signInWithIdp(tokenData.access_token, redirectUri);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Firebase sign-in failed" },
      { status: 502 }
    );
  }

  const uid = idp.localId;

  // Store the Google refresh token via the service-account-authenticated
  // Firestore path (src/lib/server/firestore-admin.ts) — never via the
  // user's own idToken, since Firestore Security Rules only gate
  // idToken-authenticated requests and a refresh token must never be
  // reachable from client-side code.
  try {
    await adminSetUserGmailConnection(uid, {
      refreshToken: tokenData.refresh_token,
      connectedAt: new Date().toISOString(),
      status: "connected",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to store Gmail connection: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 500 }
    );
  }

  // Redirect to "/" (no /dashboard route exists yet). Success.
  const response = NextResponse.redirect(new URL("/", request.url));

  // Clear the one-time CSRF cookie now that it's been consumed.
  response.cookies.set("google_oauth_state", "", { path: "/", maxAge: 0 });

  // PLACEHOLDER session mechanism: an httpOnly cookie holding the Firebase
  // idToken + uid, so other server routes can later read "is this browser
  // signed in". This is intentionally minimal — no refresh-on-expiry, no
  // rotation. A fuller session strategy for the Firebase idToken (distinct
  // from the Google/Gmail refresh token stored above, which is what actually
  // needs to survive long-term) is out of scope for this task.
  response.cookies.set(
    "session",
    JSON.stringify({ uid, idToken: idp.idToken }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Number(idp.expiresIn || 3600),
    }
  );

  return response;
}
