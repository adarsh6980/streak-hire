"use client";

import { motion } from "framer-motion";

// Add a second tier here later (e.g. a paid "Certified Mail" plan) and the
// layout below adapts automatically — single tier centers itself, two or
// more lay out side by side.
const TIERS = [
  {
    name: "First Class",
    price: "Free",
    period: "forever",
    tagline: "Everything Streakhire does, for everyone.",
    features: [
      "Unlimited auto-postmarked applications",
      "Chrome & Comet extension",
      "Daily streak tracking",
      "Full pipeline dashboard (Applied → Offer)",
      "Notes & resume tracking per application",
      "Follow-up reminders",
    ],
    cta: "Add to Chrome",
    highlight: true,
  },
];

export function Pricing() {
  const gridCols =
    TIERS.length === 1
      ? "grid-cols-1 max-w-md"
      : TIERS.length === 2
      ? "sm:grid-cols-2 max-w-3xl"
      : "sm:grid-cols-2 lg:grid-cols-3 max-w-5xl";

  return (
    <section id="pricing" className="relative py-24 sm:py-32 bg-paper">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-xl mx-auto"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-balance">
            {TIERS.length === 1
              ? "Free. No catch, no upgrade prompt."
              : "Free to start. Upgrade if the search runs long."}
          </h2>
        </motion.div>

        <div className={`mt-14 grid gap-6 mx-auto ${gridCols}`}>
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.1 }}
              className={`relative rounded-2xl p-7 sm:p-8 flex flex-col ${
                tier.highlight
                  ? "bg-ink text-paper-light border-2 border-ink shadow-stamp"
                  : "bg-paper-light border border-ink/15"
              }`}
            >
              {tier.highlight && TIERS.length > 1 && (
                <span className="absolute -top-3 left-7 rounded-full bg-stamp text-paper-light font-mono text-[10px] uppercase tracking-widest px-3 py-1">
                  Most popular
                </span>
              )}
              <h3 className="font-display font-bold text-xl">{tier.name}</h3>
              <p
                className={`mt-1 text-sm ${
                  tier.highlight ? "text-paper-light/70" : "text-ink-soft"
                }`}
              >
                {tier.tagline}
              </p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="font-display font-bold text-4xl">
                  {tier.price}
                </span>
                <span
                  className={`font-mono text-sm ${
                    tier.highlight ? "text-paper-light/70" : "text-ink-soft"
                  }`}
                >
                  {tier.period}
                </span>
              </div>

              <ul className="mt-6 space-y-3 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <svg
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        tier.highlight ? "text-stamp-light" : "text-stamp"
                      }`}
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M3 8.5L6.5 12L13 4.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span
                      className={
                        tier.highlight ? "text-paper-light/90" : "text-ink-soft"
                      }
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="/streakhire-extension.zip"
                download
                className={`mt-8 inline-flex items-center justify-center rounded-full font-mono text-sm uppercase tracking-wide px-5 py-3 transition-colors ${
                  tier.highlight
                    ? "bg-stamp text-paper-light hover:bg-stamp-light"
                    : "border border-ink/20 hover:border-ink/40"
                }`}
              >
                {tier.cta}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
