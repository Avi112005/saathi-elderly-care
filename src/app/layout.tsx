import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Caveat, Figtree, Instrument_Serif } from "next/font/google";
import { A11Y_COOKIE, parseA11y } from "@/lib/a11y";
import "./globals.css";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-instrument", display: "swap" });
const sans = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const hand = Caveat({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-caveat", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Saathi — care that never forgets", template: "%s · Saathi" },
  description:
    "A shared care circle for elderly medication, appointments and adherence. Gentle escalating email reminders, a senior safety check, and the elder always in charge.",
  applicationName: "Saathi",
  icons: { icon: "/icon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#fbfaf6",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const prefs = parseA11y((await cookies()).get(A11Y_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-text={prefs.textSize}
      data-contrast={prefs.contrast}
      className={`${serif.variable} ${sans.variable} ${hand.variable}`}
    >
      <body className="min-h-dvh">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
