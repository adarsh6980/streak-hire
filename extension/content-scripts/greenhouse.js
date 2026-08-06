// Greenhouse-hosted application forms (job-boards.greenhouse.io and embedded
// company career pages using boards.greenhouse.io). The form has a single
// submit button, commonly #submit_app, and posts via a normal form submit.
// Role/company/description scraping is shared (lib/detector-utils.js,
// window.pounceScrapeJobContext) rather than duplicated per site.

function isApplicationForm(form) {
  if (!form) return false;
  if (form.id === "application_form" || form.id === "submit_application") return true;
  return Boolean(form.querySelector("#submit_app, button[type='submit']"));
}

function report() {
  const { role, company, description } = window.pounceScrapeJobContext();
  window.pounceReportApplication({ role, company, description, source: "greenhouse" });
}

document.addEventListener(
  "submit",
  (event) => {
    if (!isApplicationForm(event.target)) return;
    report();
  },
  true
);

// Some Greenhouse embeds submit via a button click handled with JS rather
// than a native form submit event — catch that case too.
document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button, input[type='submit']");
    if (!button) return;
    const label = (button.value || button.textContent || "").trim().toLowerCase();
    if (button.id !== "submit_app" && !label.includes("submit application")) return;
    report();
  },
  true
);
