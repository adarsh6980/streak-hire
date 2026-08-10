# Plan 03 — Gmail-First Job Tracker (Core Product Redesign)

## Why this supersedes Plan 02

Plan 02 treated Gmail sync as a bolt-on second detection layer inside the browser extension. The actual requirement is bigger: **Gmail is the core of the product.** The tracker should build and maintain itself from the inbox — application confirmations, assessments, interviews, recruiter follow-ups, rejections, offers, document requests — with the extension reduced to an optional quick-capture tool for manual applications. That reframing changes where OAuth lives, where sync logic runs, and what "the product" even is (a full dashboard web app, not an extension popup).

**Core principle carried through every phase:** *"Connect Gmail once, and your job-search tracker builds and maintains itself."* Manual entry, the extension, and analytics enhance this — they are not the mechanism.

## Architecture decisions locked in during planning (with your input)

1. **Gmail OAuth moves to the website**, not the extension. The extension's existing `chrome.identity.launchWebAuthFlow` pattern only produces a token scoped to that browser session — it can't be "the core" if the core only works when that specific browser extension is installed and running. A standard Google web OAuth flow (redirect-based, `access_type=offline` + `prompt=consent` to get a refresh token) lives in the Next.js app instead, so the web app is self-sufficient.
2. **The Next.js site converts from static export to a real server**, still on Azure App Service `streakhire-web`, still **F1 Free tier ($0)** — no new Azure resource, no tier upgrade. This is required to have API routes at all (OAuth token exchange, Gmail sync, Gemini calls with a server-side secret key). Confirmed via research: F1 supports arbitrary Node apps (just shared/quota-limited compute — 60 CPU-min/day, 1 GB RAM, no "Always On," ~20 min idle unload). Given the design leans on **on-demand invocation** (button click / occasional scheduled call), not continuous background work, the lack of Always-On is an accepted tradeoff, not a blocker.
3. **Sync trigger — your call, per our discussion:** a **"Sync Gmail" button** in the dashboard is the guaranteed, always-available mechanism (zero infra, zero cost, works even if everything else is disabled). On top of that, a **free GitHub Actions scheduled workflow** (private repo, `cron`, every 3 hours, ~240 runs/month against a 2,000 min/month free allowance) calls a secured sync API route so the tracker updates itself without the user remembering to click anything — this is what actually delivers "maintains itself" without touching a paid tier or Cloud Functions/Blaze.
4. **AI provider: Gemini**, called server-side (API key never touches the client). Uses `responseMimeType: "application/json"` + `responseSchema` (Gemini API's structured-output mode) so extraction returns typed JSON directly — no fragile regex/keyword-only parsing. Two flagged tradeoffs, both explicit product decisions rather than technical unknowns (see "Open decisions" below).
5. **Firestore stays the database** (already free-tier, already the pattern) — extended with a wider status enum, a timeline sub-structure, and task/deadline records. No new datastore.
6. **Design system stays** (Sorting Facility / postal theme) — it fits an inbox-centric pivot well (stamps for status changes, "Airmail"/postmark motifs for an "Inbox Activity" section) rather than needing a from-scratch redesign. Scoped per-component in Phase 6.

## Open decisions to confirm before/while building (flagged explicitly, not silently assumed)

**A. Gmail OAuth in Testing mode issues refresh tokens that expire after 7 days.** Confirmed via Google's OAuth docs: unverified apps (consent screen in "Testing" publishing status — which Streakhire's is and should stay in until real public launch, per Plan 02's verification-cost findings) have test-user refresh tokens revoked after 7 days, producing `invalid_grant` on the next refresh attempt. This directly conflicts with "connect once, it maintains itself." **Recommendation for now (pre-launch, few users):** accept weekly re-auth — show a "Reconnect Gmail" banner when a refresh fails, one click to restore. Revisit alongside the Chrome Web Store submission item once ready to publish the OAuth consent screen for real (that unlocks long-lived refresh tokens but requires Google's restricted-scope verification, "potentially several weeks," per Plan 02's research). Flag this prominently in the dashboard/settings copy so it isn't a silent surprise — "may ask you to reconnect Gmail weekly while in early access."

**B. Gemini's free tier ToS states unpaid-tier input/output may be reviewed by humans and used to improve Google's models** — a real tension with treating job-application email content as sensitive (recruiter names, sometimes compensation details). **Recommendation:** minimize what's sent — never send full email body by default, only sender/subject/snippet plus the minimal metadata needed for classification (Gmail's `format=metadata` payload), and strip anything not needed for extraction before the API call. This reduces exposure without eliminating it. If you want a firmer privacy guarantee later, Gemini's paid tier is inexpensive at this volume (a personal inbox's job-related mail is a few hundred emails at most) and removes the training-data clause — worth a follow-up decision once real usage data exists, not a blocker now.

Both of these should also show up verbatim in the in-product privacy copy (Phase 7) — the requirement explicitly calls for privacy to be a visible product feature, not fine print.

---

## Phase 0 — Documentation Discovery (completed during planning)

Reuses all of Plan 02's Phase 0 findings (existing Firestore schema/REST patterns, `background.js` message-router pattern, `detector-utils.js` as the scraping source of truth, DESIGN.md's four named rules) — those don't change. New findings for this pivot:

- **Azure F1 as a real Node server**: confirmed supported (Microsoft Learn App Service Plans/pricing docs); Linux Node apps set their entrypoint via the "Startup Command" config field (e.g. `node server.js` or a Next.js custom server), no `web.config` needed (that's Windows/IIS-only). Deploy mechanics (`az webapp deploy --type zip`) are unchanged from the current static-export deploy — same command, different zip contents.
- **Google OAuth web-server flow**: `POST https://oauth2.googleapis.com/token` (code → access+refresh token exchange) is a plain `fetch`-able REST call, consistent with this project's existing no-SDK convention (mirrors how `identitytoolkit.googleapis.com` and `securetoken.googleapis.com` are already called raw from `extension/lib/auth.js`).
- **Gemini structured output**: `generateContent` REST endpoint, `generationConfig: { responseMimeType: "application/json", responseSchema: {...} }` — current Flash-class models (2.5 Flash / 2.5 Flash-Lite and newer) support it. Free-tier RPM/RPD numbers aren't published as a static doc anymore (Google routes you to a personalized AI Studio dashboard) — **reconfirm the live quota in AI Studio before Phase 3**, don't hardcode a number from this plan.
- **GitHub Actions scheduled workflows**: confirmed available on private repos on the free plan; minimum interval 5 minutes (we're using 3 hours, ample margin); ~240 min/month usage against a 2,000 min/month free allowance; scheduled workflows on repos with 60 days of no activity may get auto-disabled (docs explicitly confirm this for public repos, ambiguous-but-likely for private — mitigated automatically since this is an actively-developed repo).

---

## Phase 1 — Web-based Gmail OAuth (moves off the extension)

**Goal:** a user can connect their Gmail account directly on the website, independent of whether the extension is installed.

**What to implement:**
1. New Next.js Route Handlers (App Router convention — `src/app/api/auth/google/route.ts` for the redirect-out step, `src/app/api/auth/google/callback/route.ts` for the exchange) implementing the standard authorization-code flow: build the `https://accounts.google.com/o/oauth2/v2/auth` URL with `client_id` (reuse the existing `GOOGLE_WEB_CLIENT_ID` from `extension/lib/firebase-config.js` — same Web-application-type client works here, just needs this new redirect URI added in Cloud Console), `redirect_uri` pointing at the deployed site's callback route, `scope=openid email profile https://www.googleapis.com/auth/gmail.readonly`, `access_type=offline`, `prompt=consent`.
2. Callback route exchanges `code` for `{access_token, refresh_token, expires_in}` via `POST https://oauth2.googleapis.com/token` (plain `fetch`, copy the REST-only convention from `extension/lib/auth.js` rather than adding a Google auth SDK dependency).
3. Store the refresh token server-side in Firestore under the user's doc (e.g. `users/{uid}.gmail: { refreshToken, connectedAt, lastSyncedAt, status: "connected" | "needs_reconnect" }`) — this requires the web app to also do Firebase sign-in (reuse the existing Identity Toolkit REST pattern from `extension/lib/auth.js`, ported to a server route) so `uid` is known before writing. Do not store the refresh token in a client-readable Firestore field — write it through a server route using a Firestore *service-account* credential (not the user's ID token), since refresh tokens must never be exposed to client-side reads. This is a new server-side Firestore access pattern (using Google Application Default Credentials / a service account key), distinct from every existing client REST call in this project.
4. Access-token refresh (`POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token`) happens server-side, on-demand, right before a sync call — mirrors `extension/lib/auth.js`'s existing `refreshIdToken()` shape but for Google tokens instead of Firebase tokens.
5. Handle the 7-day Testing-mode expiry (Open Decision A): if a refresh attempt returns `invalid_grant`, set `gmail.status = "needs_reconnect"` and surface a reconnect banner (Phase 6) rather than failing silently.

**Documentation references:** `extension/lib/auth.js` (whole file — the REST-only exchange pattern to port, not a library to reuse directly since this now runs server-side, not in a service worker), `extension/lib/firebase-config.js:13` (existing Web-application OAuth client to extend with a new redirect URI, not a new client).

**Verification checklist:** complete a real OAuth round-trip against the deployed site; confirm a refresh token is actually returned (log its presence, never its value); confirm a second connect attempt without `prompt=consent` would *not* re-issue one (proves the param is load-bearing, matches documented Google behavior); confirm the token is unreadable via any client-side Firestore REST call using a normal user ID token (security check — this must fail).

**Anti-pattern guards:** never write the refresh token through a path a client ID-token can read. Never skip `prompt=consent` "to reduce friction" — it's the only thing guaranteeing refresh-token issuance. Do not introduce a Google Auth Node SDK — every existing Google integration in this project is raw REST, stay consistent.

---

## Phase 2 — Data model expansion (Firestore)

**Goal:** support the full pipeline (Applied → Received → Assessment → Interview → Offer / Rejected / Withdrawn), a timeline, and tasks — without breaking the existing extension's reads/writes.

**What to implement:**
1. Expand the `status` enum from the current 4 values (`applied|interviewing|offer|rejected`, enforced at `extension/dashboard/dashboard.js:52` and `extension/background.js:265-267`) to cover the full pipeline described in the spec. Proposed canonical set — confirm against the dashboard stat categories requested (Applied, Assessments, Interviews, Offers, Rejections, Awaiting response, Requiring action):
   `applied | received | assessment | interview | offer | rejected | withdrawn`
   ("Awaiting response" and "Requiring action" are **derived views**, not stored statuses — computed from `updatedAt` staleness and open tasks, respectively — don't add them as enum values or the enum becomes ambiguous with real state.)
   This enum must be updated in **every** place it's currently enforced (`dashboard.js:52`, `background.js:265-267`, and the new web-app equivalents) — grep for the literal array before changing it in only one place, this was flagged as a duplication risk in Plan 02 and still applies.
2. Add a `timeline` subcollection per application: `users/{uid}/applications/{appId}/timeline/{eventId}` — `{ label, stage, detectedAt, source: "gmail" | "manual" | "extension", sourceEmailId (nullable), confidence (nullable) }`. This directly serves the "each timeline event should show the source email and timestamp" requirement, and keeps raw email content out of the applications doc itself.
3. Add a `tasks` subcollection or array per application (start with an array field on the application doc — `tasks: [{ id, type: "assessment"|"interview"|"followup"|"document"|"background_check", label, dueAt, completed }]` — promote to a subcollection later only if an application accumulates enough tasks that array-size becomes a real concern, per the project's existing "don't build for hypothetical scale" convention).
4. Extend the application doc with the new fields the spec requires: `location, salary, applicationId (external, from ATS), recruiterName, recruiterEmail, jobPortal, importantLinks: []`. All additive, all optional — existing extension-created docs without these fields must continue to render correctly (dashboard code needs defensive `?? ""`/`?? null` handling, not a required-field assumption).
5. `gmailMessageId`/`matchConfidence` from Plan 02 carry over unchanged onto timeline entries instead of the top-level application doc (better fit now that there's a real timeline).

**Documentation references:** `extension/background.js:79-92` (current application doc shape — the base to extend, not replace), `extension/dashboard/dashboard.js:52` + `extension/background.js:265-267` (both enum-enforcement sites, must update together).

**Verification checklist:** load the existing (pre-migration) extension dashboard against the expanded schema and confirm nothing breaks for old-shape docs (missing new fields render as empty, not as errors). Write one application through the *old* extension code path and one through the *new* web sync path and confirm both are readable by both surfaces.

**Anti-pattern guards:** don't add "awaiting response" or "needs action" as stored status values — they're derived, storing them creates a second source of truth that drifts. Don't create a top-level `timelineEvents` or `tasks` collection outside the application's subcollection — keep the existing two-collection (`users`, `applications`) shape from growing into an unbounded number of top-level collections.

---

## Phase 3 — Gmail sync engine (server-side, in the Next.js app)

**Goal:** given a connected Gmail account, find job-related emails, classify them with Gemini, match to existing applications (or create new ones), and write timeline/status updates — idempotently.

**What to implement:**
1. New Route Handler, e.g. `src/app/api/sync/gmail/route.ts`, callable two ways: (a) authenticated user session hitting it from the "Sync Gmail" button, (b) the GitHub Actions scheduled workflow hitting a batch variant secured by a shared bearer secret (Phase 4) that iterates all connected users server-side.
2. **Candidate search** — port the `q`-based Gmail search approach from Plan 02 Phase 3, but broaden the term set to match the full pipeline (not just application/rejection): include assessment/interview/offer/document-request signal terms too. Keep the term list as one exported constant, easy to tune.
3. **Metadata fetch** — `format=metadata` with `metadataHeaders` for `From/Subject/Date` plus the `snippet` field already included in list/get responses; use the documented batch endpoint (`/batch/gmail/v1`, ≤50 parts recommended) to fetch a page of candidates in one round-trip, per Plan 02's Phase 0 findings — this reduces both latency and the number of billed API calls, mattering more now that sync also runs unattended via GitHub Actions.
4. **Classification via Gemini structured output** — one `generateContent` call per candidate (or batched into a single prompt covering several emails at once, cheaper and fewer round-trips; only fall back to per-email calls if a multi-email prompt proves unreliable in testing) with a `responseSchema` matching:
   `{ isJobRelated: boolean, type: "application_confirmation"|"assessment_invite"|"interview_invite"|"recruiter_followup"|"stage_update"|"rejection"|"offer"|"document_request"|"background_check"|"withdrawal"|"other", company: string|null, role: string|null, deadline: string|null (ISO date), interviewDateTime: string|null (ISO datetime), recruiterName: string|null, confidence: number }`
   Send only sender/subject/snippet (Open Decision B) — not full body — unless a follow-up "unclear, fetch full body" pass is explicitly justified per-message (worth a comment in code marking this as the deliberate minimal-data boundary, not an oversight).
5. **Matching/dedup** — reuse Plan 02's approach (case-insensitive company match against existing applications) but now also considering `role` similarity and recency, since the pipeline is richer: a rejection/interview/assessment email should update the *existing* application for that company+role, not create a new one; an `application_confirmation` with no match creates a new application; anything for a company+role that doesn't clearly match an existing app but also doesn't look like a fresh application (e.g. a bare "interview reminder" with no prior record) goes to a review queue rather than being guessed into either bucket — carries over Plan 02's confidence-tiered write logic (auto-apply high confidence, queue medium, discard low) unchanged in spirit, just across more event types now.
6. **Writes**: append a `timeline` entry always (Phase 2 schema); update `status` only when the event type maps to a status change (`rejection→rejected`, `offer→offer`, `interview_invite→interview`, `assessment_invite→assessment`, `withdrawal→withdrawn`); populate `tasks` entries for anything with a `deadline`/`interviewDateTime` (feeds the Action Centre in Phase 6).
7. Track processed message IDs per user (Plan 02's `gmailSync.processedMessageIds`, capped list) to keep sync idempotent across repeated manual + scheduled runs.

**Documentation references:** Plan 02 Phase 3 in full (the classification/matching/idempotency approach carries over structurally; only the event-type set and the classifier backend change), Gemini `generateContent` structured-output docs (`responseMimeType`/`responseSchema`) from this plan's Phase 0 research.

**Verification checklist:** run a sync against a real inbox containing at least one example of each pipeline stage (or a realistic seeded test inbox, since fabricating fake production data isn't allowed per PRODUCT.md — testing with the developer's own real applications, not invented ones, is the right approach here); confirm each maps to the correct status/timeline write; confirm re-running sync immediately produces zero duplicate writes; confirm a message with `isJobRelated: false` or low confidence is neither written nor endlessly re-queued.

**Anti-pattern guards:** no full-body fetch by default (Open Decision B). No stored raw email text beyond what's needed for display (a short extracted summary, not the source HTML/body). Don't invent status values outside Phase 2's enum. Don't call Gemini per-email if a batched prompt proves reliable — minimize call count given free-tier constraints.

---

## Phase 4 — Automatic + manual sync triggers

**What to implement:**
1. **Manual**: a "Sync Gmail" button in the dashboard (Phase 6) calling `POST /api/sync/gmail` with the logged-in user's session — always available regardless of the automatic layer's health.
2. **Automatic**: a `.github/workflows/gmail-sync.yml` scheduled workflow (`cron: '0 */3 * * *'`) that `curl`s a batch-sync endpoint (`POST /api/sync/gmail/batch` or similar) with `Authorization: Bearer ${{ secrets.SYNC_TOKEN }}` — the endpoint validates that bearer secret (stored as an Azure App Service application setting, matching the GitHub Actions repo secret) before iterating connected users server-side. This is the "maintains itself" mechanism, confirmed free (Phase 0 research: ~240 min/month against 2,000 free) and confirmed available on private repos.
3. Dashboard shows `lastSyncedAt` (from `users/{uid}.gmail.lastSyncedAt`) so the user can see the automatic layer is actually working, not just trust it silently.

**Documentation references:** GitHub Actions `schedule` trigger docs and secrets docs (this plan's Phase 0 research); Azure App Service application settings (existing deploy already sets some env-style config for the current static server, extend that pattern rather than introducing a new config mechanism).

**Verification checklist:** manually trigger the GitHub Actions workflow once (`workflow_dispatch` as a secondary trigger alongside `schedule`, for on-demand testing without waiting 3 hours) and confirm it reaches the endpoint and a sync actually runs; confirm the endpoint rejects requests without the correct bearer token (401, not a silent no-op).

**Anti-pattern guards:** never expose the batch-sync endpoint without the bearer-secret check — an unauthenticated endpoint that triggers Gemini calls and Firestore writes for arbitrary users is a real abuse vector. Don't schedule tighter than every 3 hours "for freshness" without re-checking the Gemini free-tier quota headroom first.

---

## Phase 5 — Duplicate detection & manual editing

**What to implement:**
1. Formalize Phase 3's matching logic into an explicit dedup function shared by both the Gmail sync path and the extension's manual "Add to Tracker" capture (Phase 6) — same company+role fuzzy-match logic, one implementation, not two that can drift (this directly answers the spec's "same application may generate many emails... avoid duplicate tracker entries" requirement, and also covers "another position at the same company" by keying on company+role together, not company alone).
2. Manual-edit surfaces on the application detail page (Phase 6): edit company/role/location/salary/recruiter/notes/links, change status, add interview notes, archive. These write through the same Firestore update path Gmail sync uses (`updateApplication`-equivalent) — a manual edit and an AI-detected update are the same operation with a different `source` tag on the resulting timeline entry, not two different code paths.
3. A manual correction to an AI-classified field (e.g. user fixes a wrong company name) should be treated as authoritative going forward — store a flag (e.g. `companyManuallySet: true`) so a future Gmail sync doesn't silently overwrite a user's correction with a lower-confidence guess.

**Documentation references:** Phase 3's matching logic (the function to extract/share, not duplicate).

**Verification checklist:** simulate two emails for the same company+role (e.g. confirmation then rejection) and confirm one application, two timeline entries. Simulate two emails for the same company but different roles and confirm two separate applications. Manually edit a company name, then run a sync with a low-confidence guess for the same application, confirm the manual value isn't overwritten.

**Anti-pattern guards:** don't implement matching twice (extension capture vs. Gmail sync) — one shared function, called from both.

---

## Phase 6 — Web app UI (the primary product surface)

**Goal:** build the actual dashboard described in the spec, within the existing design system.

**What to implement (sidebar-navigated Next.js app routes, e.g. `src/app/(app)/dashboard`, `/applications`, `/action-centre`, `/calendar`, `/companies`, `/analytics`, `/inbox-activity`, `/extension`, `/settings`):**

1. **Dashboard home**: stat cards (Total, Applied, Assessments, Interviews, Offers, Rejections, Awaiting response — derived as "no timeline event in N days," Requiring action — derived as "has an incomplete task"), a "recent updates" feed (latest timeline entries across all applications), an upcoming-deadlines strip.
2. **Applications**: list + board view (port the existing list/board toggle pattern from `extension/dashboard/dashboard.js:293-306` — it's a good pattern, reuse the structure, not the DOM-cloning implementation verbatim since this is now a React app), search/filter by company/position/status/location/date/platform/upcoming-action/recruiter.
3. **Application detail page**: tabs/sections for Overview, Timeline (Phase 2's subcollection, rendered chronologically with source-email + timestamp per the spec), Emails (list of linked message references — subject/date/type, not raw content), Tasks, Notes, Job Description (saved at capture time).
4. **Action Centre**: pulls all incomplete `tasks` across applications sorted by `dueAt`, one line each ("Assessment due tomorrow," "Interview scheduled Wednesday at 2 PM").
5. **Calendar**: same task/deadline data, calendar-rendered instead of list-rendered — same underlying query, different view, don't build a second data path for it.
6. **Companies**: group-by-company aggregate view over the applications collection (computed client-side or in a lightweight API route — no new collection, per Phase 2's guard against unbounded new collections).
7. **Analytics**: applications-this-week, by-status breakdown, response rate (has any status change past `applied`), interview conversion rate, offer conversion rate, most-active companies, activity-over-time — all derivable from existing application + timeline data, no new tracking needed.
8. **Inbox Activity**: a feed specifically of Gmail-sourced timeline entries (a filtered view of the same timeline data used elsewhere) — ties naturally into the postal/mail design theme.
9. **Extension**: status page (installed? connected?) plus the existing download flow already on the marketing site (`#install` section, `public/streakhire-extension.zip`, the `externally_connectable` ping-detection already built) — port that existing mechanism rather than rebuilding it.
10. **Settings**: Gmail connection status + reconnect button (surfaces Open Decision A's weekly-reconnect reality directly, not hidden), data/privacy controls (Phase 7), manual sync button, notification preferences.
11. Apply DESIGN.md's four named rules throughout (Tilt-Not-Lift, No-Kicker, Mono-Means-System, One-Loud-Color) — this is a large new surface area, easy to drift from the system without deliberate checks per component.

**Documentation references:** `extension/dashboard/dashboard.js` (existing list/board/filter/search patterns — the interaction design to port into React, not the vanilla-JS DOM code itself), `DESIGN.md` (all four named rules, full file).

**Verification checklist:** every new route reachable from the sidebar; every stat/derived value spot-checked against raw Firestore data for at least one real account; responsive check at mobile width (spec explicitly calls for mobile-friendly layouts); dark/light mode check (spec explicitly calls for both).

**Anti-pattern guards:** no eyebrow/kicker labels (No-Kicker Rule) on any of these new section headings — easy to reach for out of habit in a "SaaS dashboard" and explicitly banned system-wide. No hover-lift shadows on cards (Tilt-Not-Lift Rule).

---

## Phase 7 — Browser extension repositioning

**Goal:** the extension becomes a secondary quick-capture tool, not the detection engine.

**What to implement:**
1. Simplify `extension/content-scripts/*` from silent submit-detection (the current LinkedIn/Greenhouse/Lever/Workday/generic auto-detect logic) to an on-page **"Add to Tracker"** affordance — reuse `extension/lib/detector-utils.js`'s existing scraping logic (role/company/description extraction, already documented as the shared source of truth) to populate the capture, but trigger it on user click, not automatically on submit-detection. This is a significant scope reduction of the existing detection code, not a rewrite of the scraping logic itself.
2. The existing `universal-widget.js` floating-widget concept maps naturally onto this — repurpose it as the visible "Add to Tracker" trigger on any page heuristically identified as a job listing, rather than a silent-detection fallback.
3. Extension no longer owns Gmail OAuth (Phase 1 moved that to the web app) — the extension's `chrome.identity` flow narrows back to just Firebase sign-in (`openid email profile`, matching the pre-Plan-02 scope), used only to identify which account a manually-captured application belongs to.
4. Popup (`extension/popup/popup.js`) simplifies to: sign-in state, a link to the full web dashboard, and the manual capture button — the streak/recent-applications mini-view can stay if still wanted as a quick-glance feature, but the dashboard is no longer inside the extension's own `dashboard/` pages long-term (those get superseded by the web app's `/applications` etc. routes — decide whether to delete `extension/dashboard/` once the web app covers its functionality, or keep it as a lightweight offline-capable fallback; lean toward deleting once web parity is confirmed, per the project's existing "don't keep half-finished/duplicate implementations" convention).

**Documentation references:** `extension/lib/detector-utils.js` (scraping logic to reuse, unchanged), `extension/content-scripts/universal-widget.js` (existing floating-widget mechanism to repurpose).

**Verification checklist:** manual capture on each of the 4 named ATS platforms + a generic page produces a correctly-populated application; capture writes to the same Firestore schema (Phase 2) the web app reads.

**Anti-pattern guards:** don't maintain two parallel dashboards (extension's `dashboard/` and the new web app) long-term — pick one source of truth once parity is reached, per the project's stated aversion to half-finished duplicate implementations.

---

## Phase 8 — Privacy (product feature, not fine print) & rollout

**What to implement:**
1. A visible, plain-language privacy section (Settings page, Phase 6) covering exactly what the spec asks for: what Gmail permissions are requested (`gmail.readonly` — read-only, cannot send/delete/modify mail), what's analyzed (sender/subject/snippet, not full body by default — Open Decision B stated plainly), whether email content is stored (short extracted summaries only, not raw email text/HTML), how to disconnect Gmail (button, revokes locally and links to Google's own permission-revocation page), how to delete data (an actual delete-my-data action, not just a support-email promise).
2. State the weekly-reconnect reality (Open Decision A) here too, framed honestly rather than hidden.
3. Manifest/host_permissions update for the extension's narrower scope (Phase 7) — remove any permissions no longer needed once Gmail OAuth leaves the extension.
4. Rollout stays gated exactly as Plan 02 already established: OAuth consent screen stays in **Testing** mode (≤100 test users, no verification needed) until a real public launch is actually planned — at which point `gmail.readonly` verification (weeks-long, per Plan 02's research) and Chrome Web Store submission become the two linked blockers, both already tracked in `HANDOFF.md`'s "not done yet" list.

**Verification checklist:** privacy section reachable within 2 clicks from the dashboard; delete-my-data action actually removes the user's Firestore docs (test against a throwaway test account, not a real one); confirm no paid tier was touched anywhere in this plan (Firestore free, Azure F1 free, GitHub Actions free, Gemini free-or-consciously-paid per Open Decision B) — re-verify explicitly before calling any phase done, this was the hard constraint the whole architecture was built around.

---

## Suggested build order

Phase 1 (OAuth) and Phase 2 (schema) first — everything else depends on both. Phase 3 (sync engine) next, verified against a real inbox before any UI is built around it (verify the data is *right* before building screens to display it). Phase 4 (triggers) once Phase 3 is trustworthy. Phase 6 (UI) can start in parallel with Phase 3 once Phase 2's schema is stable, since UI can be built against realistic seeded data before live sync is wired in. Phase 7 (extension) and Phase 5 (dedup formalization) last — they depend on the sync engine's matching logic existing first. Phase 8 (privacy) threads through Phase 1 and 6, but the explicit privacy-copy writing can happen anytime once the OAuth scope and data-retention decisions (Open Decisions A/B) are final.
