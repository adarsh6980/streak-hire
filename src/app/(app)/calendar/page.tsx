import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { getDashboardData, getUpcomingTasks, type TaskWithContext } from "@/lib/server/applications";
import { CalendarGrid } from "./calendar-grid";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/?connect=1");

  // Same underlying query as Action Centre — getUpcomingTasks(applications)
  // — rendered as a month grid instead of a list. Deliberately not a second
  // data path.
  const { applications } = await getDashboardData(session.uid);
  const tasks = getUpcomingTasks(applications);

  const tasksByDate: Record<string, TaskWithContext[]> = {};
  let undated = 0;
  for (const task of tasks) {
    if (!task.dueAt) {
      undated++;
      continue;
    }
    const d = new Date(task.dueAt);
    if (Number.isNaN(d.getTime())) {
      undated++;
      continue;
    }
    const key = dateKey(d);
    (tasksByDate[key] ??= []).push(task);
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Calendar</h1>
      <p className="text-ink-soft mb-2">
        Every upcoming task across your pipeline, laid out by due date.
      </p>
      {undated > 0 && (
        <p className="font-mono text-[11px] text-ink-soft/70 mb-6">
          {undated} task{undated === 1 ? "" : "s"} without a due date {undated === 1 ? "isn't" : "aren't"} shown here — see Action Centre.
        </p>
      )}

      <div className="mt-8">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-light px-8 py-12 text-center">
            <p className="text-ink-soft">No upcoming tasks to show on the calendar.</p>
          </div>
        ) : (
          <CalendarGrid tasksByDate={tasksByDate} />
        )}
      </div>
    </div>
  );
}
