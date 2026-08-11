import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import {
  getDashboardData,
  computeDashboardStats,
  getUpcomingTasks,
} from "@/lib/server/applications";
import { STATUS_LABELS } from "@/lib/status";
import { formatDateTime } from "@/lib/format-date";
import { relativeDueLabel } from "@/lib/format-date";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/?connect=1");

  const { applications, recentTimeline } = await getDashboardData(session.uid);

  if (applications.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-ink mb-1">Dashboard</h1>
        <p className="text-ink-soft mb-8">Your pipeline at a glance.</p>
        <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-light px-8 py-12 text-center">
          <p className="text-ink-soft">
            No applications logged yet — connect Gmail sync or log one from the extension to see
            your dashboard fill in.
          </p>
        </div>
      </div>
    );
  }

  const stats = computeDashboardStats(applications);
  const applicationsById = new Map(applications.map((a) => [a.id, a]));

  const upcomingTasks = getUpcomingTasks(applications)
    .filter((t) => Boolean(t.dueAt))
    .slice(0, 5);

  const recentUpdates = recentTimeline.slice(0, 15);

  const statCards: Array<{ key: string; label: string; value: number; loud?: boolean }> = [
    { key: "thisWeek", label: "This week", value: stats.thisWeek, loud: true },
    { key: "total", label: "Total", value: stats.total },
    { key: "applied", label: STATUS_LABELS.applied, value: stats.byStatus.applied },
    { key: "assessment", label: STATUS_LABELS.assessment, value: stats.byStatus.assessment },
    { key: "interview", label: STATUS_LABELS.interview, value: stats.byStatus.interview },
    { key: "offer", label: STATUS_LABELS.offer, value: stats.byStatus.offer },
    { key: "rejected", label: STATUS_LABELS.rejected, value: stats.byStatus.rejected },
    { key: "awaiting", label: "Awaiting response", value: stats.awaitingResponse },
    { key: "action", label: "Requiring action", value: stats.requiringAction },
  ];

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Dashboard</h1>
      <p className="text-ink-soft mb-8">Your pipeline at a glance.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((card) => (
          <div
            key={card.key}
            className={cn(
              "rounded-2xl border p-6",
              card.loud ? "border-stamp/25 bg-stamp/5" : "border-ink/12 bg-paper-light"
            )}
          >
            <p
              className={cn(
                "font-display text-4xl font-bold mb-2",
                card.loud ? "text-stamp" : "text-ink"
              )}
            >
              {card.value}
            </p>
            <p
              className={cn(
                "font-mono text-[11px] uppercase tracking-wide",
                card.loud ? "text-stamp/80" : "text-ink-soft"
              )}
            >
              {card.label}
            </p>
          </div>
        ))}
      </div>

      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-ink">Upcoming deadlines</h2>
          <a
            href="/action-centre"
            className="font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:text-stamp transition-colors"
          >
            View all →
          </a>
        </div>
        {upcomingTasks.length === 0 ? (
          <p className="text-ink-soft text-sm">Nothing due yet.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {upcomingTasks.map((task, i) => {
              const due = relativeDueLabel(task.dueAt);
              return (
                <div
                  key={`${task.applicationId}-${task.dueAt ?? "none"}-${i}`}
                  className="shrink-0 w-64 rounded-2xl border border-ink/12 bg-paper-light px-4 py-3.5"
                >
                  <p className="text-ink font-medium text-sm truncate">{task.label || "Task"}</p>
                  <p className="font-mono text-[11px] text-ink-soft truncate mt-0.5">
                    {task.company} · {task.role}
                  </p>
                  <span
                    className={cn(
                      "inline-block mt-2 font-mono text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full",
                      due.urgent ? "bg-stamp/10 text-stamp" : "bg-ink/5 text-ink-soft"
                    )}
                  >
                    {due.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-ink">Recent updates</h2>
          <a
            href="/inbox-activity"
            className="font-mono text-[11px] uppercase tracking-wide text-ink-soft hover:text-stamp transition-colors"
          >
            View all →
          </a>
        </div>
        {recentUpdates.length === 0 ? (
          <p className="text-ink-soft text-sm">No activity yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentUpdates.map((event) => {
              const app = applicationsById.get(event.applicationId);
              const label = typeof event.label === "string" ? event.label : "Update detected";
              const detectedAt = typeof event.detectedAt === "string" ? event.detectedAt : "";
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
                  <span className="font-mono text-[11px] text-ink-soft whitespace-nowrap shrink-0">
                    {detectedAt ? formatDateTime(detectedAt) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
