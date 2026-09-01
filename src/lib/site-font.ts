/**
 * The storefront typeface — the pure half.
 *
 * Constants only, with no database import, so the admin's font picker can share
 * exactly this list without dragging the SQLite driver into the browser bundle.
 * Reading the stored choice lives in `site-font-server.ts`, mirroring the split
 * already used by `pricing.ts` / `pricing-server.ts`.
 *
 * The stored value is a key, never a font name or a stylesheet URL: the faces
 * themselves are declared in the root layout and self-hosted by next/font, so a
 * row in the database can only ever select among what the app already ships.
 */

export const SITE_FONT_KEY = "theme.font";

export const SITE_FONTS = [
  {
    key: "plex",
    label: "IBM Plex Sans Arabic",
    note: "الخط الحالي — متزن وواضح على الشاشات الصغيرة",
  },
  {
    key: "cairo",
    label: "Cairo",
    note: "هندسي عريض — يرسم الياء الأخيرة بلا نقاط (ببجي)",
  },
  { key: "tajawal", label: "Tajawal", note: "حديث ومضغوط قليلاً" },
  { key: "almarai", label: "Almarai", note: "سميك ومقروء، مناسب للأسماء القصيرة" },
  { key: "kufi", label: "Noto Kufi Arabic", note: "كوفي بطابع مميّز" },
  { key: "alexandria", label: "Alexandria", note: "هندسي قريب من Cairo" },
  { key: "readex", label: "Readex Pro", note: "هندسي حديث وواسع قليلاً" },
  { key: "changa", label: "Changa", note: "هندسي مضغوط، قويّ للعناوين" },
  { key: "messiri", label: "El Messiri", note: "عصري بطابع مميّز" },
  { key: "baloo", label: "Baloo Bhaijaan 2", note: "سميك ومستدير" },
  { key: "noto", label: "Noto Sans Arabic", note: "محايد وشديد الاكتمال" },
] as const;

export type SiteFontKey = (typeof SITE_FONTS)[number]["key"];

export const DEFAULT_SITE_FONT: SiteFontKey = "plex";

export function isSiteFont(value: string): value is SiteFontKey {
  return SITE_FONTS.some((font) => font.key === value);
}
