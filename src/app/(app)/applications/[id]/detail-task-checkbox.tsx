"use client";

// Task checkbox scoped to a single already-loaded application — the
// Application detail page's Tasks list (inside Overview) shows every task
// (not just incomplete ones, unlike Action Centre's getUpcomingTasks feed),
// so unlike ../../action-centre/task-checkbox.tsx (which only ever flips
// completed: false -> true, since a completed task drops out of that
// page's list) this one toggles both directions to match its checked
// visual state. Same PATCH {tasks: [...]} array-replace + router.refresh()
// shape otherwise.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApplicationTask } from "@/lib/server/applications";

export function DetailTaskCheckbox({
  applicationId,
  tasks,
  taskIndex,
}: {
  applicationId: string;
  tasks: ApplicationTask[];
  taskIndex: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const completed = Boolean(tasks[taskIndex]?.completed);

  function handleToggle() {
    if (pending) return;
    setError(null);
    const updatedTasks = tasks.map((t, i) =>
      i === taskIndex ? { ...t, completed: !t.completed } : t
    );

    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: updatedTasks }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        router.refresh();
      } catch {
        setError("Couldn't save — try again.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        role="checkbox"
        aria-checked={completed}
        aria-label={completed ? "Mark task incomplete" : "Mark task complete"}
        onClick={handleToggle}
        disabled={pending}
        className={cn(
          "h-5 w-5 shrink-0 rounded-full border flex items-center justify-center transition-colors",
          pending
            ? "border-ink/20 bg-ink/5"
            : completed
              ? "border-stamp bg-stamp/10"
              : "border-ink/30 hover:border-stamp hover:bg-stamp/5"
        )}
      >
        {(completed || pending) && (
          <Check className={cn("h-3 w-3", completed ? "text-stamp" : "text-ink/40")} strokeWidth={3} />
        )}
      </button>
      {error && <span className="font-mono text-[10px] text-stamp whitespace-nowrap">{error}</span>}
    </div>
  );
}
