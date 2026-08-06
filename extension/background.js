import { signIn, signOut, getValidIdToken, getStoredSession } from "./lib/auth.js";
import {
  getUserDoc,
  setUserDoc,
  addApplication,
  updateApplication,
  listRecentApplications,
} from "./lib/firestore.js";
import { applyStreakUpdate } from "./lib/streak.js";

const FOLLOW_UP_AFTER_DAYS = 7;
const FOLLOW_UP_ALARM = "streakhire-follow-up-check";
const DIGEST_ALARM = "streakhire-weekly-digest";
const DASHBOARD_URL = chrome.runtime.getURL("dashboard/dashboard.html");

async function ensureUserDoc(uid, idToken, profile) {
  const existing = await getUserDoc(uid, idToken);
  if (existing) return existing;
  const fresh = {
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL || "",
    createdAt: new Date(),
    streak: { current: 0, longest: 0, lastAppliedDate: null },
  };
  await setUserDoc(uid, idToken, fresh);
  return fresh;
}

async function updateBadge(streakCurrent) {
  await chrome.action.setBadgeBackgroundColor({ color: "#c8401f" });
  await chrome.action.setBadgeText({
    text: streakCurrent > 0 ? String(streakCurrent) : "",
  });
}

async function handleSignIn() {
  const session = await signIn();
  const userDoc = await ensureUserDoc(session.uid, session.idToken, session.profile);
  await updateBadge(userDoc.streak?.current || 0);
  return { session, userDoc };
}

async function handleSignOut() {
  await signOut();
  await chrome.action.setBadgeText({ text: "" });
  return { ok: true };
}

async function getState() {
  const session = await getStoredSession();
  if (!session) return { signedIn: false };

  const idToken = await getValidIdToken();
  const [userDoc, applications] = await Promise.all([
    getUserDoc(session.uid, idToken),
    listRecentApplications(session.uid, idToken, 5),
  ]);
  await updateBadge(userDoc?.streak?.current || 0);

  return {
    signedIn: true,
    profile: session.profile,
    streak: userDoc?.streak || { current: 0, longest: 0, lastAppliedDate: null },
    recentApplications: applications,
  };
}

async function logApplication({ company, role, url, source, auto, resumeFileName }) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();

  const userDoc = await getUserDoc(session.uid, idToken);
  const nextStreak = applyStreakUpdate(userDoc?.streak);

  const [created] = await Promise.all([
    addApplication(session.uid, idToken, {
      company: company || "Unknown company",
      role: role || "Unknown role",
      url: url || "",
      source: source || "manual",
      auto: Boolean(auto),
      status: "applied",
      appliedAt: new Date(),
      resumeFileName: resumeFileName || null,
      notes: "",
      followUpDone: false,
      followUpNotifiedAt: null,
    }),
    setUserDoc(session.uid, idToken, { streak: nextStreak }),
  ]);

  await updateBadge(nextStreak.current);

  if (auto) {
    chrome.notifications.create(`postmarked-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Postmarked ✓",
      message: `${created.role} at ${created.company} — streak: ${nextStreak.current} day${
        nextStreak.current === 1 ? "" : "s"
      }`,
    });
  }

  return { streak: nextStreak, application: created };
}

async function listAllApplications(limit = 200) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();
  return listRecentApplications(session.uid, idToken, limit);
}

async function updateApplicationStatus({ applicationId, status }) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();
  await updateApplication(session.uid, idToken, applicationId, { status });
  return { ok: true };
}

async function updateApplicationDetails({ applicationId, notes, resumeFileName }) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();
  const patch = {};
  if (notes !== undefined) patch.notes = notes;
  if (resumeFileName !== undefined) patch.resumeFileName = resumeFileName;
  await updateApplication(session.uid, idToken, applicationId, patch);
  return { ok: true };
}

async function markFollowedUp({ applicationId }) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();
  await updateApplication(session.uid, idToken, applicationId, { followUpDone: true });
  return { ok: true };
}

function needsFollowUp(app, now = Date.now()) {
  if (app.status !== "applied" || app.followUpDone) return false;
  const appliedAt = new Date(app.appliedAt).getTime();
  if (Number.isNaN(appliedAt)) return false;
  const daysSince = (now - appliedAt) / 86_400_000;
  return daysSince >= FOLLOW_UP_AFTER_DAYS;
}

async function getDigest() {
  const applications = await listAllApplications(200);
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86_400_000;

  const last7Days = applications.filter(
    (a) => new Date(a.appliedAt).getTime() >= sevenDaysAgo
  );
  const interviewsLast7Days = last7Days.filter((a) => a.status === "interviewing").length;
  const needsFollowUpList = applications.filter((a) => needsFollowUp(a, now));

  const byStatus = { applied: 0, interviewing: 0, offer: 0, rejected: 0 };
  for (const app of applications) {
    if (byStatus[app.status] !== undefined) byStatus[app.status] += 1;
  }

  return {
    applicationsLast7Days: last7Days.length,
    interviewsLast7Days,
    needsFollowUp: needsFollowUpList,
    byStatus,
    total: applications.length,
  };
}

async function checkFollowUpsAndNotify() {
  const session = await getStoredSession();
  if (!session) return;

  const applications = await listAllApplications(200);
  const now = Date.now();
  const toNotify = applications.filter(
    (a) => needsFollowUp(a, now) && !a.followUpNotifiedAt
  );
  if (toNotify.length === 0) return;

  const idToken = await getValidIdToken();
  await Promise.all(
    toNotify.map((a) =>
      updateApplication(session.uid, idToken, a.id, { followUpNotifiedAt: new Date() })
    )
  );

  chrome.notifications.create(`followup-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title:
      toNotify.length === 1
        ? "Time to follow up"
        : `Time to follow up on ${toNotify.length} applications`,
    message:
      toNotify.length === 1
        ? `No word yet from ${toNotify[0].company} — worth a nudge?`
        : `${toNotify.map((a) => a.company).slice(0, 3).join(", ")}${
            toNotify.length > 3 ? "…" : ""
          } — no response in ${FOLLOW_UP_AFTER_DAYS}+ days.`,
  });
}

async function sendWeeklyDigestNotification() {
  const session = await getStoredSession();
  if (!session) return;
  const digest = await getDigest();
  if (digest.applicationsLast7Days === 0) return;

  chrome.notifications.create(`digest-${Date.now()}`, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Your week, postmarked",
    message: `${digest.applicationsLast7Days} application${
      digest.applicationsLast7Days === 1 ? "" : "s"
    } sent, ${digest.interviewsLast7Days} interviewing. Keep going.`,
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case "SIGN_IN":
          sendResponse({ ok: true, data: await handleSignIn() });
          break;
        case "SIGN_OUT":
          sendResponse({ ok: true, data: await handleSignOut() });
          break;
        case "GET_STATE":
          sendResponse({ ok: true, data: await getState() });
          break;
        case "LOG_APPLICATION":
        case "APPLICATION_DETECTED":
          sendResponse({
            ok: true,
            data: await logApplication({
              ...message.payload,
              auto: message.type === "APPLICATION_DETECTED",
            }),
          });
          break;
        case "LIST_ALL_APPLICATIONS":
          sendResponse({ ok: true, data: await listAllApplications() });
          break;
        case "UPDATE_APPLICATION_STATUS":
          sendResponse({ ok: true, data: await updateApplicationStatus(message.payload) });
          break;
        case "UPDATE_APPLICATION_DETAILS":
          sendResponse({ ok: true, data: await updateApplicationDetails(message.payload) });
          break;
        case "MARK_FOLLOWED_UP":
          sendResponse({ ok: true, data: await markFollowedUp(message.payload) });
          break;
        case "GET_DIGEST":
          sendResponse({ ok: true, data: await getDigest() });
          break;
        case "OPEN_DASHBOARD":
          await chrome.tabs.create({ url: DASHBOARD_URL });
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (err) {
      const errorMessage = String(err.message || err);
      sendResponse({ ok: false, error: errorMessage });

      // Auto-detection failures are otherwise silent — the person applying
      // never has the popup open to see the error, so surface it directly.
      if (message.type === "APPLICATION_DETECTED") {
        chrome.notifications.create(`postmark-failed-${Date.now()}`, {
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: "Streakhire couldn't log that application",
          message: errorMessage.includes("Not signed in")
            ? "Sign in from the toolbar icon, then it'll catch the next one."
            : errorMessage,
        });
      }
    }
  })();
  return true; // keep the message channel open for the async response
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FOLLOW_UP_ALARM) checkFollowUpsAndNotify();
  if (alarm.name === DIGEST_ALARM) sendWeeklyDigestNotification();
});

chrome.notifications.onClicked.addListener(() => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// Lets streakhire-web.azurewebsites.net (see manifest's externally_connectable)
// ask "is Streakhire installed?" so the landing page can hide its download
// prompt instead of asking an already-installed user to install it again.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({ installed: true, version: chrome.runtime.getManifest().version });
  }
  return true;
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setBadgeBackgroundColor({ color: "#c8401f" });
  chrome.alarms.create(FOLLOW_UP_ALARM, { periodInMinutes: 720 }); // twice a day
  chrome.alarms.create(DIGEST_ALARM, { periodInMinutes: 10080 }); // weekly
});
