// LinkedIn Easy Apply: the flow is a modal with a final "Submit application" button.
// Selectors are best-effort — LinkedIn changes its DOM often, so this also falls back
// to matching on visible button text, which is more resilient than exact classes.

function getJobContext() {
  const role =
    window.pounceQueryText([
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      "h1",
    ]) || document.title.split("|")[0]?.trim();

  const company =
    window.pounceQueryText([
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__subtitle-primary-grouping a",
    ]) || document.title.split("|")[1]?.trim();

  return { role, company };
}

function isSubmitButton(el) {
  if (!el || el.tagName !== "BUTTON") return false;
  const label = (el.getAttribute("aria-label") || el.textContent || "").trim().toLowerCase();
  return label === "submit application" || label.includes("submit application");
}

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button");
    if (!isSubmitButton(button)) return;

    const { role, company } = getJobContext();
    window.pounceReportApplication({ role, company, source: "linkedin" });
  },
  true
);
