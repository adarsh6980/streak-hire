"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useExtensionInstalled } from "@/lib/use-extension-installed";

const STEPS = [
  {
    num: "1",
    title: "Download the .zip",
    body: "One file, works for both Chrome and Comet — they're both Chromium-based.",
  },
  {
    num: "2",
    title: "Unzip it",
    body: "Double-click the downloaded file to extract the streakhire-extension folder.",
  },
  {
    num: "3",
    title: "Open chrome://extensions",
    body: "Same address works in Comet. Toggle on Developer mode, top right.",
  },
  {
    num: "4",
    title: "Load unpacked",
    body: "Click it, select the unzipped folder. Streakhire appears in your toolbar.",
  },
];

export function Install() {
  const status = useExtensionInstalled();

  return (
    <section id="install" className="relative py-24 sm:py-32 bg-paper-light border-t border-ink/10">
      <div className="mx-auto max-w-4xl px-5 sm:px-8 text-center">
        <AnimatePresence mode="wait">
          {status === "installed" ? (
            <motion.div
              key="installed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="mx-auto w-14 h-14 rounded-full bg-offer/10 border-2 border-offer text-offer flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 12.5L10 17.5L19 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h2 className="mt-5 font-display font-bold text-3xl sm:text-4xl tracking-tight text-balance">
                Streakhire is already postmarking.
              </h2>
              <p className="mt-4 font-body text-ink-soft max-w-lg mx-auto leading-relaxed">
                You&rsquo;re all set — click the postmark icon in your toolbar
                any time to check your streak or open the dashboard.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="not-installed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: status === "checking" ? 0 : 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-tight text-balance">
                  Get Streakhire in about a minute.
                </h2>
                <p className="mt-4 font-body text-ink-soft max-w-lg mx-auto leading-relaxed">
                  We&rsquo;re not on the Chrome Web Store yet, so it&rsquo;s a quick
                  manual install rather than one click — still just four
                  steps, no technical knowledge required.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-8 flex flex-col sm:flex-row gap-3 justify-center"
              >
                <a
                  href="/streakhire-extension.zip"
                  download
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-stamp text-paper-light font-mono text-sm uppercase tracking-wide px-6 py-3.5 shadow-stamp hover:bg-stamp-dark transition-colors"
                >
                  Download the extension
                </a>
              </motion.div>

              <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-left">
                {STEPS.map((step, i) => (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                  >
                    <div className="w-10 h-10 rounded-full bg-paper border-2 border-stamp text-stamp flex items-center justify-center font-mono font-bold text-sm">
                      {step.num}
                    </div>
                    <h3 className="mt-3 font-display font-bold text-base">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 font-body text-sm text-ink-soft leading-relaxed">
                      {step.body}
                    </p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
