import type { MetadataRoute } from "next";

/**
 * Web app manifest — what makes PLUS CARD installable to the home screen.
 *
 * `display: "standalone"` is the part that matters visually: once installed,
 * the page owns the whole screen, so together with `viewport-fit=cover` and the
 * translucent iOS status-bar style it renders *underneath* the clock, signal
 * and battery. The sticky header's frosted pane already spans that area through
 * its safe-area padding, so the glass genuinely blurs what passes behind them.
 *
 * `theme_color` is the dark palette's page background. It is what Android paints
 * behind the status bar, and it is deliberately the same colour the glass
 * settles on, so the two never read as separate strips.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PLUS CARD — سوق البطاقات الرقمية",
    short_name: "PLUS CARD",
    description:
      "بطاقات رقمية وبطاقات شحن وألعاب ومتاجر عالمية بأسعار مميزة وتسليم فوري.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111827",
    theme_color: "#111827",
    // No logo artwork exists yet — the existing favicon stands in until one is
    // supplied. Nothing here is generated or invented.
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
