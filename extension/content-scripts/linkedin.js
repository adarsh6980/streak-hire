// LinkedIn Easy Apply detection, layered two ways because relying on a single
// signal is fragile against LinkedIn's frequently-changing DOM:
//
// 1. Click on whatever the final "Submit application" control turns out to be
//    (broad text match, not an exact string) — fast, but a click alone
//    doesn't prove the submission actually succeeded (validation errors etc).
// 2. A MutationObserver watching for LinkedIn's own post-submit confirmation
//    text ("application was sent" / "application submitted") — slower to
//    fire, but only appears on a genuine success, so it's the reliable
//    signal. This is the primary detector; the click listener is a backup
//    for wording variants the observer's phrase list doesn't cover.
//
// Every step logs to the console under "[Streakhire]" so a failure to detect
// can be diagnosed from LinkedIn's tab DevTools console without needing to
// touch this file.

function log(...args) {
  console.debug("[Streakhire]", ...args);
}

let reportedForThisModal = false;

function reportOnce(source) {
  if (reportedForThisModal) return;
  reportedForThisModal = true;
  // Shared, priority-ordered scraper (lib/detector-utils.js) — LinkedIn's
  // own selectors are tried first within it, same as before, just no
  // longer duplicated locally.
  const { role, company, description } = window.pounceScrapeJobContext();
  log(`detected via ${source}:`, { role, company });
  window.pounceReportApplication({ role, company, description, source: "linkedin" });
}

const SUBMIT_LABEL = /\bsubmit(\s+your)?\s+application\b|^submit$/i;

function isLikelySubmitButton(el) {
  if (!el) return false;
  const tag = el.tagName;
  if (tag !== "BUTTON" && !(tag === "A" && el.getAttribute("role") === "button")) return false;
  const label = (el.getAttribute("aria-label") || el.textContent || "").trim();
  return SUBMIT_LABEL.test(label);
}

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button, [role='button']");
    if (!isLikelySubmitButton(button)) return;
    log("submit-labeled button clicked:", button.textContent?.trim());
    // Don't report yet — wait briefly to see if the success confirmation
    // (observer below) shows up, since a click can also just fail validation.
    setTimeout(() => {
      if (!reportedForThisModal) {
        log("no confirmation text seen after click; reporting on the click alone as a fallback");
        reportOnce("click-fallback");
      }
    }, 2500);
  },
  true
);

const CONFIRMATION_TEXT = /application (was |has been )?(sent|submitted)|you('|’)ve applied|applied to/i;

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const text = node.textContent || "";
      if (text.length < 500 && CONFIRMATION_TEXT.test(text)) {
        reportOnce("confirmation-text");
        return;
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// Easy Apply is a modal on top of the same job posting URL, so a new "apply"
// attempt on the same page (e.g. after navigating to a different job without
// a full reload) should be able to report again.
let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    reportedForThisModal = false;
    log("URL changed, re-armed for a new application");
  }
}, 1000);

log("LinkedIn detector loaded on", location.href);
