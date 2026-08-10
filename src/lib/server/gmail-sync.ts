// Core Gmail sync + AI-classification engine. Reusable on purpose: both
// src/app/api/sync/gmail/route.ts (this task, triggered by a logged-in
// user) and a later Phase 4 unattended batch-trigger route call the same
// syncGmailForUser(uid) function, so nothing in here may assume a live user
// session / idToken — every Firestore read or write goes through the
// service-account-authenticated admin path in firestore-admin.ts, per that
// file's own header comment on why the Gmail refresh token (and, by
// extension, everything this engine touches) is stored outside the reach of
// Firestore Security Rules.

import {
  adminGetUserGmailConnection,
  adminPatchUserFields,
  adminListApplications,
  adminCreateApplication,
  adminUpdateApplication,
  adminAddTimelineEvent,
  type AdminApplicationRecord,
} from "@/lib/server/firestore-admin";

// ---------------------------------------------------------------------------
// Status enum — the ONLY 7 values ever written to an application's `status`
// field. Mirrors extension/dashboard/dashboard.js's STATUSES constant
// exactly; never add an 8th value here without updating that file too.
// ---------------------------------------------------------------------------
export const APPLICATION_STATUSES = [
  "applied",
  "received",
  "assessment",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Gmail search signal terms
// ---------------------------------------------------------------------------

const JOB_SIGNAL_PHRASES = [
  // confirmation
  "application received",
  "thank you for applying",
  "we've received your application",
  // assessment
  "online assessment",
  "coding test",
  "complete your assessment",
  // interview
  "interview invitation",
  "schedule your interview",
  "invite you to interview",
  // rejection
  "regret to inform",
  "not moving forward",
  "other candidates",
  "unable to offer you",
  "position has been filled",
  // offer
  "pleased to offer",
  "offer of employment",
  "job offer",
  // document / background check
  "additional documents",
  "background check",
];

// Same ATS domain strings the extension already ships (extension/manifest.json's
// host_permissions / content_scripts `matches` entries for LinkedIn, Greenhouse,
// Lever, Workday). Note: extension/lib/detector-utils.js — named in this task's
// brief as the canonical source — does NOT actually hold a domain list itself
// (only CSS-selector/URL-path scraping signals); manifest.json is where these
// exact domain strings live, so that's what's mirrored here to avoid drift.
const ATS_SENDER_DOMAINS = [
  "linkedin.com",
  "greenhouse.io",
  "lever.co",
  "myworkdayjobs.com",
];

const phraseClause = JOB_SIGNAL_PHRASES.map((p) => `"${p}"`).join(" OR ");
const domainClause = ATS_SENDER_DOMAINS.map((d) => `from:@${d}`).join(" OR ");

// Exported single constant combining every signal, as specified. `newer_than:90d`
// caps scope so a first sync on a long-lived inbox doesn't try to process years
// of history in one call.
export const JOB_SIGNAL_QUERY_TERMS = `((${phraseClause}) OR (${domainClause})) newer_than:90d`;

// Deliberately modest for a first working version — raising this or adding
// pageToken-based pagination through Gmail's messages.list is a follow-up,
// not done here, to keep Gmail-quota and Gemini-quota footprint small and
// easy to reason about while this pipeline is still new.
const MAX_CANDIDATE_MESSAGES = 50;

// Concurrency cap for per-message metadata fetches: batches of 5 run via
// Promise.all rather than fully sequential (slow) or 50-at-once (thundering
// herd against Gmail's per-user rate limit). Deliberately NOT using Gmail's
// batch multipart endpoint (`/batch/gmail/v1`) for this first version — that
// endpoint's response parsing is real complexity/bug-risk for a first pass.
const METADATA_FETCH_CONCURRENCY = 5;

// How many candidate emails go into one Gemini classification call.
const CLASSIFY_BATCH_SIZE = 5;

// Cap on the persisted processedMessageIds / pendingReview arrays so
// Firestore's 1MB doc limit and the users/{uid} doc size stay small.
const MAX_PROCESSED_IDS = 500;
const MAX_PENDING_REVIEW = 200;

// An alias, not a pinned version — confirmed via a live models.list call
// against this project's actual API key that "gemini-2.5-flash" itself
// returns 404 ("no longer available to new users") despite still being
// listed, while "gemini-flash-latest" resolves correctly (currently to
// gemini-3.6-flash under the hood, per the response's modelVersion field).
// Using the alias means this doesn't silently break again the next time
// Google retires a specific version.
const GEMINI_MODEL = "gemini-flash-latest";

// ---------------------------------------------------------------------------
// Classification types
// ---------------------------------------------------------------------------

export const CLASSIFICATION_TYPES = [
  "application_confirmation",
  "assessment_invite",
  "interview_invite",
  "recruiter_followup",
  "stage_update",
  "rejection",
  "offer",
  "document_request",
  "background_check",
  "withdrawal",
  "other",
] as const;
export type ClassificationType = (typeof CLASSIFICATION_TYPES)[number];

interface CandidateEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
}

interface Classification {
  messageId: string;
  isJobRelated: boolean;
  type: ClassificationType;
  company: string | null;
  role: string | null;
  deadline: string | null;
  interviewDateTime: string | null;
  recruiterName: string | null;
  confidence: number;
}

interface PendingReviewItem {
  messageId: string;
  company: string | null;
  role: string | null;
  guessedType: ClassificationType;
  confidence: number;
  subject: string;
  detectedAt: string;
}

export class GmailReconnectRequiredError extends Error {
  constructor() {
    super(
      "Gmail connection needs to be re-authorized (the stored refresh token was rejected by Google)."
    );
    this.name = "GmailReconnectRequiredError";
  }
}

// ---------------------------------------------------------------------------
// Step b) Refresh the Google access token
// ---------------------------------------------------------------------------

interface GoogleErrorResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_WEB_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Server is missing GOOGLE_WEB_CLIENT_ID or GOOGLE_CLIENT_SECRET"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = (await res.json()) as GoogleErrorResponse;

  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      throw new GmailReconnectRequiredError();
    }
    throw new Error(
      `Google access token refresh failed: ${res.status} ${data.error ?? ""} ${data.error_description ?? ""}`
    );
  }

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Step c) List candidate messages
// ---------------------------------------------------------------------------

async function listCandidateMessageIds(accessToken: string): Promise<string[]> {
  const params = new URLSearchParams();
  params.set("q", JOB_SIGNAL_QUERY_TERMS);
  params.set("maxResults", String(MAX_CANDIDATE_MESSAGES));

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(
      `Gmail messages.list failed: ${res.status} ${await res.text()}`
    );
  }

  const data = (await res.json()) as { messages?: Array<{ id: string }> };
  return (data.messages || []).map((m) => m.id);
}

// ---------------------------------------------------------------------------
// Step d) Fetch metadata per candidate (concurrency-capped)
// ---------------------------------------------------------------------------

interface GmailMessageMetadata {
  snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
}

async function fetchMessageMetadata(
  accessToken: string,
  id: string
): Promise<CandidateEmail> {
  // Repeat metadataHeaders per header via URLSearchParams.append (NOT comma-
  // joined) so each becomes its own distinct query-string entry, matching
  // what the Gmail API expects (?metadataHeaders=From&metadataHeaders=Subject...).
  const params = new URLSearchParams();
  params.set("format", "metadata");
  params.append("metadataHeaders", "From");
  params.append("metadataHeaders", "Subject");
  params.append("metadataHeaders", "Date");

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(
      `Gmail messages.get failed for ${id}: ${res.status} ${await res.text()}`
    );
  }

  const data = (await res.json()) as GmailMessageMetadata;
  const headers = data.payload?.headers || [];
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  return {
    id,
    from: header("From"),
    subject: header("Subject"),
    snippet: data.snippet || "",
  };
}

async function fetchMessageMetadataBatch(
  accessToken: string,
  ids: string[]
): Promise<CandidateEmail[]> {
  const results: CandidateEmail[] = [];
  for (let i = 0; i < ids.length; i += METADATA_FETCH_CONCURRENCY) {
    const chunk = ids.slice(i, i + METADATA_FETCH_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map((id) => fetchMessageMetadata(accessToken, id))
    );
    results.push(...chunkResults);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Step f) Classify with Gemini
// ---------------------------------------------------------------------------

// OpenAPI-subset Schema object per Gemini's structured-output docs. Shared
// between the batched (array-of-object) and single-item (bare object) calls.
const CLASSIFICATION_ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    messageId: { type: "STRING" },
    isJobRelated: { type: "BOOLEAN" },
    type: { type: "STRING", enum: [...CLASSIFICATION_TYPES] },
    company: { type: "STRING", nullable: true },
    role: { type: "STRING", nullable: true },
    deadline: { type: "STRING", nullable: true },
    interviewDateTime: { type: "STRING", nullable: true },
    recruiterName: { type: "STRING", nullable: true },
    confidence: { type: "NUMBER" },
  },
  required: ["messageId", "isJobRelated", "type", "confidence"],
} as const;

function buildClassificationPrompt(candidates: CandidateEmail[]): string {
  const items = candidates
    .map(
      (c) =>
        `- messageId: ${c.id}\n  from: ${c.from}\n  subject: ${c.subject}\n  snippet: ${c.snippet}`
    )
    .join("\n");

  return `You classify emails for a job-application tracker. For each email below, decide whether it relates to a job application the recipient (the account owner) personally submitted — not a newsletter, marketing email, or unrelated notification.

If it is job-related, classify it into exactly one of these types: ${CLASSIFICATION_TYPES.join(", ")}.
- application_confirmation: acknowledges an application was received.
- assessment_invite: asks the candidate to complete an online test/assessment.
- interview_invite: invites/schedules an interview.
- recruiter_followup: a recruiter reaching out about an existing application, not a new stage.
- stage_update: a generic "your application status changed" notice that doesn't fit another type.
- rejection: candidate was not selected / application rejected.
- offer: a job offer.
- document_request: asks for additional documents/paperwork.
- background_check: background-check related.
- withdrawal: candidate withdrew, or the employer says the requisition was withdrawn/closed by them without a rejection framing.
- other: job-related but doesn't fit any of the above.

If it is NOT job-related at all, set isJobRelated to false and type to "other".

Only use information present in the from/subject/snippet text given — do not guess company or role names that aren't reasonably inferable from that text; use null when unsure. "confidence" is your confidence (0 to 1) in the overall classification (isJobRelated + type together).

Emails:
${items}

Return one classification object per email above, each carrying the exact same "messageId" it was given.`;
}

// The free tier's actual limit is much tighter than assumed when this file
// was first written — confirmed empirically (not from docs, which don't
// publish a static number) at exactly 5 requests/minute/model for
// gemini-2.5-flash via a live 429 response:
// "GenerateRequestsPerMinutePerProjectPerModel-FreeTier ... quotaValue: 5".
// A 50-candidate sync at batch size 5 needs 10 calls, so hitting this is the
// norm, not the exception — every call must be paced and 429s must be
// retried with backoff, not silently swallowed into "discarded" (that was
// the bug caught during manual verification: a whole sync run silently
// produced zero results because every call past the 5th got rate-limited
// and the generic catch-and-discard fallback masked it).
const GEMINI_MIN_CALL_SPACING_MS = 13_000; // keeps steady-state calls under 5/min
const GEMINI_MAX_RATE_LIMIT_RETRIES = 2;

let lastGeminiCallAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class GeminiRateLimitError extends Error {
  constructor(public retryDelayMs: number) {
    super(`Gemini rate limit hit, retry after ${retryDelayMs}ms`);
    this.name = "GeminiRateLimitError";
  }
}

// Parses the RetryInfo.retryDelay ("24s"-style) Google includes in a 429
// body, falling back to a conservative default if the shape isn't as
// expected (Google's error detail shapes aren't a hard contract to code
// against, so this must degrade gracefully rather than throw).
function parseRetryDelayMs(errorBody: unknown): number {
  const DEFAULT_MS = 15_000;
  try {
    const details = (errorBody as { error?: { details?: Array<Record<string, unknown>> } })
      ?.error?.details;
    const retryInfo = details?.find(
      (d) => d["@type"] === "type.googleapis.com/google.rpc.RetryInfo"
    );
    const raw = retryInfo?.retryDelay;
    if (typeof raw === "string" && raw.endsWith("s")) {
      const seconds = parseFloat(raw.slice(0, -1));
      if (!Number.isNaN(seconds)) return Math.ceil(seconds * 1000) + 1000; // +1s margin
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_MS;
}

async function callGemini(body: unknown): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY env var is not set");
  }

  // Proactive pacing: never fire a call sooner than GEMINI_MIN_CALL_SPACING_MS
  // after the previous one, regardless of which batch/candidate it's for.
  const waitFor = lastGeminiCallAt + GEMINI_MIN_CALL_SPACING_MS - Date.now();
  if (waitFor > 0) await sleep(waitFor);
  lastGeminiCallAt = Date.now();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (res.status === 429) {
    const errorBody = await res.json().catch(() => ({}));
    throw new GeminiRateLimitError(parseRetryDelayMs(errorBody));
  }

  if (!res.ok) {
    throw new Error(
      `Gemini generateContent failed: ${res.status} ${await res.text()}`
    );
  }

  return res.json();
}

// Reactive backoff on top of the proactive pacing above: if a 429 still
// happens (e.g. another process/tab shared the same key concurrently),
// wait exactly as long as Google's RetryInfo says and retry, up to
// GEMINI_MAX_RATE_LIMIT_RETRIES times, before giving up for real.
async function callGeminiWithRetry(body: unknown): Promise<unknown> {
  let attempt = 0;
  for (;;) {
    try {
      return await callGemini(body);
    } catch (err) {
      if (err instanceof GeminiRateLimitError && attempt < GEMINI_MAX_RATE_LIMIT_RETRIES) {
        attempt++;
        await sleep(err.retryDelayMs);
        continue;
      }
      throw err;
    }
  }
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

function extractGeminiJsonText(data: unknown): string {
  const response = data as GeminiGenerateContentResponse;
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Gemini response did not contain the expected text content");
  }
  return text;
}

function normalizeClassification(raw: unknown): Classification {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const type = CLASSIFICATION_TYPES.includes(r.type as ClassificationType)
    ? (r.type as ClassificationType)
    : "other";
  return {
    messageId: typeof r.messageId === "string" ? r.messageId : "",
    isJobRelated: Boolean(r.isJobRelated),
    type,
    company: typeof r.company === "string" && r.company ? r.company : null,
    role: typeof r.role === "string" && r.role ? r.role : null,
    deadline: typeof r.deadline === "string" && r.deadline ? r.deadline : null,
    interviewDateTime:
      typeof r.interviewDateTime === "string" && r.interviewDateTime
        ? r.interviewDateTime
        : null,
    recruiterName:
      typeof r.recruiterName === "string" && r.recruiterName ? r.recruiterName : null,
    confidence: typeof r.confidence === "number" ? r.confidence : 0,
  };
}

function discardedClassification(messageId: string): Classification {
  return {
    messageId,
    isJobRelated: false,
    type: "other",
    company: null,
    role: null,
    deadline: null,
    interviewDateTime: null,
    recruiterName: null,
    confidence: 0,
  };
}

async function classifyBatchViaGemini(
  candidates: CandidateEmail[]
): Promise<Classification[]> {
  const data = await callGeminiWithRetry({
    contents: [{ role: "user", parts: [{ text: buildClassificationPrompt(candidates) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { type: "ARRAY", items: CLASSIFICATION_ITEM_SCHEMA },
    },
  });

  const parsed = JSON.parse(extractGeminiJsonText(data));
  if (!Array.isArray(parsed)) {
    throw new Error("Gemini batch classification response was not an array");
  }
  return parsed.map(normalizeClassification);
}

async function classifySingleViaGemini(
  candidate: CandidateEmail
): Promise<Classification> {
  const data = await callGeminiWithRetry({
    contents: [{ role: "user", parts: [{ text: buildClassificationPrompt([candidate]) }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: CLASSIFICATION_ITEM_SCHEMA,
    },
  });

  return normalizeClassification(JSON.parse(extractGeminiJsonText(data)));
}

// Classifies every candidate, batching CLASSIFY_BATCH_SIZE emails per Gemini
// call to stay within free-tier rate limits. If a batch's response comes
// back malformed or mismatched in length/messageIds vs. the input, falls
// back to one Gemini call per email for that specific batch — a single
// defensive fallback attempt, not a retry loop.
async function classifyCandidates(
  candidates: CandidateEmail[]
): Promise<Map<string, Classification>> {
  const results = new Map<string, Classification>();

  for (let i = 0; i < candidates.length; i += CLASSIFY_BATCH_SIZE) {
    const group = candidates.slice(i, i + CLASSIFY_BATCH_SIZE);
    let classifications: Classification[];

    try {
      const batchResult = await classifyBatchViaGemini(group);
      const idsMatch =
        batchResult.length === group.length &&
        group.every((c) => batchResult.some((cl) => cl.messageId === c.id));
      if (!idsMatch) {
        throw new Error("batch classification result did not match input messages");
      }
      classifications = batchResult;
    } catch {
      classifications = [];
      for (const candidate of group) {
        try {
          classifications.push(await classifySingleViaGemini(candidate));
        } catch {
          // Even the single-item fallback failed — discard rather than
          // crash the whole sync run over one bad message.
          classifications.push(discardedClassification(candidate.id));
        }
      }
    }

    for (const classification of classifications) {
      results.set(classification.messageId, classification);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Step h) Match to existing applications / dedup
// ---------------------------------------------------------------------------

function normalizeForMatch(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Standalone + exported so it can be reused elsewhere (e.g. Phase 5's
// duplicate-detection work is meant to share this same matching
// implementation rather than re-deriving it). Deliberately simple for a
// first version: normalized-substring/equality on company, loosely the same
// on role when a role is available — no fuzzy string-distance library.
export function matchApplication(
  candidate: { company: string | null; role: string | null },
  existingApplications: AdminApplicationRecord[]
): AdminApplicationRecord | null {
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

// ---------------------------------------------------------------------------
// Step g) Map classification -> status + timeline event
// ---------------------------------------------------------------------------

const TYPE_TO_STATUS: Partial<Record<ClassificationType, ApplicationStatus>> = {
  rejection: "rejected",
  offer: "offer",
  interview_invite: "interview",
  assessment_invite: "assessment",
  withdrawal: "withdrawn",
  // application_confirmation is handled separately below: it only ever sets
  // status on a brand-new application, never on a matched existing one
  // (never downgrades a further-along application back to "applied").
  // stage_update / recruiter_followup / document_request / background_check /
  // other intentionally have no entry here: they add a timeline entry only.
};

// The only path that creates a new application (see the call site's
// `classification.type !== "application_confirmation"` guard) always uses
// this type, so this is intentionally not a general type->status lookup.
function statusForNewApplication(): ApplicationStatus {
  return "applied";
}

// Returns the status to write on an EXISTING matched application, or null
// when this type shouldn't change status (includes application_confirmation,
// per the no-downgrade rule above).
function statusForExistingApplication(type: ClassificationType): ApplicationStatus | null {
  return TYPE_TO_STATUS[type] ?? null;
}

const TIMELINE_LABELS: Record<ClassificationType, string> = {
  application_confirmation: "Application confirmed",
  assessment_invite: "Assessment invite received",
  interview_invite: "Interview invite received",
  recruiter_followup: "Recruiter follow-up",
  stage_update: "Stage update",
  rejection: "Rejected",
  offer: "Offer received",
  document_request: "Document request",
  background_check: "Background check",
  withdrawal: "Withdrawn",
  other: "Job-related email detected",
};

function buildTimelineEvent(
  classification: Classification,
  messageId: string
): Record<string, unknown> {
  return {
    label: TIMELINE_LABELS[classification.type],
    stage: classification.type,
    detectedAt: new Date().toISOString(),
    source: "gmail",
    sourceEmailId: messageId,
    confidence: classification.confidence,
  };
}

// Builds the patch to apply to an EXISTING matched application: status per
// the mapping above (if applicable), plus company/role enrichment gated by
// the manual-override guard — never overwrite company/role if the
// application has a truthy companyManuallySet flag (that field doesn't exist
// yet anywhere in the codebase, since nothing sets it yet, but Phase 5 is
// expected to add it, so this guards defensively for that future state).
// Also intentionally only fills company/role when the existing application's
// field is empty — this flow should enrich blanks, not clobber good data.
function buildExistingApplicationPatch(
  existing: AdminApplicationRecord,
  classification: Classification
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  const nextStatus = statusForExistingApplication(classification.type);
  if (nextStatus) {
    patch.status = nextStatus;
  }

  const companyManuallySet = Boolean(existing.companyManuallySet);
  if (!companyManuallySet) {
    if (!existing.company && classification.company) {
      patch.company = classification.company;
    }
    if (!existing.role && classification.role) {
      patch.role = classification.role;
    }
  }

  return patch;
}

// ---------------------------------------------------------------------------
// Core sync function
// ---------------------------------------------------------------------------

export interface GmailSyncResult {
  processed: number;
  created: number;
  updated: number;
  queued: number;
}

export async function syncGmailForUser(uid: string): Promise<GmailSyncResult> {
  // a) Load the Gmail connection.
  const gmail = await adminGetUserGmailConnection(uid);
  if (!gmail || gmail.status !== "connected") {
    throw new Error(
      `Gmail is not connected for this user (users/${uid}.gmail is missing or its status is not "connected")`
    );
  }
  const refreshToken = gmail.refreshToken;
  if (typeof refreshToken !== "string" || !refreshToken) {
    throw new Error(
      `users/${uid}.gmail.status is "connected" but refreshToken is missing`
    );
  }

  // b) Refresh the Google access token.
  let accessToken: string;
  try {
    accessToken = await refreshGoogleAccessToken(refreshToken);
  } catch (err) {
    if (err instanceof GmailReconnectRequiredError) {
      await adminPatchUserFields(uid, { "gmail.status": "needs_reconnect" });
    }
    throw err;
  }

  // c) List candidate messages.
  const candidateIds = await listCandidateMessageIds(accessToken);

  // e) Skip already-processed messages (before doing any Gemini calls).
  const previouslyProcessed: string[] = Array.isArray(gmail.processedMessageIds)
    ? (gmail.processedMessageIds as string[])
    : [];
  const previouslyProcessedSet = new Set(previouslyProcessed);
  const newMessageIds = candidateIds.filter((id) => !previouslyProcessedSet.has(id));

  if (newMessageIds.length === 0) {
    // Nothing new this run — still record that a sync happened.
    await adminPatchUserFields(uid, { "gmail.lastSyncedAt": new Date().toISOString() });
    return { processed: 0, created: 0, updated: 0, queued: 0 };
  }

  // d) Fetch metadata per candidate, concurrency-capped.
  const candidates = await fetchMessageMetadataBatch(accessToken, newMessageIds);

  // f) Classify with Gemini, batched.
  const classifications = await classifyCandidates(candidates);

  // h) Load existing applications once for matching.
  const existingApplications = await adminListApplications(uid);

  let created = 0;
  let updated = 0;
  let queued = 0;
  const pendingReviewToAdd: PendingReviewItem[] = [];

  for (const candidate of candidates) {
    const classification = classifications.get(candidate.id) ?? discardedClassification(candidate.id);

    // i) Confidence-tiered writes.
    if (!classification.isJobRelated || classification.confidence < 0.5) {
      continue; // discard — still marked processed below, no write
    }

    if (classification.confidence < 0.75) {
      // Medium confidence: queue for human review, never write the application.
      pendingReviewToAdd.push({
        messageId: candidate.id,
        company: classification.company,
        role: classification.role,
        guessedType: classification.type,
        confidence: classification.confidence,
        subject: candidate.subject,
        detectedAt: new Date().toISOString(),
      });
      queued++;
      continue;
    }

    // High confidence (>= 0.75) from here on.
    const match = matchApplication(
      { company: classification.company, role: classification.role },
      existingApplications
    );

    if (!match) {
      if (classification.type !== "application_confirmation") {
        // High confidence, no existing match, and not a fresh application
        // signal (e.g. a stray "interview invite" with no prior record) —
        // nothing sane to write; skip (still marked processed below).
        continue;
      }

      const newApplication = await adminCreateApplication(uid, {
        company: classification.company || "Unknown company",
        role: classification.role || "Unknown role",
        description: null,
        url: "",
        source: "gmail",
        auto: true,
        status: statusForNewApplication(),
        appliedAt: new Date().toISOString(),
        resumeFileName: null,
        notes: "",
        followUpDone: false,
        followUpNotifiedAt: null,
      });
      // Keep the in-memory list current so later candidates in this same
      // run can match against an application created earlier in the loop.
      existingApplications.push({
        id: newApplication.id,
        company: classification.company,
        role: classification.role,
        status: statusForNewApplication(),
      });
      await adminAddTimelineEvent(
        uid,
        newApplication.id,
        buildTimelineEvent(classification, candidate.id)
      );
      created++;
      continue;
    }

    // Matched an existing application.
    const patch = buildExistingApplicationPatch(match, classification);
    if (Object.keys(patch).length > 0) {
      await adminUpdateApplication(uid, match.id, patch);
      Object.assign(match, patch);
      updated++;
    }
    await adminAddTimelineEvent(uid, match.id, buildTimelineEvent(classification, candidate.id));
  }

  // e) Append newly-processed IDs (every candidate considered this run,
  // regardless of outcome), capped to the last MAX_PROCESSED_IDS entries.
  const updatedProcessedIds = [
    ...previouslyProcessed,
    ...candidates.map((c) => c.id),
  ].slice(-MAX_PROCESSED_IDS);

  const previousPendingReview: PendingReviewItem[] = Array.isArray(gmail.pendingReview)
    ? (gmail.pendingReview as PendingReviewItem[])
    : [];
  const updatedPendingReview = [...previousPendingReview, ...pendingReviewToAdd].slice(
    -MAX_PENDING_REVIEW
  );

  await adminPatchUserFields(uid, {
    "gmail.processedMessageIds": updatedProcessedIds,
    "gmail.pendingReview": updatedPendingReview,
    "gmail.lastSyncedAt": new Date().toISOString(),
  });

  return { processed: candidates.length, created, updated, queued };
}
