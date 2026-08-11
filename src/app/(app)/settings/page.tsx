import { getSession } from "@/lib/server/session";
import { adminGetUserGmailConnection } from "@/lib/server/firestore-admin";
import { SyncGmailButton } from "./sync-gmail-button";
import { DisconnectGmailButton } from "./disconnect-gmail-button";
import { DeleteDataButton } from "./delete-data-button";

function formatTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Server Component — reads the Gmail connection straight from Firestore via
// the service-account admin path (never the client-readable idToken path,
// per firestore-admin.ts's own header comment on why the refresh token and
// its status live there). This section doubles as Phase 8's privacy
// requirement: the product spec wants privacy treated as a visible feature,
// not fine print, so it isn't tucked below a fold or behind an accordion.
export default async function SettingsPage() {
  const session = await getSession();
  // The (app) route group's layout already redirects signed-out visitors
  // before this page renders; this is just a defensive fallback, not the
  // real gate.
  if (!session) return null;

  const gmail = await adminGetUserGmailConnection(session.uid);
  const status = typeof gmail?.status === "string" ? gmail.status : null;
  const isConnected = status === "connected";
  const needsReconnect = status === "needs_reconnect";
  const hasStoredConnection = isConnected || needsReconnect;

  const connectedAt = formatTimestamp(gmail?.connectedAt);
  const lastSyncedAt = formatTimestamp(gmail?.lastSyncedAt);

  return (
    <div className="max-w-3xl px-6 sm:px-10 py-10 sm:py-14">
      <h1 className="font-display font-bold text-3xl tracking-tight text-ink">Settings</h1>
      <p className="mt-2 font-body text-ink-soft leading-relaxed">
        Manage your Gmail connection and see exactly what Streakhire is allowed to read.
      </p>

      <section className="mt-10 rounded-2xl border border-ink/12 bg-paper-light p-6 sm:p-8">
        <h2 className="font-display font-bold text-xl text-ink">Privacy &amp; Gmail Connection</h2>

        {/* Status row */}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="inline-flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-offer" : needsReconnect ? "bg-stamp" : "bg-ink/25"
              }`}
              aria-hidden
            />
            <span className="font-mono text-[12px] uppercase tracking-wide text-ink">
              {isConnected ? "Connected" : needsReconnect ? "Needs reconnect" : "Not connected"}
            </span>
          </div>
          {connectedAt && (
            <span className="font-mono text-[12px] text-ink-soft">Connected {connectedAt}</span>
          )}
          {lastSyncedAt && (
            <span className="font-mono text-[12px] text-ink-soft">Last synced {lastSyncedAt}</span>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap items-start gap-4">
          {!isConnected && (
            <a
              href="/api/auth/google"
              className="inline-flex items-center justify-center rounded-full bg-stamp text-paper-light font-mono text-sm uppercase tracking-wide px-6 py-3 shadow-stamp hover:bg-stamp-dark transition-colors"
            >
              {needsReconnect ? "Reconnect Gmail" : "Connect Gmail"}
            </a>
          )}
          {isConnected && <SyncGmailButton />}
          {hasStoredConnection && <DisconnectGmailButton />}
        </div>

        {/* Plain-language privacy copy */}
        <dl className="mt-8 pt-6 border-t border-dashed border-ink/15 space-y-5">
          <div>
            <dt className="font-display font-bold text-sm text-ink">What we ask for</dt>
            <dd className="mt-1 font-body text-sm text-ink-soft leading-relaxed">
              Read-only Gmail access — the{" "}
              <code className="font-mono text-[12px] text-ink bg-paper px-1.5 py-0.5 rounded">
                gmail.readonly
              </code>{" "}
              scope. Streakhire can read mail. It cannot send, delete, or modify anything in your
              inbox. Full stop.
            </dd>
          </div>

          <div>
            <dt className="font-display font-bold text-sm text-ink">What we look at</dt>
            <dd className="mt-1 font-body text-sm text-ink-soft leading-relaxed">
              Three things per candidate email: who it&rsquo;s from, the subject line, and
              Gmail&rsquo;s own short preview snippet — never the full email body. That&rsquo;s a
              deliberate limit, not a technical shortcut. One tradeoff worth knowing: we use
              Google&rsquo;s Gemini (free tier) to read those snippets, and on that tier Google may
              have automated systems — and in some cases human reviewers — look at what we send it
              and use it to improve their models. Keeping what we send small is exactly why we only
              send the snippet, not the whole email.
            </dd>
          </div>

          <div>
            <dt className="font-display font-bold text-sm text-ink">What we store</dt>
            <dd className="mt-1 font-body text-sm text-ink-soft leading-relaxed">
              When an email looks job-related, we store the company, role, and status we extracted
              from it, plus a reference to the Gmail message ID so we don&rsquo;t process the same
              email twice. We never store the raw email text or HTML.
            </dd>
          </div>

          <div>
            <dt className="font-display font-bold text-sm text-ink">How to disconnect</dt>
            <dd className="mt-1 font-body text-sm text-ink-soft leading-relaxed">
              Use the Disconnect button above any time. It immediately stops Streakhire from
              syncing new mail. It does not revoke Streakhire&rsquo;s access on Google&rsquo;s
              side — to fully cut access, also remove Streakhire from{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                your Google Account&rsquo;s third-party access page
              </a>
              .
            </dd>
          </div>

          <div>
            <dt className="font-display font-bold text-sm text-ink">Why you might get asked to reconnect</dt>
            <dd className="mt-1 font-body text-sm text-ink-soft leading-relaxed">
              Streakhire&rsquo;s Google sign-in isn&rsquo;t publicly verified yet — it&rsquo;s
              running in Google&rsquo;s &ldquo;Testing&rdquo; mode while we&rsquo;re pre-launch.
              One side effect: Google expires test access on its own schedule, not ours.
            </dd>
            <dd className="mt-2 font-mono text-[12px] uppercase tracking-wide text-ink-soft">
              In practice, expect a reconnect prompt roughly every 7 days.
            </dd>
          </div>

          <div>
            <dt className="font-display font-bold text-sm text-ink">How to delete your data</dt>
            <dd className="mt-1 font-body text-sm text-ink-soft leading-relaxed">
              Below is a real delete action, not a support-ticket promise: it removes every
              application you have, every timeline event under them, and the Gmail connection
              itself, immediately and permanently. There is no undo — export anything you want to
              keep first.
            </dd>
            <div className="mt-3">
              <DeleteDataButton />
            </div>
          </div>
        </dl>
      </section>
    </div>
  );
}
