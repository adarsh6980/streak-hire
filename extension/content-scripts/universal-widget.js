// Universal safety net: on any page that looks like a job application —
// not just the sites we have dedicated detectors for — show a small
// one-click "log this application" widget. This exists because silent
// auto-detection can never be 100% reliable against DOM changes on sites
// we don't control, so there needs to be a fallback that still requires
// no typing, just one click, with the page scraped for role/company the
// same way the automatic detectors do it.

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

function dismissedForThisPage() {
  const dismissed = JSON.parse(sessionStorage.getItem("pounce_widget_dismissed") || "[]");
  return dismissed.includes(location.href);
}

function markDismissedForThisPage() {
  const dismissed = JSON.parse(sessionStorage.getItem("pounce_widget_dismissed") || "[]");
  dismissed.push(location.href);
  sessionStorage.setItem("pounce_widget_dismissed", JSON.stringify(dismissed.slice(-20)));
}

function sendMessage(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error || "Unknown error"));
        return;
      }
      resolve(response.data);
    });
  });
}

function buildWidget() {
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
        <p class="title">Applying here?</p>
        <button class="close" aria-label="Dismiss">&times;</button>
      </div>
      <p class="body">Streakhire didn't auto-detect a submission on this page. Log it in one click.</p>
      <button class="btn">Log this application</button>
      <p class="status"></p>
    </div>
  `;

  const closeBtn = shadow.querySelector(".close");
  const logBtn = shadow.querySelector(".btn");
  const statusEl = shadow.querySelector(".status");

  closeBtn.addEventListener("click", () => {
    markDismissedForThisPage();
    host.remove();
  });

  logBtn.addEventListener("click", async () => {
    logBtn.disabled = true;
    logBtn.textContent = "Logging…";
    try {
      const { role, company, description } = window.pounceScrapeJobContext();
      const resumeFileName = window.pounceFindResumeFileName();
      log("quick-confirm scraped:", { role, company, resumeFileName });

      await sendMessage("LOG_APPLICATION", {
        role,
        company,
        description,
        url: location.href,
        source: "quick-confirm",
        resumeFileName,
      });

      statusEl.textContent = `Postmarked: ${role} at ${company}`;
      statusEl.classList.add("success");
      logBtn.textContent = "Logged ✓";
      setTimeout(() => host.remove(), 3000);
    } catch (err) {
      const message = String(err.message || err);
      statusEl.textContent = message.includes("Not signed in")
        ? "Sign in from the toolbar icon first."
        : message;
      statusEl.classList.add("error");
      logBtn.disabled = false;
      logBtn.textContent = "Try again";
    }
  });

  return host;
}

function maybeShowWidget() {
  if (window.pounceAlreadyReportedForThisPage()) {
    log("already logged this page, skipping widget");
    return;
  }
  if (dismissedForThisPage()) {
    log("widget was dismissed for this page, skipping");
    return;
  }
  if (!looksLikeJobApplicationPage()) {
    return;
  }
  if (document.getElementById("streakhire-widget-host")) return;

  log("page looks like a job application, showing quick-confirm widget");
  document.body.appendChild(buildWidget());
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
