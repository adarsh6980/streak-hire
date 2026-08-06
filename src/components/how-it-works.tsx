"use client";

import { motion } from "framer-motion";

const STEPS = [
  {
    num: "1",
    title: "Install the extension",
    body: "One click, Chrome or Comet. No account required to try it.",
  },
  {
    num: "2",
    title: "Apply like you always do",
    body: "Fill out the application on the job site exactly as normal — LinkedIn, Greenhouse, Lever, a company's own careers page, anywhere.",
  },
  {
    num: "3",
    title: "Streakhire postmarks it",
    body: "The moment you hit submit, Streakhire recognizes it and logs the role, company, and date. You never open the tracker.",
  },
  {
    num: "4",
    title: "Your streak & pipeline update",
    body: "Back in your dashboard, the application is already sorted into your pipeline and your streak has ticked forward.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative py-24 sm:py-32 bg-paper-light border-y border-ink/10"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="max-w-xl"
        >
          <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-balance">
            How an application gets from your browser to your streak.
          </h2>
          <p className="mt-4 font-body text-ink-soft leading-relaxed">
            We&rsquo;re early — no walls of customer logos here yet. Just the exact
            mechanism, so you can see there&rsquo;s nothing to fake.
          </p>
        </motion.div>

        <div className="mt-16 relative">
          <div className="hidden md:block absolute top-6 left-0 right-0 h-px border-t border-dashed border-ink/25" />
          <div className="grid md:grid-cols-4 gap-10 md:gap-6">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative"
              >
                <div className="relative z-10 w-12 h-12 rounded-full bg-paper-light border-2 border-stamp text-stamp flex items-center justify-center font-mono font-bold">
                  {step.num}
                </div>
                <h3 className="mt-4 font-display font-bold text-lg leading-snug">
                  {step.title}
                </h3>
                <p className="mt-2 font-body text-sm text-ink-soft leading-relaxed">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
