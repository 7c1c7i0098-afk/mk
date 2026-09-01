import { prisma } from "@/lib/db";
import { getBlockedVariantIds } from "@/lib/suppliers/availability";
import type { CartItem } from "@/lib/cart-types";

/**
 * Server-side cart for signed-in customers (carts / cart_items).
 * The client keeps the same shape, so the UI never has to branch on auth state.
 */

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: { product: { select: { id: true, slug: true, name: true, image: true } } },
      },
    },
  },
} as const;

type CartRow = {
  quantity: number;
  variant: {
    id: string;
    name: string;
    value: string | null;
    price: number;
    isActive: boolean;
    product: { id: string; slug: string; name: string; image: string | null };
  };
};

function toCartItems(rows: CartRow[]): CartItem[] {
  return rows
    .filter((row) => row.variant.isActive)
    .map((row) => ({
      productId: row.variant.product.id,
      productSlug: row.variant.product.slug,
      productName: row.variant.product.name,
      variantId: row.variant.id,
      variantName: row.variant.value ?? row.variant.name,
      image: row.variant.product.image,
      unitPrice: row.variant.price,
      quantity: row.quantity,
    }));
}

export async function getServerCart(userId: string): Promise<CartItem[]> {
  const cart = await prisma.cart.findUnique({ where: { userId }, include: CART_INCLUDE });
  return cart ? toCartItems(cart.items) : [];
}

/** Replaces the stored cart with exactly what the client holds. */
export async function replaceServerCart(
  userId: string,
  items: { variantId: string; quantity: number }[],
): Promise<CartItem[]> {
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });

  const valid = await validateVariants(items);

  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { cartId: cart.id } }),
    ...(valid.length > 0
      ? [
          prisma.cartItem.createMany({
            data: valid.map((item) => ({
              cartId: cart.id,
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          }),
        ]
      : []),
  ]);

  return getServerCart(userId);
}

/**
 * Merges a guest cart into the customer's stored cart.
 *
 * Matching is by variantId, so an identical variant never becomes a second row —
 * its quantity is increased instead (capped at available stock).
 */
export async function mergeGuestCart(
  userId: string,
  guestItems: { variantId: string; quantity: number }[],
): Promise<CartItem[]> {
  if (guestItems.length === 0) return getServerCart(userId);

  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });

  const valid = await validateVariants(guestItems);

  for (const item of valid) {
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
      select: { id: true, quantity: true },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: Math.min(existing.quantity + item.quantity, item.maxQuantity) },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, variantId: item.variantId, quantity: item.quantity },
      });
    }
  }

  return getServerCart(userId);
}

/**
 * Drops unknown/inactive variants and clamps quantities to stock.
 *
 * Supplier-backed variants are also dropped when their supplier cannot
 * currently fulfil them, so an item that went out of stock upstream leaves the
 * cart instead of reaching checkout.
 */
async function validateVariants(items: { variantId: string; quantity: number }[]) {
  const ids = [...new Set(items.map((item) => item.variantId))];
  if (ids.length === 0) return [];

  const [variants, blocked] = await Promise.all([
    prisma.productVariant.findMany({
      where: { id: { in: ids }, isActive: true, product: { isActive: true } },
      select: { id: true, stock: true },
    }),
    getBlockedVariantIds(ids),
  ]);
  const stockById = new Map(variants.map((variant) => [variant.id, variant.stock]));

  return items
    .filter((item) => stockById.has(item.variantId) && !blocked.has(item.variantId))
    .map((item) => {
      const stock = stockById.get(item.variantId) ?? 0;
      const maxQuantity = stock > 0 ? stock : item.quantity;
      return {
        variantId: item.variantId,
        quantity: Math.max(1, Math.min(item.quantity, maxQuantity)),
        maxQuantity,
      };
    });
}
