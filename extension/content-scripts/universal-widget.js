// Universal safety net: on any page that looks like a job application —
// not just the sites we have a dedicated detector for — prompt the shared
// "Add to tracker" widget (lib/capture-widget.js). This exists because no
// site-specific detector can ever be 100% reliable against DOM changes on
// sites we don't control, so there needs to be a fallback trigger too, using
// the same one-click widget every other detector now uses.

function log(...args) {
  console.debug("[Streakhire]", ...args);
}

function looksLikeJobApplicationPage() {
  const url = `${location.pathname}${location.search}`.toLowerCase();
  const title = document.title.toLowerCase();

  if (/\b(apply|application|job-application)\b/.test(url)) return true;
  if (/\bapply\b/.test(title)) return true;

  const hasResumeUpload = Array.from(document.querySelectorAll("input[type='file']")).some(
    (el) => {
      const haystack = `${el.name} ${el.id} ${el.getAttribute("aria-label") || ""}`.toLowerCase();
      return /resume|cv/.test(haystack);
    }
  );
  if (hasResumeUpload) return true;

  return false;
}

function maybeShowWidget() {
  if (!looksLikeJobApplicationPage()) return;
  log("page looks like a job application, prompting capture widget");
  window.pounceShowCaptureWidget({
    title: "Applying here?",
    body: "Streakhire didn't recognize this site. Add it to your tracker in one click.",
    source: "quick-confirm",
  });
}

// Give the page a moment to render its real content (title, headings) before
// checking heuristics or scraping, then keep checking as the user navigates
// an SPA without a full reload.
setTimeout(maybeShowWidget, 1500);

let lastHref = location.href;
setInterval(() => {
  if (location.href !== lastHref) {
    lastHref = location.href;
    const existing = document.getElementById("streakhire-widget-host");
    if (existing) existing.remove();
    setTimeout(maybeShowWidget, 1500);
  }
}, 1000);
