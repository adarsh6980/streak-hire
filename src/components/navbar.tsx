"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PostmarkLogo } from "./postmark-logo";

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -72 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 20 }}
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "bg-paper-light/90 backdrop-blur border-b border-ink/10"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      {scrolled && (
        <div className="h-[3px] w-full bg-airmail-stripe bg-[length:40px_3px]" />
      )}
      <nav className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2 group">
          <PostmarkLogo className="w-7 h-7 text-stamp group-hover:rotate-[-8deg] transition-transform duration-300" />
          <span className="font-display font-bold text-lg tracking-tight">
            Streakhire
          </span>
        </a>

        <ul className="hidden md:flex items-center gap-8 font-mono text-[13px] uppercase tracking-wide text-ink-soft">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="relative py-1 hover:text-ink transition-colors after:absolute after:left-0 after:-bottom-0.5 after:h-[1.5px] after:w-0 after:bg-stamp after:transition-all hover:after:w-full"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="/streakhire-extension.zip"
            download
            className="inline-flex items-center gap-2 rounded-full bg-stamp text-paper-light font-mono text-[13px] uppercase tracking-wide px-4 py-2 shadow-stamp hover:bg-stamp-dark transition-colors"
          >
            Install free
          </a>
        </div>

        <button
          className="md:hidden p-2 -mr-2 text-ink"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            {open ? (
              <path d="M5 5L17 17M17 5L5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <>
                <path d="M3 6H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M3 11H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M3 16H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="md:hidden bg-paper-light border-t border-ink/10 overflow-hidden"
        >
          <ul className="flex flex-col px-5 py-4 gap-4 font-mono text-sm uppercase tracking-wide">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="/streakhire-extension.zip"
                download
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-full bg-stamp text-paper-light px-4 py-2"
              >
                Install free
              </a>
            </li>
          </ul>
        </motion.div>
      )}
    </motion.header>
  );
}
