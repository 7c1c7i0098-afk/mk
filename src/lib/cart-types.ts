/**
 * Cart primitives shared by the client store and (later) the server-side cart.
 * Prices are integers in minor units — see src/lib/money.ts.
 */

export type CartLine = {
  productId: string;
  productSlug: string;
  productName: string;
  variantId: string;
  variantName: string;
  image: string | null;
  unitPrice: number;
};

export type CartItem = CartLine & { quantity: number };

/** Total number of units across every line — السلة (11). */
export function cartTotalQuantity(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

/** Sum of (unit price × quantity) for every line, in minor units. */
export function cartTotalPrice(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
}

export function lineTotal(item: CartItem): number {
  return item.unitPrice * item.quantity;
}

/** Runtime guard used when restoring a persisted cart. */
export function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    typeof item.productSlug === "string" &&
    typeof item.productName === "string" &&
    typeof item.variantId === "string" &&
    typeof item.variantName === "string" &&
    (typeof item.image === "string" || item.image === null) &&
    typeof item.unitPrice === "number" &&
    Number.isFinite(item.unitPrice) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  );
}
