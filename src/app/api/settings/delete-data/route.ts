import { NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { adminDeleteAllUserData } from "@/lib/server/firestore-admin";

// Settings page's "Delete my data" action — genuinely deletes every
// application (and each one's timeline events) plus the users/{uid} doc
// itself (which is also where the Gmail refresh token lives, so this also
// disconnects Gmail sync as a side effect, not just a data wipe). This is
// the real action the privacy pages promise, not a "contact support" form.
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const result = await adminDeleteAllUserData(session.uid);

  const response = NextResponse.json({ ok: true, ...result });
  // The account's data (and its session-granting Gmail connection) no
  // longer exists — clear the session cookie so the client doesn't keep
  // acting as if signed in to an account with nothing left in it.
  response.cookies.set("session", "", { path: "/", maxAge: 0 });
  return response;
}
