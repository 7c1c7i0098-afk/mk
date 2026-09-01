/**
 * Money helpers.
 *
 * Every monetary value in the database is an INTEGER in minor units:
 *   1.00 د.ل  ===  100
 * This keeps arithmetic exact and safe across the server/client boundary.
 */

export const CURRENCY_SYMBOL = "د.ل";
export const MINOR_UNITS_PER_MAJOR = 100;

/** "12.5" | 12.5  ->  1250 */
export function toMinor(amount: number | string): number {
  const value = typeof amount === "string" ? Number(amount.trim()) : amount;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * MINOR_UNITS_PER_MAJOR);
}

/** 1250 -> 12.5 */
export function fromMinor(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/**
 * 25000 -> "250"   ·   990 -> "9.9"   ·   1212 -> "12.12"
 *
 * Trailing zeros are dropped: a price with nothing after the decimal point is
 * read as a whole number, so ".00" is noise on every card in the shop.
 */
export function formatAmount(minor: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(fromMinor(Math.abs(minor)));
}

/** 25000 -> "250 د.ل" */
export function formatMoney(minor: number, options?: { sign?: boolean }): string {
  const sign = options?.sign && minor !== 0 ? (minor > 0 ? "+" : "-") : "";
  return `${sign}${formatAmount(minor)} ${CURRENCY_SYMBOL}`;
}
