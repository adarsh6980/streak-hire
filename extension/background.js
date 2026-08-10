import { signIn, signOut, getValidIdToken, getStoredSession } from "./lib/auth.js";
import {
  getUserDoc,
  setUserDoc,
  addApplication,
  updateApplication,
  deleteApplication,
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

async function logApplication({ company, role, url, source, auto, resumeFileName, description }) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();

  const userDoc = await getUserDoc(session.uid, idToken);
  const nextStreak = applyStreakUpdate(userDoc?.streak);

  const [created] = await Promise.all([
    addApplication(session.uid, idToken, {
      company: company || "Unknown company",
      role: role || "Unknown role",
      description: description || null,
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

// Self-contained on purpose: chrome.scripting.executeScript serializes this
// function and runs it inside the target tab's page context, so it can't
// reference anything from this file's scope (imports, other functions,
// constants) — only what's declared inside it. This is a duplicate of
// lib/detector-utils.js's pounceScrapeJobContext for that reason — keep the
// two in sync by hand if selectors change; detector-utils.js is the source
// of truth.
function scrapeCurrentPageForJobContext() {
  const JUNK_TEXT = /^\d+\s*(notification|message|alert)s?$/i;

  function isValidCandidate(text) {
    if (!text) return false;
    const trimmed = text.trim();
    if (trimmed.length < 2) return false;
    if (JUNK_TEXT.test(trimmed)) return false;
    return true;
  }

  function queryText(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (isValidCandidate(text)) return text;
    }
    return null;
  }

  function findCompanyFromProfileLink() {
    const link = document.querySelector("a[href*='/company/']");
    const text = link?.textContent?.trim();
    return isValidCandidate(text) ? text : null;
  }

  function parseTitleForRoleAndCompany(title) {
    if (!title) return { role: null, company: null };
    let m = title.match(/^(.+?)\s+hiring\s+(.+?)(?:\s+in\s+.+)?\s*[|·-]/i);
    if (m) return { company: m[1].trim(), role: m[2].trim() };
    m = title.match(/^(.+?)\s+at\s+(.+?)\s*[|·-]/i);
    if (m) return { role: m[1].trim(), company: m[2].trim() };
    return { role: null, company: null };
  }

  const titleParsed = parseTitleForRoleAndCompany(document.title);

  const role =
    queryText([
      // LinkedIn
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".t-24.job-details-jobs-unified-top-card__job-title",
      // Greenhouse
      "h1.app-title",
      "#header h1",
      ".job__title",
      // Lever
      ".posting-headline h2",
      // Workday
      "[data-automation-id='jobPostingHeader']",
    ]) ||
    (isValidCandidate(titleParsed.role) ? titleParsed.role : null) ||
    queryText([
      // Generic
      "[class*='job-title' i]",
      "[class*='jobtitle' i]",
      "[data-testid*='title' i]",
      "h1",
    ]) ||
    document.title.split(/[-|·•]/)[0]?.trim();

  const company =
    queryText([
      // LinkedIn
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__subtitle-primary-grouping a",
      ".job-details-jobs-unified-top-card__primary-description-container a",
      // Greenhouse
      ".company-name",
      "#header h2",
      ".job__company",
    ]) ||
    findCompanyFromProfileLink() ||
    (isValidCandidate(titleParsed.company) ? titleParsed.company : null) ||
    queryText([
      // Generic
      "[class*='company-name' i]",
      "[class*='companyname' i]",
      "[class*='employer' i]",
      "[data-testid*='company' i]",
    ]) ||
    location.hostname.replace("www.", "").split(".")[0];

  const descriptionRaw = queryText([
    ".job-details-jobs-unified-top-card__job-description",
    ".jobs-description__content",
    ".jobs-box__html-content",
    "#content",
    ".posting-description",
    "[class*='description' i]",
  ]);
  const description = descriptionRaw ? descriptionRaw.slice(0, 2000) : null;

  const fileInputs = Array.from(document.querySelectorAll("input[type='file']"));
  const withFiles = fileInputs.filter((el) => el.files && el.files.length > 0);
  const resumeLike = withFiles.find((el) => {
    const haystack = `${el.name} ${el.id} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
    return /resume|cv/.test(haystack);
  });
  const resumeFileName = (resumeLike || withFiles[0])?.files[0]?.name || null;

  return { role, company, description, url: location.href, resumeFileName };
}

async function scrapeAndLogActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");
  if (!/^https?:/.test(tab.url || "")) {
    throw new Error("This page can't be scraped (not a regular web page)");
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: scrapeCurrentPageForJobContext,
  });

  return logApplication({ ...result, source: "manual-scrape", auto: false });
}

// Bulk import deliberately does NOT go through logApplication()/
// applyStreakUpdate() — that function always stamps appliedAt as "right
// now" and advances the streak by one day per call, which is correct for a
// single real-time application but nonsensical for importing historical
// records (100 imported rows would falsely jump the streak to 100 and
// overwrite every appliedAt with today's date). Import preserves whatever
// date each row actually carries and leaves the streak counter untouched;
// the streak only ever reflects applications logged as they actually happen.
async function importApplications(applications) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();

  let imported = 0;
  for (const app of applications) {
    const parsedDate = app.appliedAt ? new Date(app.appliedAt) : new Date();
    const appliedAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    await addApplication(session.uid, idToken, {
      company: app.company || "Unknown company",
      role: app.role || "Unknown role",
      description: app.description || null,
      url: app.url || "",
      source: "import",
      auto: false,
      status: [
        "applied",
        "received",
        "assessment",
        "interview",
        "offer",
        "rejected",
        "withdrawn",
      ].includes(app.status)
        ? app.status
        : "applied",
      appliedAt,
      resumeFileName: app.resumeFileName || null,
      notes: app.notes || "",
      followUpDone: false,
      followUpNotifiedAt: null,
    });
    imported += 1;
  }

  return { imported };
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

async function updateApplicationDetails({
  applicationId,
  notes,
  resumeFileName,
  role,
  company,
  description,
  location,
  salary,
  // Named "externalApplicationId" here (not "applicationId") to avoid
  // colliding with this function's own `applicationId` param, which is the
  // Firestore document ID being patched — not a field on the document.
  // It's written to the document under the `applicationId` field name.
  externalApplicationId,
  recruiterName,
  recruiterEmail,
  jobPortal,
  importantLinks,
  tasks,
}) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();
  const patch = {};
  if (notes !== undefined) patch.notes = notes;
  if (resumeFileName !== undefined) patch.resumeFileName = resumeFileName;
  if (role !== undefined) patch.role = role;
  if (company !== undefined) patch.company = company;
  if (description !== undefined) patch.description = description;
  if (location !== undefined) patch.location = location;
  if (salary !== undefined) patch.salary = salary;
  if (externalApplicationId !== undefined) patch.applicationId = externalApplicationId;
  if (recruiterName !== undefined) patch.recruiterName = recruiterName;
  if (recruiterEmail !== undefined) patch.recruiterEmail = recruiterEmail;
  if (jobPortal !== undefined) patch.jobPortal = jobPortal;
  if (importantLinks !== undefined) patch.importantLinks = importantLinks;
  if (tasks !== undefined) patch.tasks = tasks;
  await updateApplication(session.uid, idToken, applicationId, patch);
  return { ok: true };
}

async function deleteApplicationHandler({ applicationId }) {
  const session = await getStoredSession();
  if (!session) throw new Error("Not signed in");
  const idToken = await getValidIdToken();
  await deleteApplication(session.uid, idToken, applicationId);
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
  const interviewsLast7Days = last7Days.filter((a) => a.status === "interview").length;
  const needsFollowUpList = applications.filter((a) => needsFollowUp(a, now));

  const byStatus = {
    applied: 0,
    received: 0,
    assessment: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
  };
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
        case "SCRAPE_AND_LOG_ACTIVE_TAB":
          sendResponse({ ok: true, data: await scrapeAndLogActiveTab() });
          break;
        case "IMPORT_APPLICATIONS":
          sendResponse({ ok: true, data: await importApplications(message.payload.applications) });
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
        case "DELETE_APPLICATION":
          sendResponse({ ok: true, data: await deleteApplicationHandler(message.payload) });
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
