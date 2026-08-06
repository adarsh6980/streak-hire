// Lever-hosted application forms (jobs.lever.co). Submit button is commonly
// [data-qa="btn-submit"], text "Submit Application".

function getJobContext() {
  const role =
    window.pounceQueryText([".posting-headline h2", "h2"]) ||
    document.title.split("-")[0]?.trim();

  const company =
    window.pounceQueryText([".main-header-logo img"]) ||
    document.title.split("-").slice(1).join("-").trim() ||
    location.hostname.split(".")[0];

  return { role, company };
}

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

    const { role, company } = getJobContext();
    window.pounceReportApplication({ role, company, source: "lever" });
  },
  true
);
