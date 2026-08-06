// Greenhouse-hosted application forms (job-boards.greenhouse.io and embedded
// company career pages using boards.greenhouse.io). The form has a single
// submit button, commonly #submit_app, and posts via a normal form submit.

function getJobContext() {
  const role =
    window.pounceQueryText(["h1.app-title", "#header h1", ".job__title", "h1"]) ||
    document.title.split("-")[0]?.trim();

  const company =
    window.pounceQueryText([".company-name", "#header h2", ".job__company"]) ||
    document.title.split("-").slice(1).join("-").trim();

  return { role, company };
}

function isApplicationForm(form) {
  if (!form) return false;
  if (form.id === "application_form" || form.id === "submit_application") return true;
  return Boolean(form.querySelector("#submit_app, button[type='submit']"));
}

document.addEventListener(
  "submit",
  (event) => {
    if (!isApplicationForm(event.target)) return;
    const { role, company } = getJobContext();
    window.pounceReportApplication({ role, company, source: "greenhouse" });
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

    const { role, company } = getJobContext();
    window.pounceReportApplication({ role, company, source: "greenhouse" });
  },
  true
);
