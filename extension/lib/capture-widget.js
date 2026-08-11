// Shared "Add to Tracker" capture widget. Loaded before every site detector
// (see manifest.json content_scripts order, same pattern as detector-utils.js).
//
// This replaces every content script's previous behavior of silently calling
// pounceReportApplication() the moment a submit/confirmation signal fires.
// Gmail sync (the web app) is now the core of the product; this widget is
// the extension's whole remaining job — a one-click, on-page confirm rather
// than a silent background write. Site-specific scripts keep their precise
// "the user just finished applying here" detection (still the best signal
// for *when* to prompt), they just call window.pounceShowCaptureWidget(...)
// instead of window.pounceReportApplication(...) directly.

function log(...args) {
  console.debug("[Streakhire]", ...args);
}

function buildWidget({ title, body, source }) {
  const host = document.createElement("div");
  host.id = "streakhire-widget-host";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "closed" });

  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .card {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        width: 280px;
        background: #faf5e9;
        border: 1px solid rgba(33,26,18,0.15);
        border-radius: 14px;
        box-shadow: 0 8px 24px -8px rgba(0,0,0,0.35);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #211a12;
        padding: 14px;
        animation: pounce-in 0.3s ease-out;
      }
      @keyframes pounce-in {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
      .title { font-weight: 700; font-size: 13px; margin: 0 0 4px; }
      .body { font-size: 12px; color: #4a4033; line-height: 1.4; margin: 0 0 10px; }
      .close {
        background: none; border: none; cursor: pointer; color: #4a4033;
        font-size: 16px; line-height: 1; padding: 0; margin-top: -2px;
      }
      .btn {
        width: 100%; background: #c8401f; color: #faf5e9; border: none;
        border-radius: 999px; padding: 8px 12px; font-size: 12px;
        font-family: monospace; text-transform: uppercase; letter-spacing: 0.04em;
        cursor: pointer;
      }
      .btn:hover { background: #9c2f15; }
      .btn:disabled { opacity: 0.6; cursor: default; }
      .status { font-size: 11px; margin-top: 8px; color: #4a4033; }
      .status.success { color: #2f6b45; font-weight: 600; }
      .status.error { color: #c8401f; }
    </style>
    <div class="card">
      <div class="row">
        <p class="title">${title}</p>
        <button class="close" aria-label="Dismiss">&times;</button>
      </div>
      <p class="body">${body}</p>
      <button class="btn">Add to tracker</button>
      <p class="status"></p>
    </div>
  `;

  const closeBtn = shadow.querySelector(".close");
  const addBtn = shadow.querySelector(".btn");
  const statusEl = shadow.querySelector(".status");

  closeBtn.addEventListener("click", () => {
    markDismissedForThisPage();
    host.remove();
  });

  addBtn.addEventListener("click", async () => {
    addBtn.disabled = true;
    addBtn.textContent = "Adding…";
    try {
      const { role, company, description } = window.pounceScrapeJobContext();
      log(`capture confirmed via ${source}:`, { role, company });

      // pounceReportApplication (lib/detector-utils.js) already owns
      // page-level dedup (alreadyReported/markReported) and the
      // resumeFileName lookup; background.js's logApplication separately
      // owns cross-application dedup (matching an existing tracked company,
      // see lib/matching.js) and reports back which one happened via
      // `duplicate` on the resolved result.
      const result = await window.pounceReportApplication({ role, company, description, source });

      statusEl.textContent = result?.duplicate
        ? `Already tracked: ${result.application?.company || company}`
        : `Added: ${role} at ${company}`;
      statusEl.classList.add("success");
      addBtn.textContent = result?.duplicate ? "Already tracked" : "Added ✓";
      setTimeout(() => host.remove(), 3000);
    } catch (err) {
      const message = String(err?.message || err);
      statusEl.textContent = message.includes("Not signed in")
        ? "Sign in from the toolbar icon first."
        : message;
      statusEl.classList.add("error");
      addBtn.disabled = false;
      addBtn.textContent = "Try again";
    }
  });

  return host;
}

function dismissedForThisPage() {
  const dismissed = JSON.parse(sessionStorage.getItem("pounce_widget_dismissed") || "[]");
  return dismissed.includes(location.href);
}

function markDismissedForThisPage() {
  const dismissed = JSON.parse(sessionStorage.getItem("pounce_widget_dismissed") || "[]");
  dismissed.push(location.href);
  sessionStorage.setItem("pounce_widget_dismissed", JSON.stringify(dismissed.slice(-20)));
}

// Called by every content script (site-specific detectors, generic.js, and
// universal-widget.js's own heuristic) whenever it wants to prompt the user
// to confirm logging the current page — replaces the old direct
// pounceReportApplication() call every one of them used to make silently.
window.pounceShowCaptureWidget = function showCaptureWidget({
  title = "Applying here?",
  body = "Add this application to your Streakhire tracker in one click.",
  source = "generic",
} = {}) {
  if (window.pounceAlreadyReportedForThisPage()) {
    log("already added this page this session, skipping widget");
    return;
  }
  if (dismissedForThisPage()) {
    log("widget was dismissed for this page, skipping");
    return;
  }
  if (document.getElementById("streakhire-widget-host")) return;

  log(`showing capture widget (source: ${source})`);
  document.body.appendChild(buildWidget({ title, body, source }));
};
