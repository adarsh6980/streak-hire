import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import {
  getDashboardData,
  getUpcomingTasks,
  type ApplicationTask,
  type TaskWithContext,
} from "@/lib/server/applications";
import { TaskCheckbox } from "./task-checkbox";
import { relativeDueLabel } from "@/lib/format-date";
import { cn } from "@/lib/utils";

// getUpcomingTasks returns flattened copies of each application's tasks
// (spread with applicationId/company/role attached), so a flattened task no
// longer carries its original index into that application's `tasks` array.
// This recovers it by matching on the identifying fields the flattened copy
// still carries — id when present, otherwise type+label+dueAt, restricted to
// tasks that are still incomplete (getUpcomingTasks only ever returns
// incomplete tasks, so the match must be too).
function findTaskIndex(tasks: ApplicationTask[], target: TaskWithContext): number {
  return tasks.findIndex(
    (t) =>
      !t.completed &&
      t.type === target.type &&
      t.label === target.label &&
      t.dueAt === target.dueAt &&
      (target.id ? t.id === target.id : true)
  );
}

export default async function ActionCentrePage() {
  const session = await getSession();
  if (!session) redirect("/?connect=1");

  const { applications } = await getDashboardData(session.uid);
  const tasks = getUpcomingTasks(applications);
  const applicationsById = new Map(applications.map((a) => [a.id, a]));

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <h1 className="font-display text-3xl font-bold text-ink mb-1">Action Centre</h1>
      <p className="text-ink-soft mb-8">
        Everything across your pipeline that still needs a next step.
      </p>

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-paper-light px-8 py-12 text-center">
          <p className="text-ink-soft">No tasks need your attention right now.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task, i) => {
            const app = applicationsById.get(task.applicationId);
            const taskIndex = app ? findTaskIndex(app.tasks, task) : -1;
            const due = relativeDueLabel(task.dueAt);
            return (
              <li
                key={`${task.applicationId}-${task.type ?? "task"}-${task.dueAt ?? "none"}-${i}`}
                className="flex items-center gap-4 rounded-2xl border border-ink/12 bg-paper-light px-5 py-4"
              >
                {app && taskIndex >= 0 ? (
                  <TaskCheckbox applicationId={app.id} tasks={app.tasks} taskIndex={taskIndex} />
                ) : (
                  <div className="h-5 w-5 shrink-0 rounded-full border border-ink/15" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-ink font-medium truncate">{task.label || "Task"}</p>
                  <p className="font-mono text-[12px] text-ink-soft truncate">
                    {task.company} · {task.role}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-mono text-[11px] uppercase tracking-wide whitespace-nowrap px-2.5 py-1 rounded-full shrink-0",
                    due.urgent ? "bg-stamp/10 text-stamp" : "bg-ink/5 text-ink-soft"
                  )}
                >
                  {due.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
