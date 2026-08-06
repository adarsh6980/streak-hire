"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FAQS = [
  {
    q: "How does the extension know I applied?",
    a: "When you submit an application on a job site, Streakhire recognizes the submission and captures the role, company, and date directly from the page — no copy-pasting, no manual entry. It only activates on application flows, not general browsing.",
  },
  {
    q: "Does it work on every job site?",
    a: "Streakhire is built to work broadly across job boards and application forms, including LinkedIn, Greenhouse, Lever, Workday, and most company career pages. If a site uses an unusual application flow, you can always log an application manually as a fallback.",
  },
  {
    q: "What happens if I miss a day?",
    a: "Your streak pauses, not your progress — every application you've logged stays exactly where it is. You just start a new streak the next time you apply.",
  },
  {
    q: "Why Comet specifically, not just Chrome?",
    a: "Comet is a first-class target for us, not an afterthought — the extension ships and is tested for both from day one.",
  },
  {
    q: "Is my application data private?",
    a: "Yes. Your application history is visible only to you. The extension only reads data related to job application submissions — it doesn't track general browsing.",
  },
  {
    q: "Can I use Streakhire without the extension?",
    a: "Yes — you can log applications manually in the dashboard. The extension just removes that step entirely, which is what keeps streaks alive.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative py-24 sm:py-32 bg-paper-light">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight">
            Questions, answered plainly.
          </h2>
        </motion.div>

        <div className="mt-12 divide-y divide-ink/12 border-t border-b border-ink/12">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left group"
                  aria-expanded={isOpen}
                >
                  <span className="font-display font-bold text-base sm:text-lg">
                    {item.q}
                  </span>
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                      isOpen
                        ? "border-stamp text-stamp"
                        : "border-ink/25 text-ink-soft group-hover:border-ink/50"
                    }`}
                  >
                    <motion.svg
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25 }}
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M7 1V13M1 7H13"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </motion.svg>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-5 font-body text-sm text-ink-soft leading-relaxed max-w-xl">
                        {item.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
