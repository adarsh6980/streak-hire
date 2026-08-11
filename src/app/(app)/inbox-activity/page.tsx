import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getDashboardData } from "@/lib/server/applications";
import { formatDateTime } from "@/lib/format-date";

export default async function InboxActivityPage() {
  const session = await getSession();
  if (!session) redirect("/?connect=1");

  const { applications, recentTimeline } = await getDashboardData(session.uid);
  const applicationsById = new Map(applications.map((a) => [a.id, a]));

  // The Gmail-sourced slice of the shared timeline feed — this page is
  // specifically that feed, not the general activity log (see
  // src/lib/server/gmail-sync.ts's buildTimelineEvent, which always sets
  // source: "gmail" for sync-detected events).
  const gmailEvents = recentTimeline.filter((event) => event.source === "gmail");

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Inbox Activity</h1>
      <p className="text-ink-soft mb-8">
        Every update Streakhire&apos;s Gmail sync picked up and postmarked automatically.
      </p>

      {gmailEvents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-light px-8 py-12 text-center">
          <p className="text-ink-soft">0 new arrivals — nothing from Gmail has been sorted yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {gmailEvents.map((event) => {
            const app = applicationsById.get(event.applicationId);
            const label = typeof event.label === "string" ? event.label : "Update detected";
            const detectedAt = typeof event.detectedAt === "string" ? event.detectedAt : "";
            const confidence = typeof event.confidence === "number" ? event.confidence : null;
            return (
              <li
                key={event.id}
                className="flex items-center gap-4 rounded-2xl border border-ink/12 bg-paper-light px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-medium truncate">{label}</p>
                  <p className="font-mono text-[12px] text-ink-soft truncate">
                    {app ? `${app.company} · ${app.role}` : "Unlinked application"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-mono text-[11px] text-ink-soft whitespace-nowrap">
                    {detectedAt ? formatDateTime(detectedAt) : "—"}
                  </span>
                  {confidence !== null && (
                    <span className="font-mono text-[10px] text-airmail whitespace-nowrap">
                      {Math.round(confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
