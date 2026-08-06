import { FIREBASE_CONFIG, GOOGLE_WEB_CLIENT_ID } from "./firebase-config.js";

const IDENTITY_BASE = "https://identitytoolkit.googleapis.com/v1";
const TOKEN_BASE = "https://securetoken.googleapis.com/v1";

const STORAGE_KEY = "pounce_auth";

// Works in Chrome, Comet, and any other Chromium-based browser — unlike
// chrome.identity.getAuthToken, which is a Chrome-only API that silently
// fails elsewhere because it depends on Chrome's own built-in Google account
// integration. launchWebAuthFlow just opens a real Google sign-in page and
// reads the token back off the redirect, so it has no such dependency.
function getGoogleAccessTokenViaWebAuthFlow(interactive) {
  const redirectUri = chrome.identity.getRedirectURL();

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", GOOGLE_WEB_CLIENT_ID);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("prompt", interactive ? "select_account" : "none");

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive },
      (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(chrome.runtime.lastError || new Error("Sign-in was cancelled"));
          return;
        }
        const hash = new URL(responseUrl).hash.slice(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        if (!accessToken) {
          reject(new Error("No access token in Google's response"));
          return;
        }
        resolve(accessToken);
      }
    );
  });
}

async function signInWithIdp(googleAccessToken) {
  const res = await fetch(
    `${IDENTITY_BASE}/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${googleAccessToken}&providerId=google.com`,
        requestUri: chrome.identity.getRedirectURL(),
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Firebase sign-in failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function refreshIdToken(refreshToken) {
  const res = await fetch(`${TOKEN_BASE}/token?key=${FIREBASE_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in) * 1000,
  };
}

async function storeSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

export async function getStoredSession() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

export async function signIn() {
  const googleAccessToken = await getGoogleAccessTokenViaWebAuthFlow(true);
  const idp = await signInWithIdp(googleAccessToken);

  const session = {
    uid: idp.localId,
    idToken: idp.idToken,
    refreshToken: idp.refreshToken,
    expiresAt: Date.now() + Number(idp.expiresIn) * 1000,
    profile: {
      email: idp.email,
      displayName: idp.displayName || idp.email,
      photoURL: idp.photoUrl || null,
    },
  };
  await storeSession(session);
  return session;
}

export async function signOut() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

// Returns a valid (non-expired) idToken, refreshing if needed. Returns null if signed out.
export async function getValidIdToken() {
  const session = await getStoredSession();
  if (!session) return null;

  const isExpiringSoon = Date.now() > session.expiresAt - 60_000;
  if (!isExpiringSoon) return session.idToken;

  const refreshed = await refreshIdToken(session.refreshToken);
  const updated = { ...session, ...refreshed };
  await storeSession(updated);
  return updated.idToken;
}
