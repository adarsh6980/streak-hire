import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/server/session";
import { adminUpdateApplication } from "@/lib/server/firestore-admin";
import { ALL_STATUSES } from "@/lib/status";

// Single mutation endpoint backing every write from the web app's
// interactive pieces: the status dropdown (Applications list/board +
// Application detail), the task checkbox (Action Centre + Application
// detail), the notes textarea, and the Application detail edit form.
// task-checkbox.tsx and sync-gmail-button.tsx (both already shipped) were
// written assuming exactly this contract — PATCH with a JSON body of fields
// to patch, session read server-side, 401 if none — so this matches that
// shape rather than inventing a new one.
//
// Body is an arbitrary partial-patch object; the only field we don't trust
// as-is is `status`, since it's the one closed 7-value enum in the schema
// (src/lib/status.ts's ALL_STATUSES) and a bad value here would silently
// corrupt every status-based read (board columns, stats, filters) elsewhere
// in the app.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  if ("status" in body && !ALL_STATUSES.includes(body.status as (typeof ALL_STATUSES)[number])) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${ALL_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = { ...body };
  // A manual company/role correction from the detail-page edit form — set
  // the same manual-override guard field gmail-sync.ts's
  // buildExistingApplicationPatch already reads (companyManuallySet) so a
  // future sync run won't clobber this user's own correction.
  if ("company" in patch || "role" in patch) {
    patch.companyManuallySet = true;
  }

  try {
    await adminUpdateApplication(session.uid, params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update application" },
      { status: 500 }
    );
  }
}
