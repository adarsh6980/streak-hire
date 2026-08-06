// Fill these in from your Firebase project settings (Project settings → General → Your apps → Web app config).
// These values are safe to be public — see SETUP.md for why. Security comes from Firestore rules, not from
// hiding this file.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBoB2VaFnf0aA3p3Hz3UYzzraoLLUdTUJE",
  projectId: "streakhire-d91b6",
};

// A separate "Web application" OAuth client (NOT the "Chrome Extension" type
// client used previously) — required for chrome.identity.launchWebAuthFlow,
// which works across Chrome, Comet, and other Chromium browsers, unlike
// chrome.identity.getAuthToken which is Chrome-only. See SETUP.md.
export const GOOGLE_WEB_CLIENT_ID = "17867203210-06tlfibucc5rkc1rb05c23sf9jbtmc91.apps.googleusercontent.com";
