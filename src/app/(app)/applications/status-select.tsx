"use client";

// Shared status-dropdown client component — used by the Applications
// list/board (per row and per card) and by the Application detail page's
// Overview section. Same PATCH-then-router.refresh() shape as
// task-checkbox.tsx (../action-centre/task-checkbox.tsx): a single field
// patch, session read server-side by the route, no local optimistic state
// beyond the pending/error flags.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ALL_STATUSES, STATUS_LABELS, STATUS_BADGE_CLASSES } from "@/lib/status";
import type { ApplicationStatus } from "@/lib/server/applications";
import { cn } from "@/lib/utils";

export function StatusSelect({
  applicationId,
  status,
}: {
  applicationId: string;
  status: ApplicationStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: string) {
    if (pending || next === status) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        router.refresh();
      } catch {
        setError("Couldn't save — try again.");
      }
    });
  }

  return (
    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
      <select
        aria-label="Application status"
        value={status}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className={cn(
          "font-mono text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-full border-0 cursor-pointer appearance-none text-center",
          STATUS_BADGE_CLASSES[status],
          pending && "opacity-60 cursor-wait"
        )}
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {error && (
        <p className="font-mono text-[10px] text-stamp whitespace-nowrap mt-1">{error}</p>
      )}
    </div>
  );
}
