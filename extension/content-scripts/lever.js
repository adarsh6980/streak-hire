// Lever-hosted application forms (jobs.lever.co). Submit button is commonly
// [data-qa="btn-submit"], text "Submit Application". Role/company/description
// scraping is shared (lib/detector-utils.js, window.pounceScrapeJobContext).

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

    const { role, company, description } = window.pounceScrapeJobContext();
    window.pounceReportApplication({ role, company, description, source: "lever" });
  },
  true
);
