# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion for animation. User-specified explicitly, not delegated.

## Users

Active job seekers currently applying to many jobs over weeks or months. They apply across multiple job sites/boards and struggle to keep track of what they've applied to, stay motivated through a long, often discouraging search, and avoid manually re-entering data they already typed into a job site's own application form.

## Product Purpose

A job application tracker that removes the manual-logging friction that normally kills tracking habits, paired with a Duolingo-style daily streak mechanic that keeps job seekers consistently applying. Success = the user keeps a streak alive because logging costs them zero extra effort, and they can see their application pipeline (applied → response → interview → offer) update itself.

## Positioning

Zero-effort auto-capture is the core mechanism: a one-click browser extension (Chrome, and Comet — the user's own most-used browser) detects when the user submits a job application on any job site and automatically logs it to their tracker — no manual data entry, no copy-pasting into a spreadsheet or Notion board. This is explicitly the thing a spreadsheet, Notion, or Trello-style Kanban tracker cannot do: those all require the user to remember to go log the application after the fact, which is exactly the step that breaks streaks and causes people to abandon tracking. The streak/gamification layer is the retention hook sitting on top of that auto-capture engine — the pitch is "auto-tracking is what makes the streak actually survive."

## Operating Context

- Job seeker applies to jobs on various job boards/company sites (LinkedIn, Greenhouse, Lever, Workday, company career pages, etc.) in their normal browser.
- The extension runs in the background and detects a submitted application, logging it automatically to the user's tracker dashboard.
- The tracker shows a running daily/weekly streak (consecutive days with at least one logged application) and a pipeline view of application statuses.
- Primary install/CTA path is the browser extension (Chrome Web Store + Comet browser support called out explicitly, since Comet is the user's most-used browser).

## Capabilities and Constraints

- One-click extension install and one-click auto-logging (no manual form-filling per application).
- Works across "any job site" per the brief — specific site-by-site compatibility list not yet confirmed, so avoid enumerating exact supported ATSs as a hard claim.
- Streak tracking (daily/consecutive-day mechanic), pipeline/status tracking (applied, interviewing, offer, rejected, etc.).
- Pricing model not yet defined by the user — build a plausible, clearly-structured free/paid tier layout as a design placeholder, not a confirmed real price.
- No backend/auth/dashboard app exists yet — this is a marketing landing page only; extension and dashboard are described, not built.

## Evidence on Hand

No real testimonials, user counts, customer logos, or star ratings exist yet (pre-launch). Per the user's explicit instruction, the social-proof/testimonial section is being omitted rather than filled with placeholder or fabricated numbers. Do not invent specific user counts, review quotes, or company logos anywhere on the page.

## Product Principles

1. Zero manual effort is the whole pitch — every piece of copy and UI should reinforce "you don't have to do anything, it just tracks itself."
2. The streak is the emotional core (Duolingo-style) — make it feel alive, encouraging, and low-pressure rather than guilt-inducing.
3. Comet gets equal billing with Chrome, not an afterthought — the user explicitly uses Comet most.
4. No fabricated social proof — credibility comes from clearly explaining the mechanism, not from invented numbers.
5. Built for a long, often demoralizing job search — tone should be warm and motivating, not corporate/sterile.

## Accessibility & Inclusion

No product-specific accessibility requirement confirmed yet; build to standard WCAG AA practices (contrast, keyboard nav, reduced-motion support) by default.
