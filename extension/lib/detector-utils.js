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

// Call this from a site detector once it's confident a submit happened.
window.pounceReportApplication = function reportApplication({ company, role, source }) {
  const dedupeKey = `${source}:${location.href}`;
  if (alreadyReported(dedupeKey)) return;
  markReported(dedupeKey);

  chrome.runtime.sendMessage({
    type: "APPLICATION_DETECTED",
    payload: {
      company,
      role,
      url: location.href,
      source,
      resumeFileName: window.pounceFindResumeFileName(),
    },
  });
};

// Small helper: first non-empty text match from a list of selectors.
window.pounceQueryText = function queryText(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return null;
};

// Generic, site-agnostic best-effort scrape of role/company from whatever
// page the user is currently on — used by the universal quick-confirm
// widget, which by definition has no site-specific selectors to rely on.
window.pounceScrapeJobContext = function scrapeJobContext() {
  const role =
    window.pounceQueryText([
      "h1",
      "[class*='job-title' i]",
      "[class*='jobtitle' i]",
      "[data-testid*='title' i]",
    ]) || document.title.split(/[-|·•]/)[0]?.trim();

  const company =
    window.pounceQueryText([
      "[class*='company-name' i]",
      "[class*='companyname' i]",
      "[class*='employer' i]",
      "[data-testid*='company' i]",
    ]) || location.hostname.replace("www.", "").split(".")[0];

  return { role, company };
};
