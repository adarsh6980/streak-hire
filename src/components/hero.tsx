"use client";

import { motion } from "framer-motion";
import { PostmarkLogo } from "./postmark-logo";

const STREAK = [
  { day: "M", stamped: true },
  { day: "T", stamped: true },
  { day: "W", stamped: true },
  { day: "T", stamped: true },
  { day: "F", stamped: true },
  { day: "S", stamped: false },
  { day: "S", stamped: false },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-kraft-texture-layer pt-32 pb-24 sm:pt-40 sm:pb-32"
    >
      {/* cancellation-mark backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] text-ink cancel-lines"
        style={{ maskImage: "linear-gradient(to bottom, black, transparent 70%)" }}
      />
      <div className="absolute top-0 inset-x-0 h-2 bg-airmail-stripe bg-[length:40px_8px]" />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-8 grid lg:grid-cols-[1.05fr_0.95fr] gap-16 items-center">
        {/* Copy column */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="font-display font-bold text-[2.6rem] leading-[1.05] sm:text-6xl sm:leading-[1.02] tracking-tight text-balance">
            Your job hunt,
            <br />
            <span className="relative inline-block">
              postmarked
              <svg
                className="absolute -bottom-1 left-0 w-full text-stamp"
                viewBox="0 0 200 12"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M2 8C40 2 160 2 198 8"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>{" "}
            automatically.
          </h1>

          <p className="mt-6 font-body text-lg text-ink-soft max-w-md leading-relaxed">
            Streakhire stamps every application the instant you hit submit — on
            any job site. No spreadsheets, no copy-pasting. Your streak and
            pipeline just… update themselves.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a
              href="/streakhire-extension.zip"
              download
              className="inline-flex items-center justify-center gap-2 rounded-full bg-stamp text-paper-light font-mono text-sm uppercase tracking-wide px-6 py-3.5 shadow-stamp hover:bg-stamp-dark transition-colors"
            >
              Download for Chrome — free
            </a>
            <a
              href="/streakhire-extension.zip"
              download
              className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 bg-paper-light font-mono text-sm uppercase tracking-wide px-6 py-3.5 hover:border-ink/40 transition-colors"
            >
              Download for Comet
            </a>
          </div>

          <p className="mt-4 font-mono text-xs text-ink-soft/80 tracking-wide">
            Not on the Web Store yet —{" "}
            <a href="#install" className="underline hover:text-ink">
              see the 1-minute setup ↓
            </a>
          </p>
        </motion.div>

        {/* Postmark demo column */}
        <motion.div
          initial={{ opacity: 0, y: 32, rotate: -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: -1.5 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="relative"
        >
          <div className="relative rounded-2xl border border-ink/15 bg-paper-light shadow-stamp p-5 sm:p-6">
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-airmail flex items-center justify-center rotate-[-12deg] shadow-md">
              <PostmarkLogo className="w-5 h-5 text-paper-light" />
            </div>

            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-ink-soft border-b border-dashed border-ink/15 pb-3">
              <span>Tracking No. PC-04821</span>
              <span>Greenhouse.io</span>
            </div>

            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="font-display font-bold text-lg leading-tight">
                  Senior Product Designer
                </p>
                <p className="font-body text-sm text-ink-soft mt-0.5">
                  Fieldnote Studio
                </p>
              </div>

              <motion.div
                initial={{ scale: 2.4, opacity: 0, rotate: -18 }}
                animate={{ scale: 1, opacity: 1, rotate: -18 }}
                transition={{
                  duration: 0.45,
                  delay: 1.1,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
                className="shrink-0"
              >
                <div className="postmark-ring w-16 h-16 flex flex-col items-center justify-center text-stamp border-2 border-stamp rotate-[-18deg]">
                  <span className="font-mono text-[8px] font-bold leading-none tracking-wider">
                    APPLIED
                  </span>
                  <span className="font-mono text-[7px] leading-none mt-0.5">
                    AUTO
                  </span>
                </div>
              </motion.div>
            </div>

            <div className="mt-5 flex items-center gap-2 font-mono text-[11px] text-ink-soft">
              <span className="w-1.5 h-1.5 rounded-full bg-offer" />
              Logged automatically · 0.4s ago
            </div>
          </div>

          {/* streak strip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.5 }}
            className="mt-5 rounded-2xl border border-ink/15 bg-paper-light/80 p-4 flex items-center justify-between gap-3 rotate-[0.6deg]"
          >
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-soft">
                Current streak
              </p>
              <p className="font-display font-bold text-2xl leading-none mt-1">
                14 days
              </p>
            </div>
            <div className="flex gap-1.5">
              {STREAK.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="font-mono text-[9px] text-ink-soft/70">
                    {d.day}
                  </span>
                  <div
                    className={`w-6 h-6 rounded-full border flex items-center justify-center ${
                      d.stamped
                        ? "border-stamp text-stamp"
                        : "border-ink/15 text-ink/20"
                    }`}
                  >
                    {d.stamped && (
                      <div className="w-2.5 h-2.5 rounded-full bg-stamp" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
