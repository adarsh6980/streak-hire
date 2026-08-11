import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { adminPatchUserFields } from "@/lib/server/firestore-admin";

// Settings page "Disconnect Gmail" action (src/app/(app)/settings/page.tsx +
// disconnect-gmail-button.tsx). Deliberately only flips gmail.status to
// "disconnected" — it does NOT delete the stored refresh token
// (users/{uid}.gmail.refreshToken) or clear processedMessageIds/pendingReview.
// A later phase may want a "reconnect without re-consenting Google" path
// that reuses the still-stored refresh token, so this stays minimal on
// purpose rather than building that out now. syncGmailForUser already
// refuses to run unless gmail.status === "connected" (see gmail-sync.ts),
// so flipping status alone is sufficient to actually stop syncing this user.
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    await adminPatchUserFields(session.uid, { "gmail.status": "disconnected" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }
}
