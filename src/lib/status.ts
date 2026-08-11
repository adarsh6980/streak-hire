// Single source of truth for how each of the 7 closed application statuses
// (src/lib/server/applications.ts's APPLICATION_STATUSES) is labeled and
// colored on the Dashboard, Applications, and Application detail pages.
//
// Mirrors the exact label/color scheme already established in
// src/app/(app)/companies/page.tsx's local STATUS_LABELS/STATUS_STYLES (a
// parallel page built alongside this one) so status colors read the same
// wherever they appear across the app: One Loud Color Rule — `stamp` is
// reserved for "interview" only (the status that most concretely demands the
// user's attention), `airmail` marks administrative/in-progress stages,
// `offer` marks the one successful terminal state, and `rejected`/
// `withdrawn` stay muted rather than inventing an 8th accent color.
//
// Deliberately imports only the TYPE `ApplicationStatus` (`import type`,
// fully erased at compile time) rather than the runtime APPLICATION_STATUSES
// array, so this file — imported by client components — never pulls
// src/lib/server/firestore-admin.ts's Node-only `crypto` usage into a
// browser bundle. TypeScript still enforces that every Record below covers
// exactly the 7 statuses (a missing/extra key is a type error), so this
// can't silently drift from the real enum.
import type { ApplicationStatus } from "@/lib/server/applications";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  received: "Received",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

// Same insertion order as APPLICATION_STATUSES, derived from STATUS_LABELS's
// keys (rather than re-importing the runtime array) for the bundling reason
// above.
export const ALL_STATUSES = Object.keys(STATUS_LABELS) as ApplicationStatus[];

// Badge-ready bg+text pairs (matches companies/page.tsx's STATUS_STYLES).
export const STATUS_BADGE_CLASSES: Record<ApplicationStatus, string> = {
  applied: "bg-ink/5 text-ink-soft",
  received: "bg-airmail/10 text-airmail",
  assessment: "bg-airmail/10 text-airmail",
  interview: "bg-stamp/10 text-stamp",
  offer: "bg-offer/10 text-offer",
  rejected: "bg-ink/5 text-ink/40",
  withdrawn: "bg-ink/5 text-ink/40",
};

// Solid-dot variant of the same mapping, for board column headers and
// other spots where a small filled circle reads better than a pill badge.
export const STATUS_DOT_CLASSES: Record<ApplicationStatus, string> = {
  applied: "bg-ink-soft/40",
  received: "bg-airmail",
  assessment: "bg-airmail",
  interview: "bg-stamp",
  offer: "bg-offer",
  rejected: "bg-ink-soft/25",
  withdrawn: "bg-ink-soft/25",
};
