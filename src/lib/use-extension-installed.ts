"use client";

import { useEffect, useState } from "react";

const EXTENSION_ID = "pdelghcpddcmeolcmhnbldcnbgljeafb";

type InstalledState = "checking" | "installed" | "not-installed";

// Chrome-family browsers only inject `chrome.runtime` into a page when that
// page's origin is allowlisted in an installed extension's
// `externally_connectable` (see extension/manifest.json). So: if the ping
// succeeds, Streakhire is installed; if `chrome.runtime` isn't there at all,
// or the extension doesn't answer, it isn't (or the browser doesn't support
// this — e.g. Firefox/Safari — in which case we fall back to "not-installed"
// so the download instructions still show).
export function useExtensionInstalled(): InstalledState {
  const [state, setState] = useState<InstalledState>("checking");

  useEffect(() => {
    let cancelled = false;

    type ChromeRuntime = {
      sendMessage?: (
        extensionId: string,
        message: unknown,
        responseCallback: (response: { installed?: boolean } | undefined) => void
      ) => void;
      lastError?: unknown;
    };

    const chromeRuntime = (
      window as unknown as { chrome?: { runtime?: ChromeRuntime } }
    ).chrome?.runtime;

    if (!chromeRuntime?.sendMessage) {
      setState("not-installed");
      return;
    }

    const timeout = setTimeout(() => {
      if (!cancelled) setState("not-installed");
    }, 800);

    try {
      chromeRuntime.sendMessage(
        EXTENSION_ID,
        { type: "PING" },
        (response: { installed?: boolean } | undefined) => {
          clearTimeout(timeout);
          if (cancelled) return;
          // Accessing lastError inside the callback is required to avoid
          // Chrome logging an "Unchecked runtime.lastError" console warning.
          const hadError = Boolean(chromeRuntime.lastError);
          setState(!hadError && response?.installed ? "installed" : "not-installed");
        }
      );
    } catch {
      clearTimeout(timeout);
      setState("not-installed");
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  return state;
}
