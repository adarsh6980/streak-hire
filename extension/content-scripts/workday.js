// Workday (*.myworkdayjobs.com) runs a multi-step application wizard ending
// in a review page with a final "Submit" button. Workday's DOM uses generated
// data-automation-id attributes that are relatively stable across tenants.
// Role/company/description scraping is shared (lib/detector-utils.js,
// window.pounceScrapeJobContext).
//
// Detecting a submit here no longer writes to Firestore directly — it
// prompts the shared "Add to tracker" widget (lib/capture-widget.js) instead,
// same as every other site script. Gmail sync is the core product now.

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

    window.pounceShowCaptureWidget({
      title: "Application submitted?",
      body: "Streakhire saw a submit on this Workday application. Add it to your tracker?",
      source: "workday",
    });
  },
  true
);
