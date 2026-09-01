"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import {
  cartTotalPrice,
  cartTotalQuantity,
  isCartItem,
  type CartItem,
  type CartLine,
} from "@/lib/cart-types";
import {
  CART_STORAGE_KEY,
  claimPendingGuestMerge,
  markGuestCartDirty,
  readStoredCart,
  writeStoredCart,
} from "@/lib/cart-storage";

/**
 * One global cart for the whole storefront.
 *
 * Guests keep it in localStorage. Signed-in customers get the same cart backed
 * by the database: on sign-in the guest cart is merged into the stored one
 * (matching on variantId, so nothing is duplicated), and every later change is
 * mirrored to the server.
 */

type State = { items: CartItem[]; hydrated: boolean };

type Action =
  | { type: "hydrate"; items: CartItem[] }
  | { type: "add"; line: CartLine; quantity: number }
  | { type: "increment"; variantId: string; max?: number }
  | { type: "decrement"; variantId: string }
  | { type: "setQuantity"; variantId: string; quantity: number }
  | { type: "remove"; variantId: string }
  | { type: "clear" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { items: action.items, hydrated: true };

    case "add": {
      const existing = state.items.find((item) => item.variantId === action.line.variantId);
      // Same variant → bump the quantity, never a second row.
      if (existing) {
        return {
          ...state,
          items: state.items.map((item) =>
            item.variantId === action.line.variantId
              ? { ...item, quantity: item.quantity + action.quantity }
              : item,
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.line, quantity: action.quantity }],
      };
    }

    case "increment":
      return {
        ...state,
        items: state.items.map((item) =>
          item.variantId === action.variantId
            ? {
                ...item,
                quantity:
                  action.max !== undefined
                    ? Math.min(item.quantity + 1, action.max)
                    : item.quantity + 1,
              }
            : item,
        ),
      };

    case "decrement":
      // Reaching zero removes the line entirely.
      return {
        ...state,
        items: state.items.flatMap((item) =>
          item.variantId === action.variantId
            ? item.quantity <= 1
              ? []
              : [{ ...item, quantity: item.quantity - 1 }]
            : [item],
        ),
      };

    case "setQuantity":
      return {
        ...state,
        items: state.items.flatMap((item) =>
          item.variantId === action.variantId
            ? action.quantity <= 0
              ? []
              : [{ ...item, quantity: action.quantity }]
            : [item],
        ),
      };

    case "remove":
      return {
        ...state,
        items: state.items.filter((item) => item.variantId !== action.variantId),
      };

    case "clear":
      return { ...state, items: [] };

    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  /** False until the persisted cart has been restored — avoids SSR flicker. */
  hydrated: boolean;
  totalQuantity: number;
  totalPrice: number;
  quantityOf: (variantId: string) => number;
  add: (line: CartLine, quantity?: number) => void;
  increment: (variantId: string, max?: number) => void;
  decrement: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function signature(items: CartItem[]) {
  return items
    .map((item) => `${item.variantId}:${item.quantity}`)
    .sort()
    .join("|");
}

export function CartProvider({
  children,
  isAuthenticated = false,
}: {
  children: React.ReactNode;
  isAuthenticated?: boolean;
}) {
  const [state, dispatch] = useReducer(reducer, { items: [], hydrated: false });
  const lastSynced = useRef<string | null>(null);
  /**
   * Guards the restore below so it runs once per auth state. React re-runs
   * effects in development; without this, a merge and a plain load would race
   * and the slower response would overwrite the faster one.
   */
  const restoredFor = useRef<boolean | null>(null);

  // Restore after mount so server and client markup match.
  //
  // For a signed-in customer the stored cart is authoritative. A guest cart is
  // merged into it exactly once — claimPendingGuestMerge() clears the flag as
  // it reads it, so a repeated effect or a reload just loads the stored cart.
  useEffect(() => {
    if (restoredFor.current === isAuthenticated) return;
    restoredFor.current = isAuthenticated;

    const local = readStoredCart();

    async function restore() {
      if (!isAuthenticated) {
        dispatch({ type: "hydrate", items: local });
        return;
      }

      const shouldMerge = claimPendingGuestMerge() && local.length > 0;

      try {
        const response = shouldMerge
          ? await fetch("/api/cart/merge", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                items: local.map((item) => ({
                  variantId: item.variantId,
                  quantity: item.quantity,
                })),
              }),
            })
          : await fetch("/api/cart");

        const data = (await response.json()) as { items?: unknown };
        const items = Array.isArray(data.items) ? data.items.filter(isCartItem) : local;
        lastSynced.current = signature(items);
        dispatch({ type: "hydrate", items });
      } catch {
        // Offline or server error — keep whatever the browser already had.
        dispatch({ type: "hydrate", items: local });
      }
    }

    // No cancellation flag on purpose: the ref above already guarantees a
    // single run, and aborting it during React's development remount would
    // leave the cart permanently unhydrated.
    void restore();
  }, [isAuthenticated]);

  // Persist locally on every change once restored.
  useEffect(() => {
    if (state.hydrated) writeStoredCart(state.items);
  }, [state.items, state.hydrated]);

  // Mirror the cart to the database for signed-in customers (debounced).
  useEffect(() => {
    if (!state.hydrated || !isAuthenticated) return;

    const current = signature(state.items);
    if (current === lastSynced.current) return;

    const timer = setTimeout(() => {
      lastSynced.current = current;
      void fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: state.items.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      }).catch(() => {
        // A failed mirror must never break the UI; the next change retries.
        lastSynced.current = null;
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [state.items, state.hydrated, isAuthenticated]);

  // Keep the cart in sync between open tabs.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === CART_STORAGE_KEY) {
        dispatch({ type: "hydrate", items: readStoredCart() });
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const quantityOf = useCallback(
    (variantId: string) =>
      state.items.find((item) => item.variantId === variantId)?.quantity ?? 0,
    [state.items],
  );

  // Every guest change flags the cart for merging at the next sign-in.
  const touch = useCallback(() => {
    if (!isAuthenticated) markGuestCartDirty();
  }, [isAuthenticated]);

  const value = useMemo<CartContextValue>(
    () => ({
      items: state.items,
      hydrated: state.hydrated,
      totalQuantity: cartTotalQuantity(state.items),
      totalPrice: cartTotalPrice(state.items),
      quantityOf,
      add: (line, quantity = 1) => {
        touch();
        dispatch({ type: "add", line, quantity });
      },
      increment: (variantId, max) => {
        touch();
        dispatch({ type: "increment", variantId, max });
      },
      decrement: (variantId) => {
        touch();
        dispatch({ type: "decrement", variantId });
      },
      setQuantity: (variantId, quantity) => {
        touch();
        dispatch({ type: "setQuantity", variantId, quantity });
      },
      remove: (variantId) => {
        touch();
        dispatch({ type: "remove", variantId });
      },
      clear: () => dispatch({ type: "clear" }),
    }),
    [state.items, state.hydrated, quantityOf, touch],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}
