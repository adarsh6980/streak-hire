"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "idle" | "confirming" | "loading" | "error";

// Client piece for the Settings page's "Disconnect Gmail" action. POSTs to
// the new src/app/api/settings/gmail/disconnect/route.ts, which only flips
// gmail.status to "disconnected" — it does not revoke access on Google's
// side and does not delete the stored refresh token (see that route's own
// comment for why). This button's copy in the page's privacy section is
// written to be honest about that, not to imply a full revoke happens here.
export function DisconnectGmailButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/settings/gmail/disconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setErrorMessage(typeof data?.error === "string" ? data.error : "Failed to disconnect.");
        return;
      }
      router.refresh();
    } catch {
      setStatus("error");
      setErrorMessage("Failed to disconnect — could not reach the server.");
    }
  }

  if (status === "confirming") {
    return (
      <div className="inline-flex flex-wrap items-center gap-3">
        <span className="font-body text-sm text-ink-soft">Disconnect Gmail?</span>
        <button
          type="button"
          onClick={handleConfirm}
          className="inline-flex items-center justify-center rounded-full border border-ink/20 font-mono text-xs uppercase tracking-wide px-4 py-2 text-ink hover:border-ink/40 transition-colors"
        >
          Yes, disconnect
        </button>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="font-mono text-xs uppercase tracking-wide text-ink-soft hover:text-ink transition-colors"
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
        className="inline-flex items-center justify-center rounded-full bg-paper-light border border-ink/20 font-mono text-sm uppercase tracking-wide px-6 py-3 text-ink hover:border-ink/40 transition-colors disabled:opacity-60"
      >
        {status === "loading" ? "Disconnecting…" : "Disconnect Gmail"}
      </button>
      {status === "error" && errorMessage && (
        <p className="mt-3 font-body text-sm text-stamp">{errorMessage}</p>
      )}
    </div>
  );
}
