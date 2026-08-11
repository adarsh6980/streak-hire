import { cookies } from "next/headers";

// Reads the "session" cookie set by src/app/api/auth/google/callback/route.ts
// ({uid, idToken} JSON, httpOnly). Same simplification already accepted
// there and in src/app/api/sync/gmail/route.ts: we only trust `uid` here,
// we don't validate the idToken's signature. Every page/route that needs
// this user's data reads it via the service-account admin Firestore path
// (src/lib/server/firestore-admin.ts), not via the idToken, so an unvalidated
// idToken sitting in the cookie isn't a privilege-escalation risk today — it
// isn't used to authorize anything.
export interface Session {
  uid: string;
  idToken: string;
}

export async function getSession(): Promise<Session | null> {
  const raw = cookies().get("session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.uid === "string" && parsed.uid) {
      return { uid: parsed.uid, idToken: parsed.idToken ?? "" };
    }
    return null;
  } catch {
    return null;
  }
}
