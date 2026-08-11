"use client";

import { useExtensionInstalled } from "@/lib/use-extension-installed";

// Thin client wrapper around the existing install-detection hook
// (src/lib/use-extension-installed.ts) — a postMessage-style ping via
// chrome.runtime.sendMessage against the extension's `externally_connectable`
// allowlist (extension/manifest.json). Reused as-is, not rebuilt: this
// component only turns its three states into the small status pill shown on
// this page.
export function ExtensionInstallStatus() {
  const status = useExtensionInstalled();

  if (status === "checking") {
    return (
      <span className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-wide text-ink-soft">
        <span className="h-2 w-2 rounded-full bg-ink/25 animate-pulse" aria-hidden />
        Checking…
      </span>
    );
  }

  const installed = status === "installed";
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[12px] uppercase tracking-wide text-ink">
      <span
        className={`h-2 w-2 rounded-full ${installed ? "bg-offer" : "bg-ink/25"}`}
        aria-hidden
      />
      {installed ? "Installed" : "Not installed"}
    </span>
  );
}
