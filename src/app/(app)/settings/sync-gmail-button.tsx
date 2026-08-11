"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface SyncResult {
  processed: number;
  created: number;
  updated: number;
  queued: number;
}

type Status = "idle" | "loading" | "done" | "needs_reconnect" | "error";

// Client piece for the Settings page's "Sync Gmail now" action. POSTs to the
// EXISTING single-user sync route (src/app/api/sync/gmail/route.ts) — no new
// endpoint for this button, it's just wiring a UI onto what Phase 3 already
// built. That route's own code returns `{error: "needs_reconnect", message}`
// with a 400 status when the stored refresh token was rejected by Google
// (see GmailReconnectRequiredError in gmail-sync.ts); this component special-
// cases that exact shape rather than showing a generic error for it.
export function SyncGmailButton() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick() {
    setStatus("loading");
    setResult(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/sync/gmail", { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data?.error === "needs_reconnect") {
          setStatus("needs_reconnect");
        } else {
          setStatus("error");
          setErrorMessage(typeof data?.error === "string" ? data.error : "Sync failed.");
        }
        return;
      }

      setResult(data as SyncResult);
      setStatus("done");
      router.refresh();
    } catch {
      setStatus("error");
      setErrorMessage("Sync failed — could not reach the server.");
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "loading"}
        className={cn(
          "inline-flex items-center justify-center rounded-full bg-stamp text-paper-light font-mono text-sm uppercase tracking-wide px-6 py-3 shadow-stamp transition-colors",
          status === "loading" ? "opacity-60 cursor-wait" : "hover:bg-stamp-dark"
        )}
      >
        {status === "loading" ? "Syncing…" : "Sync Gmail now"}
      </button>

      {status === "done" && result && (
        <p className="mt-3 font-mono text-[12px] text-ink-soft">
          Processed {result.processed} · Created {result.created} · Updated {result.updated} · Queued{" "}
          {result.queued}
        </p>
      )}

      {status === "needs_reconnect" && (
        <p className="mt-3 font-body text-sm text-stamp">
          Google needs you to reconnect before Streakhire can sync again.{" "}
          <a href="/api/auth/google" className="underline font-medium">
            Reconnect Gmail
          </a>
          .
        </p>
      )}

      {status === "error" && errorMessage && (
        <p className="mt-3 font-body text-sm text-stamp">{errorMessage}</p>
      )}
    </div>
  );
}
