// Shared client+server-safe helpers for rendering applications across the
// Dashboard, Applications, and Application detail pages — same source-label
// vocabulary and search-matching behavior as
// extension/dashboard/dashboard.js's SOURCE_LABELS/humanizeSource and
// matchesSearch, ported to a shared module rather than duplicated per page.
//
// Date formatting is intentionally NOT duplicated here — see
// src/lib/format-date.ts (formatDateShort/formatDateTime/relativeDueLabel),
// already shared across Action Centre/Calendar/Analytics.

const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  greenhouse: "Greenhouse",
  lever: "Lever",
  workday: "Workday",
  generic: "Web",
  manual: "Manual",
  "manual-scrape": "Scraped",
  "quick-confirm": "Quick log",
  import: "Imported",
  gmail: "Gmail",
};

export function humanizeSource(source: string, auto: boolean): string {
  return SOURCE_LABELS[source] || (auto ? "Auto" : "Manual");
}

// Same substring, case-insensitive, role+company match as
// extension/dashboard/dashboard.js's matchesSearch.
export function matchesSearch(
  app: { role?: string | null; company?: string | null },
  query: string
): boolean {
  if (!query) return true;
  const haystack = `${app.role || ""} ${app.company || ""}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}
