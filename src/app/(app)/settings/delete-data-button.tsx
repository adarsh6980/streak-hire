"use client";

import { useState } from "react";

type Status = "idle" | "confirming" | "loading" | "done" | "error";

// Client piece for the Settings page's "Delete my data" action — the plan's
// explicit requirement for a real delete action, not a support-email
// promise. POSTs to src/app/api/settings/delete-data/route.ts, which
// deletes every application + timeline event + the user doc itself
// (irreversible), then clears the session cookie server-side. Since the
// account no longer exists after this succeeds, a plain router.refresh()
// would just bounce through the signed-out redirect with no explanation —
// this shows a final confirmation message and a link home instead.
export function DeleteDataButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/settings/delete-data", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setErrorMessage(typeof data?.error === "string" ? data.error : "Failed to delete data.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMessage("Failed to delete data — could not reach the server.");
    }
  }

  if (status === "done") {
    return (
      <p className="font-body text-sm text-ink">
        Your data has been deleted. <a href="/" className="underline font-medium">Back to Streakhire</a>.
      </p>
    );
  }

  if (status === "confirming") {
    return (
      <div className="inline-flex flex-wrap items-center gap-3">
        <span className="font-body text-sm text-stamp font-medium">
          This deletes every application, every timeline event, and disconnects Gmail —
          permanently. Are you sure?
        </span>
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center justify-center rounded-full bg-stamp text-paper-light font-mono text-xs uppercase tracking-wide px-4 py-2 hover:bg-stamp-dark transition-colors shrink-0"
        >
          Yes, delete everything
        </button>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink transition-colors shrink-0"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setStatus("confirming")}
        disabled={status === "loading"}
        className="inline-flex items-center justify-center rounded-full bg-paper-light border border-ink/20 font-mono text-sm uppercase tracking-wide px-6 py-3 text-ink hover:border-stamp hover:text-stamp transition-colors disabled:opacity-60"
      >
        {status === "loading" ? "Deleting…" : "Delete my data"}
      </button>
      {status === "error" && errorMessage && (
        <p className="mt-3 font-body text-sm text-stamp">{errorMessage}</p>
      )}
    </div>
  );
}
