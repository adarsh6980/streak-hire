"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PostmarkLogo } from "./postmark-logo";
import { cn } from "@/lib/utils";

// Nav labels are systemic/navigational, not authored copy — Mono-Means-System
// Rule (DESIGN.md) reserves Space Mono for exactly this kind of element.
const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Applications", href: "/applications" },
  { label: "Action Centre", href: "/action-centre" },
  { label: "Calendar", href: "/calendar" },
  { label: "Companies", href: "/companies" },
  { label: "Analytics", href: "/analytics" },
  { label: "Inbox Activity", href: "/inbox-activity" },
  { label: "Extension", href: "/extension" },
  { label: "Settings", href: "/settings" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-ink/10 bg-paper-light/60 flex flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-6 py-6 group">
        <PostmarkLogo className="w-7 h-7 text-stamp" />
        <span className="font-display font-bold text-lg text-ink">Streakhire</span>
      </Link>

      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md font-mono text-[13px] tracking-tight transition-colors",
                // Tilt-Not-Lift Rule: no hover-lift shadow anywhere in this
                // list — only a background/color shift on hover and active.
                active
                  ? "bg-stamp text-paper-light"
                  : "text-ink-soft hover:bg-ink/5 hover:text-ink"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-ink/10">
        <a
          href="/"
          className="block px-3 py-2 rounded-md font-mono text-[13px] text-ink-soft hover:bg-ink/5 hover:text-ink transition-colors"
        >
          ← Marketing site
        </a>
      </div>
    </aside>
  );
}
