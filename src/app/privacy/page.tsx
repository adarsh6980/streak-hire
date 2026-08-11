import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Privacy — Streakhire",
  description:
    "What Gmail permission Streakhire asks for, what it reads, what it stores, and how to disconnect or delete your data.",
};

// Public marketing-site page (no sign-in required) — the footer's "Privacy"
// link previously pointed at "#", a placeholder. This is the real page,
// linked from Google's OAuth consent screen ("Branding" tab) as well as the
// footer. Content mirrors the in-app Settings page's privacy section
// (src/app/(app)/settings/page.tsx) but written for a logged-out visitor
// deciding whether to connect Gmail at all, not someone already connected —
// same facts, no login-gated details assumed as context.
export default function PrivacyPage() {
  return (
    <main>
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 sm:px-8 pt-32 pb-24">
        <h1 className="font-display font-bold text-4xl tracking-tight text-ink">Privacy</h1>
        <p className="mt-3 font-body text-ink-soft leading-relaxed">
          Gmail is the core of how Streakhire works, so this page isn&rsquo;t a legal formality —
          it&rsquo;s the actual, specific answer to &ldquo;what does connecting Gmail let this app
          do.&rdquo;
        </p>

        <div className="mt-10 space-y-8">
          <section>
            <h2 className="font-display font-bold text-lg text-ink">What we ask for</h2>
            <p className="mt-2 font-body text-sm text-ink-soft leading-relaxed">
              Read-only Gmail access — the{" "}
              <code className="font-mono text-[12px] text-ink bg-paper-light px-1.5 py-0.5 rounded">
                gmail.readonly
              </code>{" "}
              scope. Streakhire can read mail. It cannot send, delete, or modify anything in your
              inbox. Full stop.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-ink">What we look at</h2>
            <p className="mt-2 font-body text-sm text-ink-soft leading-relaxed">
              Three things per candidate email: who it&rsquo;s from, the subject line, and
              Gmail&rsquo;s own short preview snippet — never the full email body. That&rsquo;s a
              deliberate limit, not a technical shortcut. One tradeoff worth knowing: we use
              Google&rsquo;s Gemini (free tier) to read those snippets, and on that tier Google
              may have automated systems — and in some cases human reviewers — look at what we
              send it and use it to improve their models. Keeping what we send small is exactly
              why we only send the snippet, not the whole email.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-ink">What we store</h2>
            <p className="mt-2 font-body text-sm text-ink-soft leading-relaxed">
              When an email looks job-related, we store the company, role, and status we
              extracted from it, plus a reference to the Gmail message ID so we don&rsquo;t
              process the same email twice. We never store the raw email text or HTML.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-ink">
              How to disconnect or delete your data
            </h2>
            <p className="mt-2 font-body text-sm text-ink-soft leading-relaxed">
              Both live under Settings once you&rsquo;re signed in — a Disconnect button that
              stops new syncing immediately, and a separate Delete my data action that
              permanently removes every application, every timeline event, and the Gmail
              connection itself. Disconnecting on our side doesn&rsquo;t revoke access on
              Google&rsquo;s — for that, remove Streakhire from{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                your Google Account&rsquo;s third-party access page
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-ink">
              Why you might get asked to reconnect
            </h2>
            <p className="mt-2 font-body text-sm text-ink-soft leading-relaxed">
              Streakhire&rsquo;s Google sign-in isn&rsquo;t publicly verified yet — it&rsquo;s
              pre-launch, so Google treats it as an unverified app and expires access on its own
              schedule, not ours. In practice, expect a reconnect prompt roughly every 7 days.
              This is a known, temporary limitation, not a bug.
            </p>
          </section>

          <section>
            <h2 className="font-display font-bold text-lg text-ink">The browser extension</h2>
            <p className="mt-2 font-body text-sm text-ink-soft leading-relaxed">
              The extension is separate from Gmail sync and doesn&rsquo;t read your email. On
              recognized job sites it shows a one-click &ldquo;Add to tracker&rdquo; prompt after
              you submit an application — nothing is written until you click it.
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </main>
  );
}
