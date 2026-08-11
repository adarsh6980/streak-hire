"use client";

// Notes textarea for the Application detail page. Explicit "Save notes"
// button rather than blur-to-save — a blur-save is easy to trigger
// accidentally (tabbing away, clicking another section) with no visible
// confirmation, and this page already has several other sections below the
// textarea to tab through. Same PATCH-then-router.refresh() shape as every
// other client mutation piece on this page (StatusSelect, DetailTaskCheckbox).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function NotesEditor({
  applicationId,
  initialNotes,
}: {
  applicationId: string;
  initialNotes: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialNotes);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = value !== initialNotes;

  function handleSave() {
    setError(null);
    setJustSaved(false);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: value }),
        });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        setJustSaved(true);
        router.refresh();
      } catch {
        setError("Couldn't save — try again.");
      }
    });
  }

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setJustSaved(false);
        }}
        rows={5}
        placeholder="Add notes about this application…"
        className="w-full rounded-2xl border border-ink/15 bg-paper-light px-4 py-3 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus:border-ink/30 resize-y"
      />
      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !dirty}
          className={cn(
            "font-mono text-[11px] uppercase tracking-wide px-4 py-2 rounded-full transition-colors",
            pending || !dirty
              ? "bg-ink/10 text-ink-soft/50 cursor-not-allowed"
              : "bg-stamp text-paper-light hover:bg-stamp-dark"
          )}
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
        {justSaved && !dirty && (
          <span className="font-mono text-[11px] text-offer">Saved</span>
        )}
        {error && <span className="font-mono text-[11px] text-stamp">{error}</span>}
      </div>
    </div>
  );
}
