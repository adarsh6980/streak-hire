> **Superseded by [`03-gmail-first-tracker-redesign.md`](./03-gmail-first-tracker-redesign.md).** After this plan was written, the product direction changed: Gmail integration is now the *core* of the product (not a second detection layer bolted onto the extension), the web app becomes the primary surface, and OAuth/Gmail sync move server-side into the Next.js app instead of living only in the extension's `chrome.identity` flow. Kept here for its Phase 0 research (still accurate) and as a record of the incremental-add framing that came before the pivot.

# Plan 02 — Gmail-Based Application & Rejection Detection

## Why

The current detection layer (per-site content scripts scraping LinkedIn/Greenhouse/Lever/Workday/generic pages) only sees the *submission* moment. It structurally cannot see what happens after — an outcome email arrives in Gmail, not on a page the extension is watching. The user has found this gap makes the tracker feel low-value in practice: it logs applications but never closes the loop to "rejected." This plan adds Gmail as a second, complementary detection layer: read-only scanning of the signed-in user's inbox to (a) catch application-confirmation emails the page-scraper missed, and (b) — the actually new capability — detect rejection emails and auto-move the matching application to `status: "rejected"`.

This is additive, not a replacement. Content-script scraping stays (it's still the fastest, most detailed source for role/description text at the moment of applying); Gmail sync becomes the mechanism that keeps `status` honest over time.

## Phase 0 — Documentation Discovery (completed during planning)

Findings that constrain every phase below:

**Existing OAuth (`extension/lib/auth.js`, `extension/lib/firebase-config.js`):**
- Flow: `chrome.identity.launchWebAuthFlow` → Google's `https://accounts.google.com/o/oauth2/v2/auth` → token parsed from redirect hash → exchanged via Firebase Identity Toolkit REST (`identitytoolkit.googleapis.com/v1/accounts:signInWithIdp`).
- Current scope string (`auth.js:20`): `"openid email profile"` — no Gmail scope.
- OAuth client is a **Web application**-type client (`GOOGLE_WEB_CLIENT_ID` in `firebase-config.js:13`), required because `launchWebAuthFlow` (not `chrome.identity.getAuthToken`) is used for cross-browser (Comet/Edge/Brave) support.
- Session cached in `chrome.storage.local["pounce_auth"]`: `{uid, idToken, refreshToken, expiresAt, profile}`. No raw Google access token is persisted today (only the Firebase ID token) — this matters for Phase 1.

**Gmail API (external research, developers.google.com):**
- `gmail.readonly` vs `gmail.metadata`: metadata is headers/snippet/labels only, no body — but **the `q` search parameter cannot be used with `gmail.metadata`-scoped tokens**. Without `q`, there's no way to cheaply narrow "job-related" mail out of a full inbox. → **Decision: request `gmail.readonly`**, not `gmail.metadata`, despite being the broader scope, because query-narrowing is load-bearing for a client-only extension with no backend to pre-index mail.
- Multiple scopes can be requested in one `launchWebAuthFlow` consent screen (space-delimited `scope` param) against the *same* Web-application OAuth client already in use — no new client, no incremental-consent flow needed.
- `users.messages.list` supports `q` with the same syntax as Gmail search (`from:`, `subject:`, `newer_than:`, etc.); returns only `{id, threadId}` — a `users.messages.get` per message is still required to read headers/snippet.
- `users.messages.get?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date` keeps each fetch small (no body) even under `gmail.readonly`.
- Batch endpoint exists (`POST /batch/gmail/v1`, ≤100 parts, Google recommends ≤50) — reduces round-trips for a sync that fetches many message details per run.
- Quota: free within limits (80M units/day/project, 6,000 units/min/user) — a periodic personal-inbox sync is nowhere near this.
- **`gmail.readonly` is a restricted scope** — real (non-test) users require Google's brand + data-access verification + a security assessment, "potentially several weeks." **Streakhire is pre-launch and not on the Chrome Web Store yet** (per `HANDOFF.md`), so the OAuth consent screen can stay in **Testing** mode (up to 100 explicitly-added test users, no verification required) for as long as it isn't public. This is a hard gate on wider rollout, not on building/using the feature now.

**Firestore (`extension/lib/firestore.js`, `extension/background.js`):**
- No backend server exists anywhere in this project — everything is client-side `fetch` from `background.js` (Firestore REST + Identity Toolkit REST). Gmail sync must follow the same pattern: **the extension's service worker calls the Gmail API directly**, no new backend/Cloud Function.
- Application doc fields (`background.js:79-92`): `company, role, description, url, source, auto, status, appliedAt, resumeFileName, notes, followUpDone, followUpNotifiedAt`.
- `status` is a closed 4-value enum enforced in two places (`dashboard.js:52`, `background.js:265-267`): `applied | interviewing | offer | rejected`. Gmail sync only ever needs to write `applied` (new) or `rejected` (update) — it must never invent a 5th status value.
- Existing periodic-task pattern: `chrome.alarms` already used for `FOLLOW_UP_ALARM` (720 min) and `DIGEST_ALARM` (10080 min), created in `onInstalled` (`background.js:509-513`), dispatched in one `chrome.alarms.onAlarm` listener (`background.js:490-493`). Gmail sync should add a third alarm to this exact same pattern, not invent a new polling mechanism.
- Message router (`background.js:415-488`) is a single `switch` on `message.type` — new message types (e.g. `SYNC_GMAIL_NOW`, `CONFIRM_GMAIL_MATCH`) slot in the same way as the 12 existing ones.

**Dashboard/popup UI (`extension/dashboard/dashboard.js`, `popup/popup.js`):**
- Source badges already exist and are driven by a `SOURCE_LABELS`-style map (`dashboard.js:54-68`, `humanizeSource()`) rendering into `.row-badge`/`.card-badge` — adding `"gmail"` as a new source value needs **no new markup**, just a map entry (mirrored into `popup.js` if it needs the same map — currently popup.js doesn't have one).
- No existing "review queue" or "pending confirmation" UI pattern exists yet — this is new for Phase 4.

**Design constraints (`DESIGN.md`):**
- No-Kicker Rule, Mono-Means-System Rule, Tilt-Not-Lift Rule, One-Loud-Color Rule all apply to any new UI (badges, toggle, review-queue rows) — no shadows beyond `shadow-stamp`, Space Mono only for the systemic bits (timestamps, badges), Postmark Red stays the only saturated accent.

**Product constraint (`PRODUCT.md`):** "Zero manual effort is the whole pitch." This is in direct tension with wanting a human-reviewed queue for uncertain matches (see Phase 3 decision below) — resolved by auto-applying only high-confidence matches and queuing only the genuinely ambiguous ones, so the common case stays zero-effort.

---

## Phase 1 — OAuth scope extension

**Goal:** the extension can obtain a Google access token that is valid against `gmail.googleapis.com`, without breaking the existing Firebase sign-in flow.

**What to implement:**
1. In `extension/lib/auth.js`, change the scope string at line 20 from `"openid email profile"` to `"openid email profile https://www.googleapis.com/auth/gmail.readonly"`. Copy the existing space-delimited pattern — do not invent a different scope-passing convention.
2. Currently only the Firebase ID token is persisted (`chrome.storage.local["pounce_auth"]`); the raw Google `access_token` obtained in `getGoogleAccessTokenViaWebAuthFlow()` is used once for the Identity Toolkit exchange and then discarded. It must now also be **persisted** (alongside its own expiry) so Gmail API calls can reuse it, since Gmail's REST API does not accept the Firebase ID token — it needs the Google OAuth access token directly, Bearer-authenticated.
3. Google OAuth access tokens from `launchWebAuthFlow` expire in ~1 hour with no refresh token in the implicit (`response_type=token`) flow used here. Since `launchWebAuthFlow({interactive: false})` is already used for silent refresh (see `refreshIdToken`/re-auth pattern in `auth.js`), reuse that same silent-refresh call to re-mint a Google access token when the Gmail-scoped one has expired, mirroring the existing `expiresAt` check pattern (`auth.js:114-125`) rather than building a second refresh mechanism.
4. In Google Cloud Console (manual step, not code): add `.../auth/gmail.readonly` to the OAuth consent screen's scope list, confirm the consent screen stays in **Testing** publishing status, and add the user's own Google account (and any other real test users) to the test-user list.

**Documentation references:** `extension/lib/auth.js:13-107` (whole file is the pattern to extend, not replace); Google OAuth2 Web Server docs on space-delimited multi-scope requests.

**Verification checklist:**
- Sign out, sign in again with `interactive: true`; confirm the consent screen now shows a Gmail read-only permission line.
- After sign-in, manually `fetch` `https://gmail.googleapis.com/gmail/v1/users/me/profile` with the stored access token from `chrome.storage.local` and confirm a 200 response (not 401/403).
- Confirm the existing Firestore/Firebase flows (sign-in, `GET_STATE`, logging an application) still work unmodified — this is an additive scope change, not a rewrite.

**Anti-pattern guards:** do not switch to `chrome.identity.getAuthToken` (breaks Comet/non-Chrome support, this was a deliberate prior decision per `HANDOFF.md`). Do not create a second OAuth client. Do not request `gmail.metadata` "to be more minimal" — established above that `q` search requires `gmail.readonly`.

---

## Phase 2 — Firestore schema additions

**Goal:** track what's already been processed so sync is idempotent, and record enough about a Gmail-sourced match to show it in the UI without re-fetching the email.

**What to implement:**
1. New field on the user doc (written via the existing `setUserDoc` pattern, `firestore.js:95-104`): `gmailSync: { lastSyncedAt, lastHistoryId, processedMessageIds: [...] }`. Copy the existing `PATCH ... ?updateMask.fieldPaths=` pattern used elsewhere in this file — do not add a new REST helper shape.
   - `processedMessageIds` prevents reprocessing the same email on every alarm run. Cap its stored size (e.g. keep last ~500 IDs) to avoid unbounded doc growth — Firestore doc size limits and the free-tier read/write economics both favor a bounded list over an ever-growing one.
2. Extend the application doc shape (written via `addApplication`/`updateApplication`, same as every other field) with two new optional fields: `gmailMessageId` (string, the Gmail message that triggered creation or the rejection update) and `matchConfidence` (number 0–1, only present on Gmail-sourced writes). Do **not** store email body/subject text in Firestore — store only the extracted `company`/`role`/`status` plus the message ID as a reference, per the privacy stance in Phase 5.
3. `source` field gets a new value: `"gmail"` (joins existing values like `"linkedin"`, `"manual-scrape"`, `"import"` — confirm the exact existing value set by grepping `background.js` before adding, don't guess a new naming convention).

**Documentation references:** `extension/lib/firestore.js:95-124` (PATCH/updateMask pattern to copy exactly), `extension/background.js:79-92` (application doc field list to extend, not restructure).

**Verification checklist:** write a test user doc update via the existing pattern and confirm `firestore.rules` (`extension/firestore.rules`) doesn't reject the new fields (rules are keyed by uid ownership, not by field allow-list, per Phase 0 findings — but re-read the rules file to confirm before assuming).

**Anti-pattern guards:** do not create a new top-level Firestore collection for "Gmail matches" — extend the existing `applications` subcollection and `users/{uid}` doc, matching the project's existing two-collection shape.

---

## Phase 3 — Sync + classification logic (background.js)

**Goal:** on a recurring alarm, pull recent job-related mail, classify it, match it to existing applications, and write the result — auto-applying confident matches, queuing ambiguous ones.

**What to implement:**

1. **New alarm**, following the exact existing pattern (`background.js:509-513`, `490-493`): `GMAIL_SYNC_ALARM = "streakhire-gmail-sync"`, created in `onInstalled` at a period like `periodInMinutes: 180` (3x/day — frequent enough to catch rejections promptly, far under quota), dispatched from the same `chrome.alarms.onAlarm` listener. Also add a manual-trigger message type (`SYNC_GMAIL_NOW`) through the existing router switch (`background.js:415-488`) so the popup/dashboard can offer a "sync now" button, mirroring how `SCRAPE_AND_LOG_ACTIVE_TAB` already offers a manual fallback next to automatic detection.

2. **New module** `extension/lib/gmail.js` (sibling to `lib/firestore.js`, `lib/auth.js` — same "thin REST wrapper, no SDK" convention):
   - `listCandidateMessages(accessToken, sinceHistoryId | sinceDate)` — calls `users.messages.list` with a `q` built from an allowlist of signal terms, e.g. something like `(subject:"application" OR subject:"applying" OR subject:"regret" OR subject:"unfortunately" OR subject:"not moving forward" OR subject:"other candidates" OR from:greenhouse.io OR from:lever.co OR from:myworkday.com) newer_than:Nd`. Keep the term list in one exported constant so it's easy to tune later.
   - `getMessageMetadata(accessToken, messageId)` — calls `users.messages.get?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date` (cite the exact param repetition pattern from the Gmail API docs, `metadataHeaders` is repeated per-header, not comma-joined).
   - Prefer the batch endpoint (`/batch/gmail/v1`) for fetching metadata across a page of candidate IDs — cite the multipart/mixed batch format from Gmail API docs, don't hand-rig a different batching scheme.

3. **Classifier** (pure function, easily unit-testable even without a test framework — keep it side-effect-free): given `{from, subject, snippet}`, return `{ type: "application" | "rejection" | "none", company, confidence }`.
   - Rejection keyword set (case-insensitive, on subject + snippet): "regret to inform", "not moving forward", "decided to move forward with other candidates", "pursue other candidates", "will not be moving forward", "unable to offer you", "position has been filled". Require **at least one rejection phrase AND the sender/subject containing a company-shaped signal** (not just "unfortunately" alone — too many false positives from unrelated mail) before returning `type: "rejection"`.
   - Application-confirmation keyword set: "application received", "thank you for applying", "we've received your application", "your application to", OR sender domain matches a known ATS (`greenhouse.io`, `lever.co`, `myworkday.com`, `linkedin.com` — reuse the same site list `detector-utils.js` already encodes, don't create a second list that can drift out of sync).
   - Company extraction: prefer the sender's display name / domain (strip common ATS subdomains like `no-reply@`, `hire@`) over parsing free text out of the subject — this mirrors the "structural signal first" ordering already used in `detector-utils.js`'s scraping fallback chain.
   - Confidence scoring: exact ATS-domain match + explicit phrase = high confidence (auto-apply); phrase-only or fuzzy company match = medium (queue for review); anything weaker = discard, don't queue (avoid queue noise that defeats the zero-effort pitch).

4. **Matching to existing applications:** for a classified email, find existing `applications` docs where `company` (case-insensitive, trimmed) matches the extracted company. Reuse `LIST_ALL_APPLICATIONS`'s existing fetch (`background.js:280-285`) rather than adding a second application-listing code path.
   - Rejection + match found + high confidence → `updateApplicationStatus` to `"rejected"`, stamp `gmailMessageId`.
   - Application-confirmation + no match found + high confidence → `logApplication`-equivalent create with `source: "gmail"`, `auto: true`, `status: "applied"`.
   - Anything medium-confidence (either type) → write to a new small pending-review list (could live as another array field on the user doc, e.g. `gmailSync.pendingReview: [{messageId, company, role, guessedType, confidence}]`, capped at a small size) instead of writing/mutating an application directly — Phase 4 surfaces this for one-tap confirm/dismiss.
   - After processing, append the message ID to `processedMessageIds` regardless of outcome (including discards) so it's never re-evaluated.

**Documentation references:** `background.js:79-110` (`logApplication` — copy the write shape), `background.js:287-293` (`updateApplicationStatus` — copy exactly, do not write `status` through any other path), `detector-utils.js` (existing ATS site list — the single source of truth to reuse, per the file's own documented "shared scraping logic" role).

**Verification checklist:**
- Manually trigger `SYNC_GMAIL_NOW` against a real inbox with at least one known rejection email and one known application-confirmation email; confirm the correct Firestore writes happen and no duplicate application is created for the rejection case.
- Re-trigger sync immediately after; confirm `processedMessageIds` prevents reprocessing (no duplicate writes, no duplicate pending-review entries).
- Confirm a message that only weakly matches (e.g. contains "unfortunately" in an unrelated context) is discarded, not queued or auto-applied.

**Anti-pattern guards:** no LLM/AI classification call in this phase — there is no backend to host one and no product justification yet for the added complexity/cost; heuristics-first per the plan brief. Do not invent a 5th `status` value (e.g. `"gmail-pending"`) — pending-review items are *not* applications yet, they live in the separate `pendingReview` list until confirmed, keeping the `status` enum exactly as `background.js:265-267` already enforces it.

---

## Phase 4 — Dashboard & popup UI

**Goal:** make Gmail sync visible, controllable, and reviewable without violating the existing design system.

**What to implement:**
1. **Source badge**: add `"gmail"` to whatever labeling map produces `.row-badge`/`.card-badge` text in `dashboard.js` (`humanizeSource()`-equivalent, `dashboard.js:54-68`) — copy the existing map-entry pattern exactly (e.g. `"gmail": "Gmail"`), no new markup needed since the badge element already renders conditionally off this map.
2. **Connect/sync toggle** in `popup/popup.js`: a settings affordance (e.g. inside the existing popup's signed-in view) showing Gmail sync status (on/off, last synced time) and a manual "Sync now" button that sends `SYNC_GMAIL_NOW`. Since granting the Gmail scope is a bigger permission ask than the base sign-in, make this **opt-in** — don't request the Gmail scope silently during normal sign-in; gate it behind an explicit "Enable Gmail sync" action so the OAuth consent screen only appears when the user deliberately opts in. This also means Phase 1's scope change should only apply on the *reauth* flow triggered by this toggle, not unconditionally on every sign-in — revisit Phase 1 step 1 to make the scope conditional rather than always-requested.
3. **Pending-review list** in the dashboard: a small section (new, following the existing `#followup-banner`/`#followup-list` pattern at `dashboard.js:248+` for structure) listing `gmailSync.pendingReview` entries with one-tap "Confirm" (writes the application/status update, same as Phase 3's high-confidence path) and "Dismiss" (removes from the pending list, adds message ID to `processedMessageIds`). New message types `CONFIRM_GMAIL_MATCH` / `DISMISS_GMAIL_MATCH` through the existing router pattern.
4. Apply DESIGN.md rules to all new elements: no eyebrow/kicker label on the pending-review section heading (No-Kicker Rule), Space Mono only for the timestamp/badge/button text, Postmark Red reserved for the confirm action only if it's the primary CTA in that row (One-Loud-Color Rule), no hover-lift shadow on the toggle or review rows (Tilt-Not-Lift Rule — reuse `shadow-stamp` sparingly if any stamped/pressed affordance is added, otherwise no shadow at all).

**Documentation references:** `dashboard.js:54-68` (badge map), `dashboard.js:248+` (existing banner/list pattern to copy structurally), `DESIGN.md:106,124,125,143` (the four named rules, quoted in Phase 0 above).

**Verification checklist:** load the dashboard/popup mock-server pattern already established in this project (per `HANDOFF.md`'s verification-pattern note: mock `chrome.runtime.sendMessage` in a throwaway copy, serve via local static server, verify visually, delete the throwaway copy — never commit it) and confirm the badge, toggle, and pending-review rows render correctly in both signed-out and signed-in-without-Gmail-sync and signed-in-with-Gmail-sync states.

**Anti-pattern guards:** do not add a new shadow variant. Do not add an eyebrow label above the pending-review heading. Do not make Gmail sync default-on — it must be an explicit opt-in given the broader scope.

---

## Phase 5 — Privacy, manifest, and rollout

**What to implement:**
1. `extension/manifest.json` host_permissions: add `https://gmail.googleapis.com/*` alongside the existing 6 job-site + 3 Google-auth-endpoint entries (`manifest.json:36-47`) — same list-extension pattern, not a broad `<all_urls>`-style grant (that's reserved for the universal content script, a different permission entirely).
2. Bump `extension/manifest.json` version per the project's established convention (every extension change bumps the version — see repo-level convention already documented), then rebuild `public/streakhire-extension.zip` via the exact zip command already documented, rebuild the Next.js site, repackage `azure-deploy/`, and redeploy via `az webapp deploy` — reuse the exact sequence already established in this project rather than improvising a new build/deploy path.
3. Write a short Gmail-data-handling section for whatever privacy policy currently exists (or note if one needs to be created for the first time — check `public/` and site pages for an existing privacy policy page before assuming none exists) stating: read-only access, no email body stored, only extracted company/role/status + message ID reference retained, user can revoke access anytime via Google Account permissions and via the in-app toggle.
4. **Rollout gate**: keep the Google Cloud OAuth consent screen in **Testing** publishing status (Phase 1 finding) until/unless Streakhire goes through Chrome Web Store submission and real public rollout — at which point `gmail.readonly`'s restricted-scope verification (brand verification + data-access justification + security assessment, "potentially several weeks" per Google's docs) becomes a prerequisite. This is an explicit, currently-known future blocker, not something to solve in this plan — flag it in `HANDOFF.md`'s "What's NOT done yet" section once this feature ships, alongside the existing Chrome Web Store item.
5. Gmail sync ships as an **additive, opt-in layer** — content-script scraping is not removed or deprecated by this plan. Revisit whether scraping should be de-scoped only after Gmail sync has real usage data justifying it (avoiding the exact "no fabricated confidence" problem `PRODUCT.md` already guards against).

**Verification checklist:** confirm `manifest.json` is valid JSON after the host_permissions edit (existing project convention: validate with Python's `json` module before shipping). Confirm the zip/build/deploy sequence completes without error and the new version number is reflected on the live site's download link.

**Anti-pattern guards:** do not submit to the Chrome Web Store as part of this plan (out of scope, needs the user's own paid developer registration per existing project notes). Do not silently move the consent screen to "In production" — that's what triggers the verification requirement.

---

## Final Phase — Verification

1. Re-read Phases 1–5's verification checklists as a single pass; confirm every item was actually checked, not assumed.
2. `grep` the codebase for the closed `status` enum (`applied|interviewing|offer|rejected`) and confirm no new code path writes any other value.
3. Syntax-check every changed `.js` file with `node --input-type=module --check` (existing project convention, since the extension has no automated test suite and no build step).
4. Manually walk the full loop once end-to-end on a real (or realistic test) inbox: enable Gmail sync → confirmation email creates an application → rejection email for the same company later updates that application to `rejected` → dashboard badge and status both reflect it correctly → no duplicate writes on a second sync.
5. Confirm nothing in this plan required a paid tier anywhere (Firebase Spark, Azure F1, Gmail API free quota) — this is a hard constraint from `HANDOFF.md`, re-verify explicitly before calling the plan done.
