// Generic heuristic detector for job sites without a dedicated integration
// (IrishJobs.ie, jobs.ie, publicjobs.ie, and anywhere else). Watches for a
// form submit, or a button click, whose visible text matches an "apply"
// phrase — deliberately conservative to avoid false positives on unrelated
// submit buttons (search, newsletter signup, etc.).

const APPLY_PHRASES = /\b(submit application|submit your application|apply now|send application)\b/i;
const EXCLUDE_PHRASES = /\b(search|subscribe|newsletter|sign in|log in|filter)\b/i;

function getJobContext() {
  const role =
    window.pounceQueryText(["h1", "[class*='job-title']", "[class*='jobtitle']"]) ||
    document.title.split(/[-|]/)[0]?.trim();

  const company =
    window.pounceQueryText([
      "[class*='company-name']",
      "[class*='companyname']",
      "[class*='employer']",
    ]) || location.hostname.replace("www.", "").split(".")[0];

  return { role, company };
}

function matchesApplyIntent(text) {
  if (!text) return false;
  const normalized = text.trim();
  return APPLY_PHRASES.test(normalized) && !EXCLUDE_PHRASES.test(normalized);
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

    const { role, company } = getJobContext();
    window.pounceReportApplication({ role, company, source: "generic" });
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

    const { role, company } = getJobContext();
    window.pounceReportApplication({ role, company, source: "generic" });
  },
  true
);
