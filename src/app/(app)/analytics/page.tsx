import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getDashboardData, computeAnalytics } from "@/lib/server/applications";
import { formatPercent, formatDateShort } from "@/lib/format-date";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/?connect=1");

  const { applications } = await getDashboardData(session.uid);

  if (applications.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-12">
        <h1 className="font-display text-3xl font-bold text-ink mb-1">Analytics</h1>
        <p className="text-ink-soft mb-8">
          Trends across your pipeline once applications start coming in.
        </p>
        <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-light px-8 py-12 text-center">
          <p className="text-ink-soft">No applications logged yet — analytics will appear once you do.</p>
        </div>
      </div>
    );
  }

  const analytics = computeAnalytics(applications);
  const maxCompanyCount = Math.max(1, ...analytics.mostActiveCompanies.map((c) => c.count));
  const maxWeekCount = Math.max(1, ...analytics.applicationsPerWeek.map((w) => w.count));

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Analytics</h1>
      <p className="text-ink-soft mb-8">Trends across your pipeline.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Response rate" value={formatPercent(analytics.responseRate)} />
        <StatCard
          label="Interview conversion"
          value={formatPercent(analytics.interviewConversionRate)}
        />
        <StatCard label="Offer conversion" value={formatPercent(analytics.offerConversionRate)} />
      </div>

      <section className="mb-10">
        <h2 className="font-display text-lg font-bold text-ink mb-4">Most active companies</h2>
        {analytics.mostActiveCompanies.length === 0 ? (
          <p className="text-ink-soft text-sm">Nothing to show yet.</p>
        ) : (
          <div className="space-y-2.5">
            {analytics.mostActiveCompanies.map((c) => (
              <div key={c.company} className="flex items-center gap-3">
                <span className="font-mono text-[12px] text-ink-soft w-32 truncate shrink-0">
                  {c.company}
                </span>
                <div className="flex-1 h-5 bg-ink/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-airmail rounded-full"
                    style={{ width: `${(c.count / maxCompanyCount) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-ink-soft w-6 text-right shrink-0">
                  {c.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg font-bold text-ink mb-4">Applications per week</h2>
        {analytics.applicationsPerWeek.length === 0 ? (
          <p className="text-ink-soft text-sm">Nothing to show yet.</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {analytics.applicationsPerWeek.map((w) => (
              <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full bg-airmail/80 rounded-t-md"
                    style={{ height: `${Math.max(4, (w.count / maxWeekCount) * 100)}%` }}
                    title={`${w.count} application${w.count === 1 ? "" : "s"}`}
                  />
                </div>
                <span className="font-mono text-[9px] text-ink-soft whitespace-nowrap">
                  {w.weekStart === "unknown" ? "—" : formatDateShort(w.weekStart)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink/12 bg-paper-light p-6">
      <p className="font-display text-4xl font-bold text-ink mb-2">{value}</p>
      <p className="font-mono text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
    </div>
  );
}
