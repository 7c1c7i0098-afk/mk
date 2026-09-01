import { isCartItem, type CartItem } from "@/lib/cart-types";

/**
 * Local persistence for the cart.
 *
 * Two keys are involved:
 *   - CART_KEY   the cart itself (guest cart, or a cache of the stored cart)
 *   - MERGE_KEY  a flag set whenever a *guest* changes the cart
 *
 * The flag is what makes the sign-in merge safe: only a cart that a signed-out
 * visitor actually touched is merged into the account, and the flag is cleared
 * the moment the merge starts. Without it, every reload of an authenticated
 * page would merge the cached cart into itself and double the quantities.
 */
const CART_KEY = "pluscard.cart.v1";
const MERGE_KEY = "pluscard.cart.guest-dirty";

export function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

export function writeStoredCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable (private mode / quota) — the in-memory cart still works.
  }
}

export function clearStoredCart(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CART_KEY);
    window.localStorage.removeItem(MERGE_KEY);
  } catch {
    // ignore
  }
}

/** Marks the cart as changed by a signed-out visitor. */
export function markGuestCartDirty(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MERGE_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Returns true at most once per guest-modified cart: reading it also clears the
 * flag, so a duplicated effect or a page refresh can never merge twice.
 */
export function claimPendingGuestMerge(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const pending = window.localStorage.getItem(MERGE_KEY) === "1";
    if (pending) window.localStorage.removeItem(MERGE_KEY);
    return pending;
  } catch {
    return false;
  }
}

export const CART_STORAGE_KEY = CART_KEY;
