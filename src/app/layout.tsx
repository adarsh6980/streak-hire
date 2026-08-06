import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono, DM_Sans } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "700"],
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-space-mono",
  weight: ["400", "700"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Streakhire — Auto-track every job application",
  description:
    "Streakhire auto-postmarks every job application the moment you hit submit. One click from Chrome or Comet, and your streak, pipeline, and history update themselves.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${spaceMono.variable} ${dmSans.variable} font-body antialiased bg-paper text-ink`}
      >
        <div
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `<!--
          THESIS: A job tracker that fills itself in — the one thing a spreadsheet can't do. Refuses the dark-SaaS-gradient hero and the cartoon-mascot gamification default.
          OWN-WORLD: Postal sorting facility. Kraft/paper ground, postmark-red ink, airmail red-white-blue diagonal stripe as a structural rule (not decoration), cancellation-mark line textures, tracking-number monospace type, rubber-stamp rotation on key marks.
          STORY: Visitor believes their applications get postmarked automatically the instant they apply, so their streak and pipeline update without them lifting a finger. Believes the mechanism first, feels the relief/momentum second.
          FIRST VIEWPORT: Headline + subhead left, primary CTA below; right/below shows a live "postmark" animation stamping an application card as APPLIED, with a streak strip of daily postmarks beneath. Extension chip for Chrome + Comet sits directly under the CTA.
          FORM: Postal sorting facility, candidate 3 of 7 grounded directions, seed key 7f6cdd53.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
        -->`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
