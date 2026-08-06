"use client";

import { motion } from "framer-motion";

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-32 bg-paper">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-balance max-w-xl"
        >
          Three moving parts. Zero manual labor.
        </motion.h2>

        <div className="mt-12 grid lg:grid-cols-5 gap-6">
          {/* Auto-postmark — the featured, larger panel */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55 }}
            className="lg:col-span-3 relative rounded-2xl border border-ink/12 bg-paper-light p-7 sm:p-8 flex flex-col sm:flex-row gap-6 items-center overflow-hidden"
          >
            <div className="flex-1 order-2 sm:order-1">
              <h3 className="font-display font-bold text-2xl">
                It stamps itself.
              </h3>
              <p className="mt-3 font-body text-[15px] text-ink-soft leading-relaxed max-w-sm">
                Install the extension once. Every time you submit an
                application — on any job site — Streakhire detects it and logs
                it instantly. Nothing to fill in, nothing to remember.
              </p>
            </div>
            <div className="order-1 sm:order-2 shrink-0 w-full sm:w-44 h-36 rounded-xl bg-kraft-texture-layer border border-ink/8 flex items-center justify-center">
              <div className="postmark-ring w-20 h-20 border-2 border-stamp text-stamp flex flex-col items-center justify-center rotate-[-10deg]">
                <span className="font-mono text-[9px] font-bold tracking-wider">
                  APPLIED
                </span>
                <span className="font-mono text-[8px] mt-0.5">AUTO</span>
              </div>
            </div>
          </motion.div>

          {/* Streak + Routing — stacked, lighter treatment */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="flex-1 rounded-2xl border border-ink/12 bg-paper-light p-6 flex items-center gap-5"
            >
              <div className="flex items-end gap-1 shrink-0">
                {[3, 5, 4, 6, 8].map((h, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-full bg-stamp/80"
                    style={{ height: `${h * 6}px` }}
                  />
                ))}
              </div>
              <div>
                <h3 className="font-display font-bold text-lg leading-snug">
                  Consistency, made visible.
                </h3>
                <p className="mt-1.5 font-body text-sm text-ink-soft leading-relaxed">
                  A row of daily postmarks that builds momentum. Miss a day
                  and it&rsquo;s fine — Streakhire just waits for the next stamp.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="flex-1 rounded-2xl border border-ink/12 bg-paper-light p-6"
            >
              <h3 className="font-display font-bold text-lg leading-snug">
                Your pipeline, sorted.
              </h3>
              <div className="mt-3 flex flex-col gap-1.5">
                {["Applied", "In transit", "Interview", "Delivered"].map(
                  (label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          i === 3
                            ? "bg-offer"
                            : i === 0
                            ? "bg-stamp"
                            : "bg-airmail"
                        }`}
                      />
                      <span className="font-mono text-[11px] text-ink-soft">
                        {label}
                      </span>
                    </div>
                  )
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
