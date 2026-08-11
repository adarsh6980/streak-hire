"use client";

// Marks a single task complete. This is the one interactive piece on an
// otherwise server-rendered page, so it's split out as its own small client
// component rather than making the whole Action Centre page client-side.
//
// Contract assumption: src/app/api/applications/[id]/route.ts is being built
// by a parallel agent in this session and didn't exist yet at the time this
// was written (checked: the api/applications directory doesn't exist). Per
// the task brief, this assumes PATCH /api/applications/[id] with a JSON body
// of fields to patch, reading the session server-side. We pass the
// application's full current `tasks` array down as a prop (already loaded by
// the server component from getDashboardData) rather than issuing a second
// GET — that keeps this component's only network dependency the documented
// PATCH shape, with no assumption about a GET endpoint's existence.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApplicationTask } from "@/lib/server/applications";

export function TaskCheckbox({
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

  function handleToggle() {
    if (pending) return;
    setError(null);
    const updatedTasks = tasks.map((t, i) => (i === taskIndex ? { ...t, completed: true } : t));

    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: updatedTasks }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        // Re-fetch the server component's data so this task drops out of
        // the (already-filtered-to-incomplete) upcoming-tasks list.
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
        aria-checked={false}
        aria-label="Mark task complete"
        onClick={handleToggle}
        disabled={pending}
        className={cn(
          "h-5 w-5 shrink-0 rounded-full border flex items-center justify-center transition-colors",
          pending
            ? "border-ink/20 bg-ink/5"
            : "border-ink/30 hover:border-stamp hover:bg-stamp/5"
        )}
      >
        {pending && <Check className="h-3 w-3 text-ink/40" strokeWidth={3} />}
      </button>
      {error && <span className="font-mono text-[10px] text-stamp whitespace-nowrap">{error}</span>}
    </div>
  );
}
