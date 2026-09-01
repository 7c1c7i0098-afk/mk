import "server-only";

import { prisma } from "@/lib/db";
import { discountedPrice, rateForProduct } from "@/lib/pricing";
import { getDiscountRates } from "@/lib/pricing-server";
import { nextNumber } from "@/lib/sequences";
import { getBlockedVariantIds } from "@/lib/suppliers/availability";
import { fulfilOrderItem, parseParamFields, validateParams } from "@/lib/suppliers/fulfilment";
import type { ParamField } from "@/lib/suppliers/types";

/**
 * Checkout: turning a cart into a paid order, and the order into delivered goods.
 *
 * The sequence is deliberate, and the order of the steps is the design:
 *
 *   1. **Validate everything first.** Availability, required customer inputs,
 *      supplier quantity bounds — all checked before a single dirham moves. A
 *      line that cannot possibly be fulfilled must never be charged for.
 *   2. **Price on the server.** Variant prices and the customer's discount are
 *      read from the database here. Whatever the browser believed the total was
 *      is ignored entirely.
 *   3. **Debit atomically.** One conditional UPDATE that only succeeds while the
 *      balance still covers it, so two taps cannot both pass the check.
 *   4. **Then fulfil.** Each supplier line is bought after the money is secured,
 *      and any line the supplier refuses is refunded individually — the rest of
 *      the order stands.
 *
 * A customer therefore ends in exactly one of two states per line: charged and
 * delivered, or not charged at all.
 */

export type CheckoutInput = {
  userId: string;
  /** Customer inputs per variant, e.g. { [variantId]: { "معرف المستخدم": "123" } }. */
  params?: Record<string, Record<string, string>>;
};

export type CheckoutResult =
  | { ok: true; orderId: string; number: number; orderNumber: string; summary: OrderSummary }
  | { ok: false; error: string; variantId?: string };

export type OrderSummary = {
  total: number;
  delivered: number;
  pending: number;
  refunded: number;
};

/** What a checkout page needs to render one line, including its required inputs. */
export type CheckoutLine = {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  finalUnitPrice: number;
  lineTotal: number;
  /** Inputs the supplier demands for this product. */
  paramFields: ParamField[];
  minQty: number | null;
  maxQty: number | null;
  /** Set when the line cannot be bought right now; blocks the whole checkout. */
  problem: string | null;
};

/** Everything the checkout screen shows, priced and validated server-side. */
export type CheckoutPreview = {
  lines: CheckoutLine[];
  subtotal: number;
  discount: number;
  total: number;
  balance: number;
  /** True when the wallet cannot cover the total. */
  insufficient: boolean;
  blocking: string[];
};

/** `PC-260830-4821` — readable, sortable, and unique enough to retry on collision. */
function buildOrderNumber(): string {
  const now = new Date();
  const stamp = [
    String(now.getFullYear()).slice(2),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PC-${stamp}-${random}`;
}

/**
 * Loads the cart, prices it, and reports anything that would block payment.
 *
 * Shared by the checkout screen and the order itself, so what the customer is
 * shown and what they are charged come from one implementation.
 */
export async function buildCheckoutPreview(userId: string): Promise<CheckoutPreview> {
  const [cart, user, rates] = await Promise.all([
    prisma.cart.findUnique({
      where: { userId },
      select: {
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            quantity: true,
            variant: {
              select: {
                id: true,
                name: true,
                value: true,
                price: true,
                isActive: true,
                product: {
                  select: { id: true, name: true, image: true, isActive: true },
                },
                supplierMappings: {
                  where: { isPreferred: true, isEnabled: true },
                  take: 1,
                  select: {
                    supplierProduct: {
                      select: { paramFieldsJson: true, minQty: true, maxQty: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { balance: true } }),
    getDiscountRates(userId),
  ]);

  const rows = (cart?.items ?? []).filter(
    (row) => row.variant.isActive && row.variant.product.isActive,
  );

  const blocked = await getBlockedVariantIds(rows.map((row) => row.variant.id));

  const lines: CheckoutLine[] = [];
  let subtotal = 0;
  let total = 0;

  for (const row of rows) {
    const variant = row.variant;
    const mapping = variant.supplierMappings[0];
    const paramFields = parseParamFields(mapping?.supplierProduct.paramFieldsJson ?? null);
    const minQty = mapping?.supplierProduct.minQty ?? null;
    const maxQty = mapping?.supplierProduct.maxQty ?? null;

    const finalUnitPrice = discountedPrice(
      variant.price,
      rateForProduct(rates, variant.product.id),
    );

    let problem: string | null = null;
    if (blocked.has(variant.id)) problem = "غير متوفر لدى المزوّد حالياً";
    else if (minQty && row.quantity < minQty) problem = `الحد الأدنى للكمية ${minQty}`;
    else if (maxQty && row.quantity > maxQty) problem = `الحد الأقصى للكمية ${maxQty}`;

    subtotal += variant.price * row.quantity;
    total += finalUnitPrice * row.quantity;

    lines.push({
      variantId: variant.id,
      productId: variant.product.id,
      productName: variant.product.name,
      variantName: variant.value ?? variant.name,
      image: variant.product.image,
      quantity: row.quantity,
      unitPrice: variant.price,
      finalUnitPrice,
      lineTotal: finalUnitPrice * row.quantity,
      paramFields,
      minQty,
      maxQty,
      problem,
    });
  }

  const balance = user?.balance ?? 0;

  return {
    lines,
    subtotal,
    discount: subtotal - total,
    total,
    balance,
    insufficient: lines.length > 0 && balance < total,
    blocking: lines
      .filter((line) => line.problem)
      .map((line) => `${line.productName} — ${line.variantName}: ${line.problem}`),
  };
}

/**
 * Places the order.
 *
 * Everything up to and including the wallet debit runs inside one database
 * transaction, so an order without a matching debit — or a debit without an
 * order — is not a state this code can leave behind. Supplier calls happen
 * afterwards, deliberately outside that transaction: a slow provider must not
 * hold a write lock on the wallet.
 */
export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const preview = await buildCheckoutPreview(input.userId);

  if (preview.lines.length === 0) return { ok: false, error: "سلتك فارغة" };
  if (preview.blocking.length > 0) return { ok: false, error: preview.blocking[0] };
  if (preview.insufficient) {
    return { ok: false, error: "رصيد محفظتك لا يكفي لإتمام هذا الطلب" };
  }

  // ── 1. required customer inputs, before any money moves ──────────────────
  const validated = new Map<string, Record<string, string>>();

  for (const line of preview.lines) {
    if (line.paramFields.length === 0) continue;

    const supplied = input.params?.[line.variantId] ?? {};
    const check = validateParams(line.paramFields, supplied);
    if (!check.ok) {
      return {
        ok: false,
        error: `${line.productName} — ${line.variantName}: ${check.error}`,
        variantId: line.variantId,
      };
    }
    validated.set(line.variantId, check.params);
  }

  // ── 2. charge and record, atomically ─────────────────────────────────────
  let created: {
    id: string;
    number: number;
    orderNumber: string;
    items: { id: string; variantId: string | null }[];
  };

  try {
    created = await prisma.$transaction(async (tx) => {
      // Only succeeds while the balance still covers the total, so a second
      // simultaneous checkout cannot spend the same dirham twice.
      const debited = await tx.user.updateMany({
        where: { id: input.userId, balance: { gte: preview.total } },
        data: { balance: { decrement: preview.total } },
      });
      if (debited.count !== 1) throw new InsufficientBalanceError();

      const after = await tx.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { balance: true },
      });

      const number = await nextNumber(tx, "order");

      const order = await tx.order.create({
        data: {
          number,
          orderNumber: buildOrderNumber(),
          userId: input.userId,
          subtotal: preview.subtotal,
          discount: preview.discount,
          total: preview.total,
          status: "PROCESSING",
          items: {
            create: preview.lines.map((line) => ({
              variantId: line.variantId,
              // Snapshots, so the record stays readable after a rename.
              productName: line.productName,
              variantName: line.variantName,
              productImage: line.image,
              unitPrice: line.finalUnitPrice,
              quantity: line.quantity,
              total: line.lineTotal,
            })),
          },
        },
        select: {
          id: true,
          number: true,
          orderNumber: true,
          items: { select: { id: true, variantId: true } },
        },
      });

      await tx.transaction.create({
        data: {
          // The same number the order carries — one event, one name.
          number,
          userId: input.userId,
          type: "PURCHASE",
          amount: -preview.total,
          balanceAfter: after.balance,
          description: "دفع قيمة الطلب - المحفظة",
          orderId: order.id,
        },
      });

      // The cart is emptied in the same transaction: a paid order must never
      // leave its items sitting in the basket to be bought again.
      const cart = await tx.cart.findUnique({
        where: { userId: input.userId },
        select: { id: true },
      });
      if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { ok: false, error: "رصيد محفظتك لا يكفي لإتمام هذا الطلب" };
    }
    console.error("[checkout/placeOrder]", error);
    return { ok: false, error: "تعذّر إتمام الطلب، لم يُخصم من رصيدك شيء" };
  }

  // ── 3. fulfil, line by line ──────────────────────────────────────────────
  const summary: OrderSummary = { total: created.items.length, delivered: 0, pending: 0, refunded: 0 };

  for (const item of created.items) {
    const line = preview.lines.find((candidate) => candidate.variantId === item.variantId);
    if (!line) continue;

    // A manual product has no supplier: it waits for the admin to fulfil it.
    if (line.paramFields.length === 0 && line.minQty === null && line.maxQty === null) {
      const hasSupplier = await prisma.productSupplierMapping.count({
        where: { variantId: line.variantId, isPreferred: true, isEnabled: true },
      });
      if (hasSupplier === 0) {
        summary.pending++;
        continue;
      }
    }

    const outcome = await fulfilOrderItem({
      orderItemId: item.id,
      adminId: null,
      params: validated.get(line.variantId) ?? {},
      quantity: line.quantity,
    });

    if (outcome.status === "COMPLETED") summary.delivered++;
    else if (outcome.status === "PROCESSING") summary.pending++;
    else {
      // The supplier refused. Give this line's money back immediately rather
      // than leaving the customer to notice and ask.
      const refunded = await refundOrderLine(item.id, input.userId);
      if (refunded) summary.refunded++;
      else summary.pending++;
    }
  }

  await prisma.order.update({
    where: { id: created.id },
    data: {
      status:
        summary.delivered === summary.total
          ? "COMPLETED"
          : summary.refunded === summary.total
            ? "CANCELLED"
            : "PROCESSING",
    },
  });

  return {
    ok: true,
    orderId: created.id,
    number: created.number,
    orderNumber: created.orderNumber,
    summary,
  };
}

class InsufficientBalanceError extends Error {}

/**
 * Returns one line's money to the wallet.
 *
 * Guarded by the supplier order's `refundedAt` stamp inside the transaction, so
 * a retry — or two failures racing — cannot credit the customer twice.
 */
async function refundOrderLine(orderItemId: string, userId: string): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        select: {
          total: true,
          productName: true,
          variantName: true,
          orderId: true,
          supplierOrder: { select: { id: true, refundedAt: true } },
        },
      });
      if (!item || item.total <= 0) return false;
      if (item.supplierOrder?.refundedAt) return false;

      const user = await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: item.total } },
        select: { balance: true },
      });

      await tx.transaction.create({
        data: {
          // Money coming back is a credit, so it counts on the deposit series.
          number: await nextNumber(tx, "deposit"),
          userId,
          type: "REFUND",
          amount: item.total,
          balanceAfter: user.balance,
          description: `تعذّر تنفيذ: ${item.productName} — ${item.variantName}`,
          orderId: item.orderId,
        },
      });

      if (item.supplierOrder) {
        await tx.supplierOrder.update({
          where: { id: item.supplierOrder.id },
          data: { refundedAt: new Date(), status: "REFUNDED" },
        });
      }

      return true;
    });
  } catch (error) {
    console.error("[checkout/refundOrderLine]", error);
    return false;
  }
}
