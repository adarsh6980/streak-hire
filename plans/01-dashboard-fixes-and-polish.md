# Plan: Dashboard fixes, delete/edit, richer detail view, motion polish

Source: live user testing on LinkedIn, 2026-08-06. Five issues, ordered by
dependency (data model change in Phase 2 is needed before Phase 4's edit UI
can cover the new fields; Phase 1's scrape fix should land before more bad
data accumulates).

## Phase 0: Facts on hand (no external docs — 100% self-authored code)

This extension has zero third-party UI/animation libraries and no build
step (plain HTML/CSS/JS loaded directly by the browser, per
`extension/manifest.json`). "Documentation discovery" here means citing the
actual current source, not external API docs — confirmed by direct read
this session:

- **Data flow**: `extension/lib/firestore.js` wraps the Firestore REST API
  (no SDK). `getUserDoc`/`setUserDoc`/`addApplication`/`updateApplication`/
  `listRecentApplications` exist; no `deleteApplication` yet (confirmed:
  grep for `DELETE` in that file returns nothing).
- **Message routing**: `extension/background.js:284-330` is a single
  `chrome.runtime.onMessage` switch. Existing cases relevant here:
  `LOG_APPLICATION`/`APPLICATION_DETECTED` (line 296), `SCRAPE_AND_LOG_ACTIVE_TAB`
  (line 306), `UPDATE_APPLICATION_STATUS` (line 312), `UPDATE_APPLICATION_DETAILS`
  (line 315). No `DELETE_APPLICATION` case.
- **Scrape logic exists in three separate places today, out of sync**:
  1. `extension/content-scripts/linkedin.js:26-44` — good, LinkedIn-specific
     selectors (`.job-details-jobs-unified-top-card__job-title` etc.), used
     only by the silent auto-detector.
  2. `extension/lib/detector-utils.js:78-96` (`pounceScrapeJobContext`) —
     generic `h1` / class-substring selectors only, used by the universal
     widget (`content-scripts/universal-widget.js`).
  3. `extension/background.js:114-149` (`scrapeCurrentPageForJobContext`) —
     a **duplicate** of #2, self-contained because `chrome.scripting.executeScript`
     serializes the function and can't reference outside scope. Used by the
     popup's "scrape this page" button.
  Both #2 and #3 fall back to a bare `document.querySelector('h1')`, which on
  LinkedIn matches chrome/nav markup (confirmed bug: logged
  role="0 notifications", company="linkedin").
- **Data model** (`extension/background.js:78-90`, the `addApplication` call):
  `company, role, url, source, auto, status, appliedAt, resumeFileName, notes,
  followUpDone, followUpNotifiedAt`. No `description` field.
- **Dashboard rendering**: `extension/dashboard/dashboard.js` builds cards from
  a `<template>` in `dashboard.html` (`#card-template`), grouped into 4 status
  columns by `renderBoard()`. `extension/dashboard/dashboard.css:183-188`
  (`.column-cards`) is `display:flex; flex-direction:column;` with no
  `max-height` — unbounded vertical growth confirmed.
- **Design system constraints** (`/Users/adarsh/Projects/streakhire/DESIGN.md`,
  written by the documenter agent from the shipped Next.js site — the
  dashboard should read as the same product, not a different one):
  - Palette: `--paper #f4ecd9`, `--stamp #c8401f` (postmark red, the one loud
    color), `--airmail #1f3f6b`, `--offer #2f6b45`. Already mirrored in
    `dashboard.css:5-14`.
  - **"The Tilt-Not-Lift Rule"**: physical presence signaled by slight
    rotation (−1.5° to −18°), not drop-shadow lift. `shadow-stamp` is
    reserved for objects being actively stamped/pressed, not ambient card
    hover.
  - Flat-by-default; hairline borders over shadows for surface separation.
  - Mono/tracking-number type for labels and metadata, display face for
    headings — already followed in `dashboard.css`.
  - No kicker/eyebrow labels above headings (a hard ban recorded from the
    finish-review pass on the main site — carry the same rule here).
- **No animation library available or desired**: this is a raw extension
  page, not the Next.js site (no Framer Motion here). Native CSS
  transitions/`@keyframes` plus the Web Animations API
  (`element.animate(...)`, no dependency, broadly supported) are the
  correct tool — framed as "use CSS transitions for state changes, WAAPI or
  `@keyframes` for entrance/postmark moments," not "add a library."

**Allowed APIs / patterns for this plan** (cite before using anything not
listed): Firestore REST `DELETE` verb (same `firestoreFetch` helper already
in `lib/firestore.js`, just a new exported function using `method: "DELETE"`,
matching the existing `updateApplication`'s call shape); `element.animate()`
(WAAPI, no import needed); CSS `max-height` + `overflow-y: auto` +
`scrollbar-width` for the column-scale fix; `<dialog>` element or a plain
fixed-position overlay `div` for the detail modal (project has no existing
modal pattern to copy — plain overlay div is simpler and matches the
widget's existing shadow-DOM-free style used elsewhere in `dashboard.html`).

**Anti-patterns to avoid**: don't invent a Firestore "batch delete" or
"soft delete" flag — the existing `updateApplication`/`addApplication`
pattern is a full-document PATCH/POST/DELETE per call, keep DELETE
symmetric with that. Don't reach for a frontend framework (React/Vue) for
the dashboard — out of scope and inconsistent with the rest of the
extension. Don't restyle sections DESIGN.md doesn't cover as an excuse to
freelance a new visual direction — this is a refinement of an established
surface, not a new one.

---

## Phase 1: Unify scraping — fix the LinkedIn garbage-data bug

**Goal**: one shared, well-ordered selector list (site-specific first,
generic last, with a sanity filter rejecting obviously-wrong text), used
identically by all three scrape call sites instead of three copies drifting
out of sync.

**What to implement**:
1. In `extension/lib/detector-utils.js`, replace `pounceScrapeJobContext`
   (lines 78-96) with a version that tries, in order: LinkedIn top-card
   selectors (copy from `linkedin.js:8-19`), then Greenhouse/Lever/Workday
   selectors (copy from those files' `getJobContext()`), then the existing
   generic class-substring selectors, then `h1` **last**, then
   `document.title` split as final fallback.
2. Add a sanity filter: reject candidate text matching
   `/^\d+\s*(notification|message|alert)s?$/i`, pure whitespace, or length
   `< 2` — re-try the next selector in the list instead of accepting garbage.
3. `extension/background.js:114-149`
   (`scrapeCurrentPageForJobContext`) **must stay self-contained** (WAAPI
   constraint: `chrome.scripting.executeScript`'s `func` is serialized, no
   closures over outside scope) — duplicate the same improved selector list
   + sanity filter inline here too. Add a one-line comment pointing at
   `detector-utils.js`'s version as the source of truth to keep them in
   sync by eyeball on future edits.
4. Bump `extension/manifest.json` version (current: `0.4.0` → `0.5.0`).

**Verification**:
- Manually re-test on the same LinkedIn "Lette / Product Engineer" posting
  (or any LinkedIn job page) using both the popup's scrape button and the
  floating widget; role/company must be real values, not "0 notifications"/
  "linkedin".
- `node --input-type=module --check` on both edited files.
- `node /Users/adarsh/.claude/skills/impeccable/scripts/detect.mjs` doesn't
  apply here (extension JS, not the Next.js site) — skip.

---

## Phase 2: Add `description` field + dashboard detail view

**Goal**: clicking a card opens a detail view with full job description,
company, role, source, original URL, applied date, resume, notes.

**What to implement**:
1. **Capture description at scrape time**: extend the same selector-list
   function from Phase 1 (both `detector-utils.js` and the background.js
   duplicate) to also grab a description snippet — try
   `.job-details-jobs-unified-top-card__job-description` /
   `.jobs-description__content` (LinkedIn), `#content` (Greenhouse), the
   Lever `.posting-description`, generic `[class*='description' i]`,
   falling back to `null`. Truncate to a reasonable length (e.g. 2000 chars)
   before sending — Firestore document fields have a 1MB per-document
   ceiling but there's no reason to store an entire page's text.
2. Thread `description` through: `linkedin.js`, `greenhouse.js`, `lever.js`,
   `workday.js`, `generic.js` (`getJobContext()` return values),
   `detector-utils.js`'s `pounceReportApplication` payload,
   `background.js`'s `logApplication()` params and the `addApplication()`
   call (add `description: description || null` alongside the existing
   fields at `background.js:78-90`), and `updateApplicationDetails` /
   `UPDATE_APPLICATION_DETAILS` handler so it's editable later (ties into
   Phase 4).
3. **Dashboard detail view**: add a modal (plain fixed-position overlay div,
   per Phase 0's "allowed patterns" — no new dependency) in
   `dashboard.html`, opened by clicking anywhere on a card body (not the
   status `<select>` or the existing "Notes & resume" toggle, which should
   keep their current inline behavior for quick edits). Modal shows: role,
   company, full description (scrollable if long), source badge, applied
   date, original URL as a link (`target="_blank"`), resume filename, notes
   — read view by default, with Edit/Delete entry points wired in Phase 4.

**Verification**:
- Log a fresh LinkedIn application after Phase 1+2 ship; open its dashboard
  card; description field should be populated and readable in the modal.
- Existing applications logged before this change will have `description:
  undefined` — confirm the modal handles a missing description gracefully
  (e.g. "No description captured" instead of blank/broken layout).

---

## Phase 3: Fix Kanban column scale (the "100 jobs in a straight line" bug)

**Goal**: columns stay usable at real volume (dozens to 100+ applications)
instead of becoming one endless vertical scroll.

**What to implement**:
1. `extension/dashboard/dashboard.css`: give `.column-cards` (currently
   lines 183-188) a `max-height` (e.g. `calc(100vh - 260px)`, accounting for
   header + digest bar + column title above it) and `overflow-y: auto`, plus
   a thin custom scrollbar (`scrollbar-width: thin` and/or
   `::-webkit-scrollbar` sizing) so each column scrolls independently
   instead of the whole page growing.
2. Shrink the card's default (collapsed) footprint so more fit on screen at
   once: role/company on one line each with `text-overflow: ellipsis` at a
   max-width, keep the expand-for-notes/resume behavior collapsed by
   default (already is).
3. Add a lightweight per-column search/filter input (company/role text
   match, client-side against the already-fetched `LIST_ALL_APPLICATIONS`
   result — no new backend query needed) above the board, since scrolling
   alone doesn't solve "find one specific application out of 100."
4. Keep the existing `digest-bar` and `followup-banner` above the board
   untouched — only the board/column layer changes.

**Verification**:
- Manually seed 30-50 test applications (script against `addApplication`
  via a temporary Node script hitting the Firestore REST API with a test
  token, or just click "Log an application manually" many times) and
  confirm columns scroll internally, page doesn't grow unbounded, and the
  search filter narrows results correctly.

---

## Phase 4: Delete + extend edit (role/company/description), incl. rules

**Goal**: user can fix or remove any bad entry (including the "0
notifications" garbage already in the live database) directly from the
dashboard, no code deploy required.

**What to implement**:
1. `extension/lib/firestore.js`: add `deleteApplication(uid, idToken,
   applicationId)` using the existing `firestoreFetch` helper with `method:
   "DELETE"` on the same `/users/${uid}/applications/${applicationId}` path
   `updateApplication` already targets (no new endpoint shape to invent).
2. `extension/background.js`: add a `deleteApplicationHandler` function
   (session/idToken lookup identical to `updateApplicationStatus`'s
   pattern at line 173) and a `DELETE_APPLICATION` case in the message
   switch (alongside `UPDATE_APPLICATION_STATUS` at line 312).
3. Extend `updateApplicationDetails` (line 181) and the
   `UPDATE_APPLICATION_DETAILS` handler to accept `role`, `company`, and
   `description` in addition to the existing `notes`/`resumeFileName` —
   same conditional-patch pattern already there (`if (x !== undefined)
   patch.x = x`).
4. **Dashboard UI**: in the Phase 2 detail modal, add an "Edit" mode
   (inputs for role/company/description/resume, textarea for notes — reuse
   the existing card-expand inputs' styling from `dashboard.css:267-297`)
   with Save (calls the extended `UPDATE_APPLICATION_DETAILS`) and a
   **Delete** button with a confirm step (plain `confirm()` is acceptable
   here — this is a destructive action needing a deliberate second click,
   not a place to skip confirmation for polish's sake) that calls
   `DELETE_APPLICATION` then removes the card from the DOM and re-fetches
   the digest (delete can change follow-up-needed counts).
5. `extension/firestore.rules`: confirm the existing rule
   (`allow read, write: if request.auth != null && request.auth.uid ==
   uid;` on `/users/{uid}/applications/{applicationId}`, `firestore.rules`
   lines ~14-16) already covers `delete` — Firestore's `write` permission
   is a superset covering create/update/delete, so **no rule change should
   be needed**; explicitly verify this rather than assuming, and only add
   an explicit `delete` clause if testing shows the existing rule doesn't
   cover it.

**Verification**:
- Delete one of the known-bad "0 notifications / linkedin" entries from the
  live database via the new UI; confirm it's gone from both the dashboard
  and a fresh `LIST_ALL_APPLICATIONS` fetch.
- Edit a role/company on an existing entry, confirm the change persists
  after closing and reopening the dashboard (i.e. actually round-trips
  through Firestore, not just local state).
- Attempt the delete while signed out (or with a tampered uid) if
  practical, to sanity-check the Firestore rule actually blocks
  cross-user deletes — this is the one item in this phase with real
  security stakes.

---

## Phase 5: Motion & craft polish (design-system-constrained, not freelanced)

**Goal**: the dashboard stops feeling like a bare CRUD table and reads as
the same "postal sorting facility" product as the marketing site — without
inventing a new visual language DESIGN.md doesn't already own.

**What to implement** (each tied to a DESIGN.md rule, not vibes):
1. **Card entrance**: when `renderBoard()` (re)populates a column, animate
   each card in with `element.animate([{opacity:0, transform:'translateY(8px)'},
   {opacity:1, transform:'translateY(0)'}], {duration: 220, delay: i*30,
   easing:'ease-out'})` — staggered, matching the "pace the scroll like a
   studio" principle from the main site's build without needing Framer
   Motion.
2. **The postmark moment**: when an application is successfully logged
   (relevant if the dashboard is left open while auto-detection or the
   popup button fires elsewhere) or when a status changes, apply a brief
   rotation-based "stamped" animation to that card — 2-3° rotate + scale
   pulse — per **The Tilt-Not-Lift Rule**: rotation, not drop-shadow, is
   this system's physical-presence language. Do not add card hover-lift
   shadows; that rule explicitly forbids it.
3. **Status-change transition**: moving a card between columns (via the
   status `<select>`) should animate out of the old column and into the
   new one rather than an instant re-render — a simple fade+slide via
   `element.animate()` around the existing `renderBoard()` call is enough;
   no drag-and-drop implementation (out of scope, the `<select>` UX stays).
4. **Empty state**: the current `.empty-state` (`dashboard.css:312-317`) is
   plain text — give it the same treatment `PostmarkLogo`-style empty
   states get on the main site (a simple inline SVG postmark ring, per the
   existing `postmark-ring` visual language, not a new icon system).
5. **Digest bar / streak count**: consider a subtle count-up animation on
   the numbers when they change (small `element.animate()` on a text
   node's content via `requestAnimationFrame`, no library) — nice-to-have,
   not required if time-boxed.

**Explicitly out of scope for this phase** (per DESIGN.md's Do's/Don'ts,
carried over): no gradient text, no card hover-lift shadows, no kicker
labels above the dashboard's section headings, no new color introduced
beyond the existing `--stamp`/`--airmail`/`--offer` roles.

**Verification**:
- Visual check in the loaded extension (screenshot before/after not
  practical for a live extension page the way it was for the Next.js
  site — verify by loading the unpacked extension and interacting
  directly): card entrance stagger visible, status-change transition
  doesn't feel janky, no hover-lift shadows introduced (grep
  `dashboard.css` for any new `box-shadow` on `.card:hover` and remove
  if found — that would violate the Tilt-Not-Lift rule).
- Confirm animations respect `prefers-reduced-motion` (wrap the
  `element.animate()` calls in a check, matching the pattern already used
  in the main site's `globals.css`).

---

## Final Phase: Verification pass

1. Re-run the exact reproduction from this bug report: apply to a real (or
   test) LinkedIn job, confirm accurate role/company capture, confirm a
   description is captured, confirm the dashboard shows it richly, confirm
   a bad-data entry can be deleted, confirm the column doesn't overflow
   unboundedly with many entries.
2. `node --input-type=module --check` every edited `.js` file.
3. `python3 -c "import json; json.load(open('extension/manifest.json'))"`
   after the version bump.
4. Repackage `public/streakhire-extension.zip`, rebuild the Next.js site
   (`npm run build`), redeploy to Azure (`az webapp deploy`), commit + push
   to `github.com/adarsh6980/streak-hire` — same release process used for
   every prior change this session.
5. Report back what changed in each phase and any DESIGN.md deviations
   that had to be made and why (there should be none, but call it out
   honestly if one was necessary).
