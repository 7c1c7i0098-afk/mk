import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import { DEFAULT_SITE_FONT, SITE_FONT_KEY, isSiteFont, type SiteFontKey } from "@/lib/site-font";

/**
 * Reads the chosen typeface.
 *
 * Kept apart from the constants so a client component can import the font list
 * without pulling the database driver in behind it — `server-only` turns that
 * mistake into a build error rather than a broken browser bundle.
 *
 * Memoized per request: the root layout asks on every render, and an unknown or
 * missing value falls back rather than leaving the page with no font at all.
 */
export const getSiteFont = cache(async (): Promise<SiteFontKey> => {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: SITE_FONT_KEY },
      select: { value: true },
    });
    if (row && isSiteFont(row.value)) return row.value;
  } catch (error) {
    // A font is not worth failing a page render over.
    console.error("[site-font]", error);
  }

  return DEFAULT_SITE_FONT;
});
