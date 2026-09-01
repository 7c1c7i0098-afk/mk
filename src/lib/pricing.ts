/**
 * Customer-specific pricing — the arithmetic half.
 *
 * Pure functions only, with no database import, so client components (the cart,
 * the admin panels) can share exactly the same maths the server prices an order
 * with. Reading a customer's rates lives in `pricing-server.ts`, because a
 * client bundle must never pull the database driver in behind it.
 */

/** 1000 bps = 10.00%. Rates are clamped to a sane range on the way in and out. */
export const MAX_DISCOUNT_BPS = 9000; // 90%

export type DiscountRates = {
  /** Applies to any product without its own rate. */
  globalBps: number;
  /** productId -> rate, overriding the global one for that product. */
  byProductBps: Record<string, number>;
};

export const NO_DISCOUNT: DiscountRates = { globalBps: 0, byProductBps: {} };

export function clampBps(bps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.min(Math.max(Math.round(bps), 0), MAX_DISCOUNT_BPS);
}

/** The rate that applies to one product: its own override, else the global one. */
export function rateForProduct(rates: DiscountRates, productId: string): number {
  const own = rates.byProductBps[productId];
  return clampBps(own ?? rates.globalBps);
}

/**
 * Applies a rate to a price in minor units.
 * Rounds the *payable* amount down, so rounding never works against the
 * customer, and never returns less than zero.
 */
export function discountedPrice(unitPrice: number, bps: number): number {
  const rate = clampBps(bps);
  if (rate <= 0) return unitPrice;
  return Math.max(0, Math.floor((unitPrice * (10_000 - rate)) / 10_000));
}

export type PricedLine = {
  productId: string;
  unitPrice: number;
  quantity: number;
};

export type CartQuote = {
  subtotal: number;
  discount: number;
  total: number;
};

/**
 * Authoritative cart total. A checkout must price the order with this, using
 * variant prices read from the database rather than anything the client sent.
 */
export function quoteLines(lines: PricedLine[], rates: DiscountRates): CartQuote {
  let subtotal = 0;
  let total = 0;

  for (const line of lines) {
    const quantity = Math.max(0, Math.trunc(line.quantity));
    subtotal += line.unitPrice * quantity;
    total += discountedPrice(line.unitPrice, rateForProduct(rates, line.productId)) * quantity;
  }

  return { subtotal, discount: subtotal - total, total };
}

/** "1250" -> "12.5%" for display. */
export function formatBps(bps: number): string {
  const percent = clampBps(bps) / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

/** "12.5" -> 1250, for admin input. Returns null when the input is unusable. */
export function parsePercentToBps(input: string): number | null {
  const value = Number(String(input).trim());
  if (!Number.isFinite(value) || value < 0) return null;
  const bps = Math.round(value * 100);
  if (bps > MAX_DISCOUNT_BPS) return null;
  return bps;
}
