---
name: Streakhire
description: The job tracker that fills itself in — a postal sorting facility for your job hunt.
colors:
  paper: "#f4ecd9"
  paper-light: "#faf5e9"
  paper-dark: "#e8dcc0"
  kraft: "#d8c39c"
  kraft-dark: "#b89f74"
  ink: "#211a12"
  ink-soft: "#4a4033"
  stamp: "#c8401f"
  stamp-dark: "#9c2f15"
  stamp-light: "#e0592f"
  airmail: "#1f3f6b"
  airmail-light: "#2f5b93"
  offer: "#2f6b45"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "clamp(2.6rem, 6vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.03
    letterSpacing: "-0.02em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Space Mono, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "24px"
  lg: "40px"
  xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.stamp}"
    textColor: "{colors.paper-light}"
    rounded: "{rounded.full}"
    padding: "14px 24px"
  button-primary-hover:
    backgroundColor: "{colors.stamp-dark}"
  button-secondary:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "14px 24px"
  card:
    backgroundColor: "{colors.paper-light}"
    rounded: "{rounded.lg}"
    padding: "28px"
---

# Design System: Streakhire

## Overview

**Creative North Star: "The Sorting Facility"**

Streakhire's world is a postal sorting facility: kraft paper, cancellation-mark ink, tracking numbers, and the specific choreography of a stamp coming down on a form. The system exists to make one claim visible without saying it in copy — that the application was processed by a machine, the instant it arrived, with no one standing over it. Every recurring device (the rotated postmark ring, the dashed cancellation lines, the diagonal airmail stripe) is a piece of sorting-room machinery doing real work, not a texture applied for mood.

The system explicitly refuses two defaults: the dark-SaaS-gradient hero (glossy, nocturnal, un-postal) and the cartoon-mascot gamification layer that most streak products reach for. Warmth here comes from paper and ink, not from a character. Density is unhurried — generous section padding (96–128px vertical rhythm), single-column focus per idea, and confident whitespace around the postmark set-pieces so the stamp motion has room to read.

**Key Characteristics:**
- Kraft/paper ground with postmark-red ink as the sole loud color
- Rubber-stamp rotation (−1.5° to −18°) as the physicality signal, not drop shadows
- Airmail diagonal stripe used as a structural rule at world boundaries, never as decoration
- Space Mono uppercase for anything that reads as a system label (tracking numbers, nav, badges)
- No eyebrow/kicker labels above headings anywhere in the system

## Colors

The palette is a paper-and-ink duotone with a single loud accent; blue and green are administrative, not decorative — they mark state, never mood.

### Primary
- **Postmark Red** (`#c8401f`): The one loud color in the system. Used for the postmark ring, primary CTA fill, active nav underline, active FAQ accordion ring, and the "Applied" pipeline dot. Its hover/pressed state is **Postmark Red Dark** (`#9c2f15`); its on-dark variant is **Postmark Red Light** (`#e0592f`), used for the logo mark and checkmarks against the ink-black footer and the highlighted pricing tier.

### Secondary
- **Airmail Blue** (`#1f3f6b`): Deep, desaturated navy pulled from classic airmail envelope trim. Appears in the diagonal `airmail-stripe` structural rule, the small postmark badge on the hero card, and mid-pipeline status dots ("In transit," "Interview"). **Airmail Blue Light** (`#2f5b93`) is reserved for the stripe's alternating band.

### Tertiary
- **Offer Green** (`#2f6b45`): A single-purpose status color for the terminal, successful pipeline state ("Delivered"/offer) and the "logged automatically" live-indicator dot. Never used decoratively — its presence always means something completed.

### Neutral
- **Paper** (`#f4ecd9`): The base ground color for the page body and default section background.
- **Paper Light** (`#faf5e9`): Card and panel surfaces, the scrolled navbar fill, and one alternating band inside the airmail stripe — the "brighter sheet of paper" tone.
- **Paper Dark** (`#e8dcc0`): Reserved deeper paper tone for pressed/inset states.
- **Kraft** (`#d8c39c`): The textured backing tone behind the hero and feature icon panels (via `bg-kraft-texture-layer`), evoking kraft-paper stock rather than a flat surface.
- **Kraft Dark** (`#b89f74`): Deeper kraft for borders/accents against the kraft texture.
- **Ink** (`#211a12`): Primary text color and the footer's reversed background.
- **Ink Soft** (`#4a4033`): Secondary/supporting text — subheads, body copy, captions.

### Named Rules
**The One Loud Color Rule.** Postmark Red is the only saturated, high-chroma color permitted to carry emphasis (CTAs, active states, the stamp itself). Airmail Blue and Offer Green are desaturated by comparison and restricted to structural or status roles — they never compete with red for attention.

## Typography

**Display Font:** Space Grotesk (with sans-serif fallback)
**Body Font:** DM Sans (with sans-serif fallback)
**Label/Mono Font:** Space Mono (with monospace fallback)

**Character:** A geometric, slightly mechanical display face paired with a warm, humanist body face — the pairing reads as "official form" (Grotesk headlines, Mono labels) softened by approachable body copy, rather than pure bureaucratic coldness.

### Hierarchy
- **Display** (700, `clamp(2.6rem, 6vw, 3.75rem)`, line-height 1.02–1.05): Hero headline only. Tight tracking, always paired with the hand-drawn underline accent on the key word ("postmarked").
- **Headline** (700, `text-3xl` to `text-4xl` / 30–36px, tight tracking): Section titles (Features, How It Works, Pricing, FAQ).
- **Title** (700, `text-lg` to `text-2xl` / 18–24px): Card and step headings inside sections.
- **Body** (400, `text-sm` to `text-lg` / 14–18px, leading-relaxed, set in Ink Soft): Supporting copy; hero subhead caps at `max-w-md` for a controlled line length.
- **Label** (400/700, `text-[9px]` to `text-sm` / 9–14px, `tracking-wide` to `tracking-widest`, uppercase): Nav links, buttons, tracking numbers ("Tracking No. PC-04821"), pipeline status, postmark ring text, footer column headers. Always Space Mono, always uppercase.

### Named Rules
**The No-Kicker Rule.** Eyebrow/kicker labels above headings are banned system-wide. This was tried and deliberately removed during finish review — headings carry their own weight via Display type and don't need a small-caps label pointing at them first.
**The Mono-Means-System Rule.** Space Mono is reserved for anything that reads as machine-generated or systemic (tracking numbers, timestamps, nav, buttons, badges). Space Grotesk is reserved for anything authored (headlines, titles). Body copy never uses Mono.

## Layout

Content sits in a `max-w-6xl` container (`max-w-3xl` for FAQ, `max-w-5xl` for Pricing) with `px-5` mobile / `px-8` desktop gutters. Sections run a consistent vertical rhythm of `py-24` (96px) mobile and `py-32` (128px) desktop, giving each idea room before the next one starts.

The hero uses an asymmetric two-column grid (`1.05fr / 0.95fr`) — copy left, postmark demo right — collapsing to a single stacked column below `lg`. Features uses a 5-column grid split 3/2 (a featured wide panel plus two stacked lighter cards); How It Works uses a 4-up step grid with a dashed horizontal connector line; Pricing is a centered 2-up card grid capped at `max-w-3xl`. Grid gaps run `gap-6` (24px) for card grids up to `gap-16` (64px) for the hero's two columns.

Dashed borders (`border-dashed border-ink/15` to `/25`) are used as a recurring seam motif — inside the postmark demo card, along the How It Works connector — standing in for a tear-off perforation line.

## Elevation & Depth

Streakhire is flat-by-default: surfaces are distinguished by paper-tone contrast and hairline borders (`border-ink/10` to `/15`), not by drop shadows. The one shadow token in the system, `shadow-stamp`, is reserved for objects that are physically being stamped or pressed forward — the hero demo card, primary CTAs, and the highlighted pricing tier — never for ambient card lift. Physical presence is instead signaled by rotation: postmark rings, the hero demo card, and the streak strip all sit a few degrees off-axis (−1.5° to −18°), as if freshly stamped and not yet squared up.

### Shadow Vocabulary
- **Stamp** (`box-shadow: 0 1px 0 rgba(33,26,18,0.08), 0 8px 24px -12px rgba(33,26,18,0.35)`): A tight, warm-toned shadow used only on the hero demo card, primary CTA buttons, and the highlighted pricing tier — signals "this object was just pressed down," not generic elevation.

### Named Rules
**The Tilt-Not-Lift Rule.** Depth and physicality come from rotation (stamps, cards sitting slightly askew), not from shadow stacking. `shadow-stamp` is the only shadow in the system and it is used sparingly, on stamped/pressed objects only.

## Shapes

Two silhouettes dominate: soft rounded rectangles (`rounded-2xl`, 16px) for cards and panels, and full circles (`rounded-full`, 9999px) for anything that behaves like a stamp, badge, pill button, or dot. The `postmark-ring` utility (a 1.5px `currentColor` circle) is the system's signature shape — every postmark, the extension badge, and streak-day markers all resolve to this ring. Buttons are always pill-shaped, never square-cornered. The `airmail-stripe` repeating diagonal (14px red / 6px paper / 14px blue / 6px paper, at −45°) is a structural border rule at world boundaries — navbar-on-scroll top edge, hero top edge, footer top edge — not a decorative flourish. `cancel-lines` (a 100°, 1.5px-on/10px-off repeating hatch) provides the faint cancellation-mark backdrop texture behind the hero copy.

## Components

### Buttons
- **Shape:** Fully pill (`rounded-full`, 9999px), no square-cornered buttons anywhere in the system.
- **Primary:** Postmark Red fill (`#c8401f`), Paper Light text, `shadow-stamp`, mono uppercase label, padding scales from `px-4 py-2` (nav) to `px-6 py-3.5` (hero). Hover moves to Postmark Red Dark (`#9c2f15`).
- **Secondary / Ghost:** Paper Light fill with a `border-ink/20` hairline border, no shadow; hover deepens the border to `border-ink/40`. Used for the "Add to Comet" hero CTA and non-highlighted pricing CTA.
- **On-dark (highlighted pricing tier):** Same pill shape, Postmark Red fill, hover to Postmark Red Light (`#e0592f`) since the surrounding surface is already Ink-dark.

### Cards / Containers
- **Corner Style:** `rounded-2xl` (16px) for feature/pricing/hero-demo cards; `rounded-xl` (12px) for the smaller feature-icon inset panel.
- **Background:** Paper Light (`#faf5e9`) on Paper (`#f4ecd9`) section backgrounds for standard cards; Ink (`#211a12`) reversed for the highlighted pricing tier.
- **Shadow Strategy:** Flat by default; `shadow-stamp` only on the hero demo card and the highlighted pricing tier (see Elevation & Depth).
- **Border:** `border border-ink/12` to `/15` hairline, standard weight across all card types.
- **Internal Padding:** `p-6` to `p-8` (24–32px) depending on card size.

### Navigation
- **Style:** Fixed header, transparent over the hero, transitioning to a blurred Paper Light fill with a hairline bottom border once scrolled past 8px — the `airmail-stripe` rule appears as a 3px top edge only in the scrolled state, marking the transition into "system chrome."
- **Typography:** Space Mono, 13px, uppercase, `tracking-wide`, Ink Soft default.
- **States:** Links get a red underline that grows from 0 to full width on hover (`after:` pseudo-element, no color-only hover). Active/current page state is not yet distinguished beyond hover.
- **Mobile:** Hamburger-to-X icon toggle; menu drops open as a bordered panel below the bar with the same mono label styling, full-width primary CTA at the bottom of the list.

### Accordion (FAQ)
- **Style:** Divided list (`divide-y`) with top/bottom rule lines, no card wrapper. Question row is Display/bold; a circular `+` icon (mono ring) rotates 45° to become `×` on open, switching its ring color to Postmark Red when active.
- **Motion:** Height/opacity spring-out on expand, `AnimatePresence` exit; body copy is capped at `max-w-xl` even though the section is narrower, to keep line length controlled.

### Postmark Stamp (signature component)
The recurring "APPLIED / AUTO" postmark ring is the system's signature device: a two-line mono label inside a `postmark-ring` circle, always rotated between −10° and −18°, always Postmark Red on transparent. It appears at three scales — the hero's animated stamp-in (spring overshoot easing), the Features panel's static icon, and implied by the streak strip's smaller stamped dots. Any new "this happened automatically" moment in the product should reuse this exact device rather than inventing a new automation indicator.

### Streak Strip (signature component)
A row of seven day-circles (mono day-letter above, `postmark-ring`-style circle below) where "stamped" days fill with a small solid Postmark Red dot and unstamped days sit dim at `border-ink/15` / `text-ink/20`. This is the visual proof of the streak mechanic and should not be reskinned as a progress bar, calendar heatmap, or numeric-only counter elsewhere in the product — the dot-ring vocabulary is the streak's identity.

## Do's and Don'ts

### Do:
- **Do** treat the `airmail-stripe` diagonal as a structural boundary rule (navbar-on-scroll, hero top, footer top) — it marks a transition between world zones, never decorate a random section with it.
- **Do** use rotation (−1.5° to −18°) to signal physicality on stamped/pressed elements instead of adding shadow.
- **Do** set anything system-generated (tracking numbers, timestamps, nav, buttons, badges, pipeline status) in uppercase Space Mono.
- **Do** reuse the `postmark-ring` + "APPLIED/AUTO" device for any new automatic-logging moment rather than inventing a second automation motif.
- **Do** keep Postmark Red as the only saturated accent color on any given screen; let Airmail Blue and Offer Green stay administrative.

### Don't:
- **Don't** use a dark-gradient SaaS hero treatment — this system's hero is warm paper and ink, explicitly rejecting that default.
- **Don't** introduce a cartoon mascot or character-based gamification device — the streak is expressed through the postmark/stamp vocabulary, not a character.
- **Don't** add an eyebrow/kicker label above any heading — this was tried and removed in finish review; headings stand alone.
- **Don't** apply generic ambient drop shadows to cards for "lift" — `shadow-stamp` is the only shadow in the system and it is reserved for stamped/pressed objects.
- **Don't** square off buttons or badges — the pill/circle vocabulary (via `rounded-full`) is load-bearing to the postal-facility form language.
