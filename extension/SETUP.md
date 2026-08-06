# Streakhire extension — one-time setup

This is a **developer-only, one-time** setup. Once done, every user just clicks "Sign in with Google" — they never see any of this.

You'll do three things: (1) create a Firebase project, (2) create a Google OAuth client ID for the extension, (3) load the extension. ~15 minutes.

---

## 1. Create the Firebase project (free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Add project**.
2. Name it (e.g. "pounce-app"), disable Google Analytics (not needed), click **Create project**.
3. In the left sidebar: **Build → Authentication → Get started**. Click the **Google** provider, enable it, pick a support email, **Save**.
4. In the left sidebar: **Build → Firestore Database → Create database**. Choose **Production mode**, pick a region close to your users (e.g. `europe-west1` for Ireland), **Enable**.
5. Deploy the security rules already written for you at `extension/firestore.rules`:
   ```bash
   npm install -g firebase-tools   # one-time, if you don't have it
   firebase login
   cd extension
   firebase use --add               # pick the project you just created
   firebase deploy --only firestore:rules
   ```
   (Or paste the contents of `firestore.rules` directly into the Firestore **Rules** tab in the console and click **Publish** — same effect, no CLI needed.)
6. Still in the console: **Project settings** (gear icon, top left) → scroll to **Your apps** → click the **`</>`** (web) icon → register an app (nickname doesn't matter, no hosting needed) → copy the `firebaseConfig` object it shows you.
7. Open `extension/lib/firebase-config.js` and paste in the two values it needs:
   ```js
   export const FIREBASE_CONFIG = {
     apiKey: "AIza...",       // from firebaseConfig.apiKey
     projectId: "pounce-app", // from firebaseConfig.projectId
   };
   ```
   (These are safe to be public — see the note at the top of that file, or ask me to re-explain why.)

---

## 2. Create the OAuth client ID (for "Sign in with Google")

**Important:** this must be a **Web application** OAuth client, not a "Chrome Extension" one. Chrome-Extension-type clients only work with `chrome.identity.getAuthToken`, which is a Chrome-only API — it silently fails in Comet, Edge, Brave, and any other Chromium browser, because it depends on Chrome's own built-in Google account plumbing that other browsers don't have. This extension instead uses `chrome.identity.launchWebAuthFlow`, a lower-level API that works identically everywhere, and that requires a **Web application** client.

The extension's ID is **pinned and fixed** — the manifest ships with a `key` field (a public key) that makes every browser always assign the same ID, no matter which machine or folder you load it from:

```
pdelghcpddcmeolcmhnbldcnbgljeafb
```

(The matching private key lives outside this repo, since anyone holding it could claim that same extension ID — it's not needed for anything in this setup, only for future signed-package builds. Ask if you ever need it.)

Its redirect URL, which you'll need below, is:

```
https://pdelghcpddcmeolcmhnbldcnbgljeafb.chromiumapp.org/
```

Steps:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) — it's the **same project** as your Firebase project (Firebase projects are Google Cloud projects), so select it from the project dropdown at the top.
2. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
3. If prompted, configure the **OAuth consent screen** first: User type "External", fill in app name ("Streakhire"), your email, save through the defaults. You can leave it in "Testing" mode while you're the only user — add your own Google account under **Test users**.
4. Back in **Create OAuth client ID**: Application type = **Web application** (not Chrome Extension).
5. Under **Authorized redirect URIs**, click **Add URI** and paste in the redirect URL above exactly: `https://pdelghcpddcmeolcmhnbldcnbgljeafb.chromiumapp.org/`
6. Click **Create**.
7. Copy the generated **Client ID** (ends in `.apps.googleusercontent.com`). You can ignore the client secret — the flow this extension uses doesn't need it.
8. Open `extension/lib/firebase-config.js` and replace `PASTE_WEB_APPLICATION_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com` with it (the `GOOGLE_WEB_CLIENT_ID` export).

If you already created a "Chrome Extension"-type client from an earlier attempt, you can leave it (harmless) or delete it from the Credentials list — it's no longer used anywhere.

---

## 3. Load the extension

1. Open `chrome://extensions` (works the same way in Comet — it's Chromium-based).
2. Turn on **Developer mode** (top right toggle).
3. Click **Load unpacked**, select the `extension/` folder.
4. Confirm the ID shown on the card matches `pdelghcpddcmeolcmhnbldcnbgljeafb` — if it doesn't, the `key` field in manifest.json got edited or dropped; re-check it.
5. Click the toolbar icon and **Sign in with Google**. You should land on the streak dashboard.

---

## Testing the detectors

Visit a LinkedIn job posting and use Easy Apply, or a Greenhouse/Lever-hosted application page, and submit a real (or test) application. Open the popup — the application should appear under "Recently postmarked" and the streak should tick up. If a specific site's submit button doesn't get caught, that site's selectors in `content-scripts/` may need adjusting to match its current markup — these sites change their DOM periodically, which is exactly why the manual "+ Log an application manually" button exists as a permanent fallback, not just a stopgap.

## Publishing to the Chrome Web Store / Comet

Out of scope for this pass — ping me when you're ready and I'll walk through packaging, the $5 one-time developer registration fee, and store listing requirements (privacy policy is mandatory since this handles user data).
