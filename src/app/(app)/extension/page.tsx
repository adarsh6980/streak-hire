import { ExtensionInstallStatus } from "./extension-status";

// Server Component. Reuses the existing download asset
// (public/streakhire-extension.zip) and link pattern from
// src/components/install.tsx's marketing-site install section rather than
// rebuilding either — same href, same `download` attribute.
export default function ExtensionPage() {
  return (
    <div className="max-w-3xl px-6 sm:px-10 py-10 sm:py-14">
      <h1 className="font-display font-bold text-3xl tracking-tight text-ink">Extension</h1>
      <p className="mt-2 font-body text-ink-soft leading-relaxed">
        A quick-capture safety net for applications Gmail sync won&rsquo;t see.
      </p>

      <section className="mt-10 rounded-2xl border border-ink/12 bg-paper-light p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display font-bold text-xl text-ink">Browser extension</h2>
          <ExtensionInstallStatus />
        </div>

        <p className="mt-4 font-body text-sm text-ink-soft leading-relaxed">
          Gmail sync (see Settings) is the core of Streakhire now — it&rsquo;s what keeps your
          pipeline up to date without you doing anything. The extension is a secondary tool on top
          of that: it works directly on the page while you&rsquo;re applying, which is useful for
          catching things before an email ever shows up, or on sites Gmail sync doesn&rsquo;t
          search.
        </p>

        <div className="mt-5 space-y-2 font-body text-sm text-ink-soft leading-relaxed">
          <p>Today, on a page it recognizes, it does two things:</p>
          <ul className="list-disc list-inside space-y-1 marker:text-stamp">
            <li>
              On LinkedIn, Greenhouse, Lever, and Workday job postings, plus IrishJobs.ie,
              Jobs.ie, and PublicJobs.ie, it watches for a successful submission and logs the
              application automatically — no click needed.
            </li>
            <li>
              On any other page that looks like a job application (an &ldquo;apply&rdquo; URL, or
              a résumé/CV upload field), it shows a small one-click &ldquo;log this
              application&rdquo; widget as a fallback.
            </li>
          </ul>
          <p>
            It doesn&rsquo;t read your email or touch your Gmail connection — that&rsquo;s handled
            entirely by the server-side sync described on the Settings page.
          </p>
        </div>

        <div className="mt-6">
          <a
            href="/streakhire-extension.zip"
            download
            className="inline-flex items-center justify-center gap-2 rounded-full bg-stamp text-paper-light font-mono text-sm uppercase tracking-wide px-6 py-3 shadow-stamp hover:bg-stamp-dark transition-colors"
          >
            Download the extension
          </a>
          <p className="mt-3 font-mono text-[12px] text-ink-soft">
            .zip · load unpacked at chrome://extensions (same steps work in Comet)
          </p>
        </div>
      </section>
    </div>
  );
}
