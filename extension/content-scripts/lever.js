// Lever-hosted application forms (jobs.lever.co). Submit button is commonly
// [data-qa="btn-submit"], text "Submit Application". Role/company/description
// scraping is shared (lib/detector-utils.js, window.pounceScrapeJobContext).
//
// Detecting a submit here no longer writes to Firestore directly — it
// prompts the shared "Add to tracker" widget (lib/capture-widget.js) instead,
// same as every other site script. Gmail sync is the core product now.

function isSubmitButton(el) {
  if (!el) return false;
  if (el.getAttribute("data-qa") === "btn-submit") return true;
  const label = (el.textContent || "").trim().toLowerCase();
  return label.includes("submit application");
}

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button, input[type='submit']");
    if (!isSubmitButton(button)) return;

    window.pounceShowCaptureWidget({
      title: "Application submitted?",
      body: "Streakhire saw a submit on this Lever form. Add it to your tracker?",
      source: "lever",
    });
  },
  true
);
