import { PostmarkLogo } from "./postmark-logo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how-it-works" },
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Get the extension",
    links: [
      { label: "Download (Chrome & Comet)", href: "/streakhire-extension.zip", download: true },
      { label: "Install instructions", href: "#install" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative bg-ink text-paper-light">
      <div className="h-2 w-full bg-airmail-stripe bg-[length:40px_8px]" />
      <div className="mx-auto max-w-6xl px-5 sm:px-8 py-16">
        <div className="grid sm:grid-cols-2 md:grid-cols-[1.3fr_1fr_1fr_1fr] gap-10">
          <div>
            <a href="#top" className="flex items-center gap-2">
              <PostmarkLogo className="w-7 h-7 text-stamp-light" />
              <span className="font-display font-bold text-lg">Streakhire</span>
            </a>
            <p className="mt-3 font-body text-sm text-paper-light/65 max-w-xs leading-relaxed">
              The job tracker that fills itself in. One click, and your
              streak takes care of itself.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[11px] uppercase tracking-widest text-paper-light/65">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      download={"download" in link ? link.download : undefined}
                      className="font-body text-sm text-paper-light/80 hover:text-paper-light transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-paper-light/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="font-mono text-xs text-paper-light/65">
            © {new Date().getFullYear()} Streakhire. Postmarked with care.
          </p>
          <p className="font-mono text-xs text-paper-light/65">
            Tracking No. PC-00001
          </p>
        </div>
      </div>
    </footer>
  );
}
