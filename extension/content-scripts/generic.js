// Generic heuristic detector for job sites without a dedicated integration
// (IrishJobs.ie, jobs.ie, publicjobs.ie, and anywhere else). Watches for a
// form submit, or a button click, whose visible text matches an "apply"
// phrase — deliberately conservative to avoid false positives on unrelated
// submit buttons (search, newsletter signup, etc.). Role/company/description
// scraping is shared (lib/detector-utils.js, window.pounceScrapeJobContext).

const APPLY_PHRASES = /\b(submit application|submit your application|apply now|send application)\b/i;
const EXCLUDE_PHRASES = /\b(search|subscribe|newsletter|sign in|log in|filter)\b/i;

function matchesApplyIntent(text) {
  if (!text) return false;
  const normalized = text.trim();
  return APPLY_PHRASES.test(normalized) && !EXCLUDE_PHRASES.test(normalized);
}

function report() {
  const { role, company, description } = window.pounceScrapeJobContext();
  window.pounceReportApplication({ role, company, description, source: "generic" });
}

document.addEventListener(
  "submit",
  (event) => {
    const form = event.target;
    const submitLabel =
      form.querySelector("button[type='submit'], input[type='submit']")?.textContent ||
      form.getAttribute("aria-label") ||
      "";
    if (!matchesApplyIntent(submitLabel)) return;
    report();
  },
  true
);

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button, input[type='submit'], a[role='button']");
    if (!button) return;
    const label = button.value || button.textContent || button.getAttribute("aria-label") || "";
    if (!matchesApplyIntent(label)) return;
    report();
  },
  true
);
