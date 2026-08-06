// Workday (*.myworkdayjobs.com) runs a multi-step application wizard ending
// in a review page with a final "Submit" button. Workday's DOM uses generated
// data-automation-id attributes that are relatively stable across tenants.
// Role/company/description scraping is shared (lib/detector-utils.js,
// window.pounceScrapeJobContext).

function isFinalSubmitButton(el) {
  if (!el) return false;
  const automationId = el.getAttribute("data-automation-id") || "";
  if (automationId.toLowerCase().includes("submit")) return true;
  const label = (el.textContent || "").trim().toLowerCase();
  return label === "submit";
}

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button");
    if (!isFinalSubmitButton(button)) return;

    // Workday's "Submit" also appears earlier in the wizard (e.g. "Submit
    // Address") — only fire on the review step, identified by the presence
    // of a review/terms section on the page.
    const onReviewStep = Boolean(
      document.querySelector(
        "[data-automation-id*='review'], [data-automation-id*='termsAndConditions']"
      )
    );
    if (!onReviewStep) return;

    const { role, company, description } = window.pounceScrapeJobContext();
    window.pounceReportApplication({ role, company, description, source: "workday" });
  },
  true
);
