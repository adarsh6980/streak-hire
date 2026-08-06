// Shared helpers for content-script detectors. Loaded before each site-specific
// detector script (see manifest.json content_scripts order).

// Guards against logging the same submit twice (e.g. a double click, or a
// script re-running after SPA navigation) within one browsing session.
function alreadyReported(dedupeKey) {
  const seen = sessionStorage.getItem("pounce_reported") || "[]";
  const list = JSON.parse(seen);
  return list.includes(dedupeKey);
}

function markReported(dedupeKey) {
  const seen = sessionStorage.getItem("pounce_reported") || "[]";
  const list = JSON.parse(seen);
  list.push(dedupeKey);
  sessionStorage.setItem("pounce_reported", JSON.stringify(list.slice(-20)));
}

// Lets the universal quick-confirm widget check whether a site-specific
// detector (or an earlier manual confirm) already logged this exact page
// this session, so it doesn't prompt for something already captured.
window.pounceAlreadyReportedForThisPage = function alreadyReportedForThisPage() {
  const seen = sessionStorage.getItem("pounce_reported") || "[]";
  const list = JSON.parse(seen);
  return list.some((key) => key.endsWith(`:${location.href}`));
};

// Best-effort: find the filename of whatever resume/CV the applicant
// uploaded on this page. Browsers only ever expose the filename itself
// (never the file path or contents) via input.files[i].name — that's a
// hard browser privacy limit, not something we're choosing to leave out.
// We look for a file input that seems resume-related first, and fall back
// to the first file input with a selected file otherwise.
window.pounceFindResumeFileName = function findResumeFileName() {
  const fileInputs = Array.from(document.querySelectorAll("input[type='file']"));
  const withFiles = fileInputs.filter((el) => el.files && el.files.length > 0);
  if (withFiles.length === 0) return null;

  const resumeLike = withFiles.find((el) => {
    const haystack = `${el.name} ${el.id} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
    return /resume|cv/.test(haystack);
  });

  return (resumeLike || withFiles[0]).files[0].name;
};

// A candidate string is rejected if it's too short to be real, or matches
// known chrome/nav junk we've actually seen picked up by a too-eager
// selector (e.g. LinkedIn's notification-count badge reading "0
// notifications" when a generic h1 selector matched the wrong element).
const JUNK_TEXT = /^\d+\s*(notification|message|alert)s?$/i;

function isValidCandidate(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 2) return false;
  if (JUNK_TEXT.test(trimmed)) return false;
  return true;
}

// Small helper: first *valid* text match from a list of selectors, tried in
// order — site-specific selectors should always be listed before generic
// ones, since generic selectors (bare "h1", "[class*='title']") are the
// ones prone to matching chrome/nav elements on sites with a known layout.
window.pounceQueryText = function queryText(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (isValidCandidate(text)) return text;
  }
  return null;
};

// One shared, priority-ordered scrape used by the universal widget and (as
// a duplicated-but-synced copy, see background.js's
// scrapeCurrentPageForJobContext) the popup's on-demand scrape button.
// Site-specific selectors for every detector we ship come first — copied
// from each site's own content-script — generic fallbacks come last, and a
// bare "h1" is the very last resort rather than the first attempt, which is
// what previously let LinkedIn's nav/notification markup get picked up
// instead of the real job title.
window.pounceScrapeJobContext = function scrapeJobContext() {
  const role =
    window.pounceQueryText([
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
      // Generic
      "[class*='job-title' i]",
      "[class*='jobtitle' i]",
      "[data-testid*='title' i]",
      "h1",
    ]) || document.title.split(/[-|·•]/)[0]?.trim();

  const company =
    window.pounceQueryText([
      // LinkedIn
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__subtitle-primary-grouping a",
      ".job-details-jobs-unified-top-card__primary-description-container a",
      // Greenhouse
      ".company-name",
      "#header h2",
      ".job__company",
      // Generic
      "[class*='company-name' i]",
      "[class*='companyname' i]",
      "[class*='employer' i]",
      "[data-testid*='company' i]",
    ]) || location.hostname.replace("www.", "").split(".")[0];

  const descriptionRaw = window.pounceQueryText([
    // LinkedIn
    ".job-details-jobs-unified-top-card__job-description",
    ".jobs-description__content",
    ".jobs-box__html-content",
    // Greenhouse
    "#content",
    // Lever
    ".posting-description",
    // Generic
    "[class*='description' i]",
  ]);
  // Firestore documents cap at 1MB; a full page's description text has no
  // reason to approach that, so trim to a sane length rather than store
  // arbitrary amounts of scraped HTML-derived text.
  const description = descriptionRaw ? descriptionRaw.slice(0, 2000) : null;

  return { role, company, description };
};

// Call this from a site detector once it's confident a submit happened.
window.pounceReportApplication = function reportApplication({ company, role, source, description }) {
  const dedupeKey = `${source}:${location.href}`;
  if (alreadyReported(dedupeKey)) return;
  markReported(dedupeKey);

  chrome.runtime.sendMessage({
    type: "APPLICATION_DETECTED",
    payload: {
      company,
      role,
      description: description || null,
      url: location.href,
      source,
      resumeFileName: window.pounceFindResumeFileName(),
    },
  });
};
