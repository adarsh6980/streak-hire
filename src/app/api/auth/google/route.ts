import { NextResponse } from "next/server";

// Starts the web OAuth flow for Google/Gmail sign-in.
//
// This is the server-side equivalent of getGoogleAccessTokenViaWebAuthFlow in
// extension/lib/auth.js: same authorization endpoint and (mostly) the same
// query params, but here the "trigger" is a normal 302 redirect instead of
// chrome.identity.launchWebAuthFlow, since there is no such API outside a
// browser extension. We also request `access_type=offline` + `prompt=consent`
// (the extension's implicit-token flow never needed either, since it never
// asked for a refresh token) and the Gmail readonly scope, since the whole
// point of this server-side flow is to obtain a refresh token we can use
// later without the user present.
export async function GET() {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_WEB_CLIENT_ID is not configured" },
      { status: 500 }
    );
  }
  if (!siteUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SITE_URL is not configured" },
      { status: 500 }
    );
  }

  const redirectUri = `${siteUrl.replace(/\/$/, "")}/api/auth/google/callback`;
  const state = crypto.randomUUID();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set(
    "scope",
    "openid email profile https://www.googleapis.com/auth/gmail.readonly"
  );
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl.toString());
  // httpOnly CSRF-protection cookie, checked against the `state` query param
  // on callback. Short-lived: the whole round trip should take seconds.
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
