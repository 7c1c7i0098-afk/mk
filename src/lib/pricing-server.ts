import { prisma } from "@/lib/db";
import { NO_DISCOUNT, clampBps, type DiscountRates } from "@/lib/pricing";

/**
 * Server-side half of pricing: reads a customer's discount rates.
 *
 * This is the only trusted source of a rate. The storefront hands a copy to the
 * client so it can display the right price, but any checkout must call this
 * again — a rate arriving from the browser is never used to charge anyone.
 */
/**
 * Reads the customer's rates: the blanket rate from the account, plus any
 * per-product overrides. Guests get nothing.
 */
export async function getDiscountRates(userId: string | null | undefined): Promise<DiscountRates> {
  if (!userId) return NO_DISCOUNT;

  const [user, rows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { discountBps: true } }),
    prisma.userDiscount.findMany({
      where: { userId },
      select: { productId: true, percentBps: true },
    }),
  ]);
  if (!user) return NO_DISCOUNT;

  const rates: DiscountRates = { globalBps: clampBps(user.discountBps), byProductBps: {} };
  for (const row of rows) rates.byProductBps[row.productId] = clampBps(row.percentBps);
  return rates;
}
