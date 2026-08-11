import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getDashboardData } from "@/lib/server/applications";
import { ApplicationsExplorer } from "./applications-explorer";

export default async function ApplicationsPage() {
  const session = await getSession();
  if (!session) redirect("/?connect=1");

  const { applications } = await getDashboardData(session.uid);

  return (
    <div className="max-w-5xl mx-auto px-8 py-12">
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Applications</h1>
      <p className="text-ink-soft mb-8">Every application you&apos;ve logged, searchable and sortable.</p>

      <ApplicationsExplorer applications={applications} />
    </div>
  );
}
