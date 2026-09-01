import type { Metadata, Viewport } from "next";
import {
  Alexandria,
  Almarai,
  Baloo_Bhaijaan_2,
  Cairo,
  Changa,
  El_Messiri,
  IBM_Plex_Sans_Arabic,
  Noto_Kufi_Arabic,
  Noto_Sans_Arabic,
  Readex_Pro,
  Tajawal,
} from "next/font/google";
import { THEME_BOOT_SCRIPT, ThemeProvider } from "@/components/theme/theme-provider";
import { ThemedToaster } from "@/components/theme/themed-toaster";
import { getSiteFont } from "@/lib/site-font-server";
import "./globals.css";

/**
 * Every face the admin may choose, loaded and self-hosted by next/font.
 *
 * All five variables are attached to <html> at once and the active one is
 * selected in CSS by `data-font`. Loading them together costs a little more
 * than loading one, and buys a font switch that takes effect on the next paint
 * with no flash of the previous face — the alternative, importing at runtime,
 * would show the wrong typeface first every time.
 */
const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-tajawal",
  display: "swap",
});

const almarai = Almarai({
  subsets: ["arabic"],
  weight: ["400", "700", "800"],
  variable: "--font-almarai",
  display: "swap",
});

const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-kufi",
  display: "swap",
});

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  variable: "--font-alexandria",
  display: "swap",
});

const readex = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-readex",
  display: "swap",
});

const changa = Changa({
  subsets: ["arabic", "latin"],
  variable: "--font-changa",
  display: "swap",
});

const messiri = El_Messiri({
  subsets: ["arabic", "latin"],
  variable: "--font-messiri",
  display: "swap",
});

const baloo = Baloo_Bhaijaan_2({
  subsets: ["arabic", "latin"],
  variable: "--font-baloo",
  display: "swap",
});

const notoSans = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-noto",
  display: "swap",
});

/**
 * Declaring every face costs only the CSS that describes them: a browser
 * downloads a font file when text actually renders in it, so the storefront
 * fetches the one that is selected and nothing else. The picker page is the
 * single screen that pulls them all, which is exactly where that is wanted.
 */
const FONT_VARIABLES = [
  plex,
  cairo,
  tajawal,
  almarai,
  kufi,
  alexandria,
  readex,
  changa,
  messiri,
  baloo,
  notoSans,
]
  .map((font) => font.variable)
  .join(" ");

export const metadata: Metadata = {
  title: {
    default: "PLUS CARD — سوق البطاقات الرقمية",
    template: "%s · PLUS CARD",
  },
  description:
    "PLUS CARD — بطاقات رقمية وبطاقات شحن وألعاب ومتاجر عالمية بأسعار مميزة وتسليم فوري.",
  applicationName: "PLUS CARD",
  /**
   * Installed-app behaviour on iOS.
   *
   * `black-translucent` is the whole point: it makes the status bar itself
   * transparent and lets the page render underneath it, so the header's frosted
   * pane extends behind the clock, signal and battery as one continuous piece
   * of glass instead of sitting below a separate solid strip.
   *
   * Trade-off worth remembering: iOS then always draws those icons light, so
   * they are strongest against the dark theme.
   */
  appleWebApp: {
    capable: true,
    title: "PLUS CARD",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const font = await getSiteFont();

  // `data-scroll-behavior` tells Next to suspend the smooth scrolling declared
  // in globals.css while a route changes. Without it the browser animates the
  // scroll position at the same time as the page slides in, and the two fight
  // each other — which is most of what reads as a janky navigation.
  return (
    <html
      lang="ar"
      dir="rtl"
      data-scroll-behavior="smooth"
      data-font={font}
      className={FONT_VARIABLES}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before first paint — no flash of the wrong palette. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-ink text-fg antialiased">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
