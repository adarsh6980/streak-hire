// Duplicate-detection matching, used by the extension's manual "Add to
// tracker" capture (background.js's logApplication) before it writes a new
// application doc.
//
// This is a deliberate PORT of src/lib/server/gmail-sync.ts's
// matchApplication (same algorithm: normalized-substring match on company,
// then narrowed by role if a role is available) — not a literal shared
// import, since the extension (plain JS, browser service worker) and the
// web app (TypeScript, Node server) are separate runtimes with no shared
// package between them. Keep these two implementations in sync by hand if
// the matching logic ever changes in one place — this is the "same
// algorithm, two runtimes" tradeoff the plan's Phase 5 accepted rather than
// building a shared npm package just for one small function.

function normalizeForMatch(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// existingApplications: array of {id, company, role, ...}. candidate:
// {company, role}. Returns the matched application or null.
export function matchApplication(candidate, existingApplications) {
  const candidateCompany = normalizeForMatch(candidate.company);
  if (!candidateCompany) return null;

  const companyMatches = existingApplications.filter((app) => {
    const appCompany = normalizeForMatch(app.company);
    if (!appCompany) return false;
    return appCompany.includes(candidateCompany) || candidateCompany.includes(appCompany);
  });
  if (companyMatches.length === 0) return null;

  const candidateRole = normalizeForMatch(candidate.role);
  if (!candidateRole) return companyMatches[0];

  const roleMatch = companyMatches.find((app) => {
    const appRole = normalizeForMatch(app.role);
    if (!appRole) return false;
    return appRole.includes(candidateRole) || candidateRole.includes(appRole);
  });

  return roleMatch || companyMatches[0];
}
