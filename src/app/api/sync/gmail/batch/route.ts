import { NextRequest, NextResponse } from "next/server";
import { syncGmailForUser, GmailReconnectRequiredError, type GmailSyncResult } from "@/lib/server/gmail-sync";
import { adminListConnectedGmailUsers } from "@/lib/server/firestore-admin";

// Phase 4 unattended batch-sync trigger, called by the GitHub Actions
// scheduled workflow (.github/workflows/gmail-sync.yml) — no browser, no
// logged-in user, so unlike src/app/api/sync/gmail/route.ts (the existing
// single-user route, untouched by this file) there is no session cookie to
// read. Authorization is a shared bearer secret instead.
//
// Deliberately a SEPARATE route from the single-user one rather than a mode
// flag on it: the auth model (session cookie vs. bearer secret) and the
// fan-out-over-many-users behavior are different enough that folding them
// into one handler would just be a pile of branching, not a simplification.

// Constant-time comparison isn't necessary for a hobby project's shared
// secret (per the task brief), but this must still compare the FULL string,
// not a prefix — a naive `startsWith` check would let a header like
// "Bearer <real-secret>-anything-else" incorrectly pass.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.SYNC_BATCH_SECRET;
  if (!secret) return false; // fail closed if the env var isn't configured yet

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

interface UserSyncOutcome {
  uid: string;
  result?: GmailSyncResult;
  error?: string;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const uids = await adminListConnectedGmailUsers();

  const results: UserSyncOutcome[] = [];

  // Sequential, deliberately NOT Promise.all/concurrent. gmail-sync.ts paces
  // its own Gemini calls (13s minimum spacing) via a single module-level
  // `lastGeminiCallAt` timestamp shared across every call in this process —
  // that pacing assumes one sync in flight at a time. Running several users'
  // syncs concurrently would multiply the actual Gemini request rate well
  // past what that pacing logic accounts for and blow through the free-tier
  // quota faster, not just make this batch run faster.
  for (const uid of uids) {
    try {
      const result = await syncGmailForUser(uid);
      results.push({ uid, result });
    } catch (err) {
      // One user's failure (Gmail/Gemini rate limit, reconnect-required,
      // any other transient error) must never abort the batch for everyone
      // else — catch per-user, keep going.
      const message =
        err instanceof GmailReconnectRequiredError
          ? "needs_reconnect"
          : err instanceof Error
            ? err.message
            : String(err);
      results.push({ uid, error: message });
    }
  }

  const summary = {
    totalConnectedUsers: uids.length,
    succeeded: results.filter((r) => r.result).length,
    failed: results.filter((r) => r.error).length,
  };

  return NextResponse.json({ summary, results });
}
