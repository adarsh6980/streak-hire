import { NextRequest, NextResponse } from "next/server";
import { syncGmailForUser, GmailReconnectRequiredError } from "@/lib/server/gmail-sync";

interface SessionCookie {
  uid: string;
  idToken: string;
}

// Reads the "session" cookie set by src/app/api/auth/google/callback/route.ts
// ({uid, idToken} JSON, httpOnly). We only need `uid` here — this route's
// Firestore/Gmail work all goes through the service-account admin path in
// gmail-sync.ts, not the user's idToken, so we don't validate the idToken's
// signature. That's an existing simplification already accepted in the
// callback route's own "PLACEHOLDER session mechanism" comment.
function readSessionUid(request: NextRequest): string | null {
  const raw = request.cookies.get("session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SessionCookie>;
    return typeof parsed.uid === "string" && parsed.uid ? parsed.uid : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const uid = readSessionUid(request);
  if (!uid) {
    return NextResponse.json(
      { error: "Not signed in (missing or invalid session cookie)" },
      { status: 401 }
    );
  }

  try {
    const result = await syncGmailForUser(uid);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GmailReconnectRequiredError) {
      // Distinguishable response shape so the UI can special-case this
      // (e.g. show a "reconnect Gmail" prompt) rather than a generic error.
      return NextResponse.json(
        { error: "needs_reconnect", message: err.message },
        { status: 400 }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    // "Gmail is not connected" (thrown by syncGmailForUser step a) is a
    // client-fixable 400; anything else (Gmail/Gemini API failures, etc.)
    // is a 500.
    const status = message.startsWith("Gmail is not connected") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
