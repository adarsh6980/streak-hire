import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getDashboardData, groupByCompany, type ApplicationStatus } from "@/lib/server/applications";
import { formatDateShort } from "@/lib/format-date";
import { cn } from "@/lib/utils";

// Covers all 7 values of APPLICATION_STATUSES — never add an 8th here
// without updating the source enum in src/lib/server/applications.ts.
const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  received: "Received",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

// One Loud Color Rule: `stamp` is reserved for at most one status here
// (interview — the one that most concretely needs the user's attention,
// i.e. prep). `offer` gets the positive/offer-green tone. `rejected` and
// `withdrawn` are deliberately muted, not loud, per the brief. Everything
// else reads as a neutral/administrative airmail or ink tone.
const STATUS_STYLES: Record<ApplicationStatus, string> = {
  applied: "bg-ink/5 text-ink-soft",
  received: "bg-airmail/10 text-airmail",
  assessment: "bg-airmail/10 text-airmail",
  interview: "bg-stamp/10 text-stamp",
  offer: "bg-offer/10 text-offer",
  rejected: "bg-ink/5 text-ink/40",
  withdrawn: "bg-ink/5 text-ink/40",
};

export default async function CompaniesPage() {
  const session = await getSession();
  if (!session) redirect("/?connect=1");

  const { applications } = await getDashboardData(session.uid);
  const companies = groupByCompany(applications);

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Companies</h1>
      <p className="text-ink-soft mb-8">
        Every company you&apos;ve applied to, grouped and sorted by most recent activity.
      </p>

      {companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-light px-8 py-12 text-center">
          <p className="text-ink-soft">No applications logged yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {companies.map((group) => (
            <li
              key={group.company}
              className="rounded-2xl border border-ink/12 bg-paper-light p-5"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-ink truncate">
                    {group.company}
                  </h2>
                  <p className="font-mono text-[11px] text-ink-soft mt-0.5">
                    {group.applications.length} application
                    {group.applications.length === 1 ? "" : "s"} · last activity{" "}
                    {formatDateShort(group.latestActivityAt)}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-mono text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0",
                    STATUS_STYLES[group.latestStatus]
                  )}
                >
                  {STATUS_LABELS[group.latestStatus]}
                </span>
              </div>

              <ul className="mt-3 flex flex-wrap gap-1.5">
                {group.applications.map((app) => (
                  <li
                    key={app.id}
                    className="font-mono text-[11px] text-ink-soft bg-paper px-2 py-1 rounded-md"
                  >
                    {app.role}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
