import "server-only";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getAdapter } from "@/lib/suppliers/adapters";
import { sanitize } from "@/lib/suppliers/http";
import { nextNumber } from "@/lib/sequences";
import { logSupplierAction, toContext } from "@/lib/suppliers/service";
import type { ParamField, PurchaseOutcome } from "@/lib/suppliers/types";
import type { SupplierOrderStatus, SupplierProductType } from "@/generated/prisma/enums";

/**
 * Buying from a supplier, exactly once.
 *
 * Everything here exists to make one promise keepable: **a customer is never
 * charged twice and never billed for nothing.** Two mechanisms carry it.
 *
 *   1. **A committed claim before any call.** `SupplierOrder` is created — with
 *      its idempotency key — and marked PROCESSING in a transaction *before* the
 *      first byte goes out. The unique index on `orderItemId` means a second
 *      request for the same line loses the race at the database, not in a
 *      hopeful `if`. A double tap therefore finds an existing row and returns
 *      its state instead of buying again.
 *
 *   2. **A stable `orderUuid` reused across retries.** The provider gets the
 *      same key on attempt three that it got on attempt one, so a retry after a
 *      timeout returns the original order rather than placing a new one.
 *
 * When the outcome is genuinely unknown — a timeout, a 5xx, an unparseable
 * body — the line lands in NEEDS_REVIEW rather than being retried blindly.
 * Re-sending a purchase we might already have made is the one failure mode
 * money cannot be recovered from.
 *
 * ── On refunds ──────────────────────────────────────────────────────────────
 * `refundOrderItem` reverses a wallet debit by looking for the PURCHASE
 * transaction that actually charged the customer. PLUS CARD has no checkout
 * yet, so today that transaction never exists and the function correctly
 * reports "nothing to reverse". It is written now so that the day checkout
 * lands, the failure path is already correct rather than being retro-fitted
 * around live orders.
 */

export type FulfilmentResult = {
  status: SupplierOrderStatus;
  supplierOrderId: string;
  /** Arabic, sanitized, admin-facing. */
  message: string;
  /** True when this call did not contact the supplier because a claim existed. */
  deduplicated?: boolean;
};

/** Reads a catalog row's declared input fields. */
export function parseParamFields(json: string | null): ParamField[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as ParamField[]) : [];
  } catch {
    return [];
  }
}

export type ValidationResult =
  | { ok: true; params: Record<string, string> }
  | { ok: false; error: string };

/**
 * Validates customer input against what the supplier said it needs.
 *
 * Server-side and mandatory: the field list came from the provider, so the
 * browser's copy of it is a convenience, never the authority. Unknown keys are
 * dropped rather than forwarded — a client cannot smuggle extra fields into a
 * supplier request.
 */
export function validateParams(
  fields: ParamField[],
  input: Record<string, unknown>,
): ValidationResult {
  const params: Record<string, string> = {};

  for (const field of fields) {
    const raw = input[field.name];
    const value = typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();

    if (!value) {
      if (field.required) return { ok: false, error: `الحقل "${field.label}" مطلوب` };
      continue;
    }

    if (field.minLength && value.length < field.minLength) {
      return { ok: false, error: `"${field.label}" أقصر من الحد الأدنى (${field.minLength})` };
    }
    if (field.maxLength && value.length > field.maxLength) {
      return { ok: false, error: `"${field.label}" أطول من الحد الأقصى (${field.maxLength})` };
    }
    if (field.type === "number" && !Number.isFinite(Number(value))) {
      return { ok: false, error: `"${field.label}" يجب أن يكون رقماً` };
    }
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { ok: false, error: `"${field.label}" ليس بريداً صالحاً` };
    }
    if (field.type === "url" && !/^https?:\/\/\S+$/i.test(value)) {
      return { ok: false, error: `"${field.label}" يجب أن يكون رابطاً يبدأ بـ http(s)` };
    }

    params[field.name] = value;
  }

  return { ok: true, params };
}

/** States from which contacting the supplier again is safe. */
const RETRYABLE_STATES: SupplierOrderStatus[] = ["PENDING", "FAILED"];

export type PurchaseInput = {
  /** The PLUS CARD line to fulfil. */
  orderItemId: string;
  /** The acting admin, or null when a customer checkout drove the purchase. */
  adminId: string | null;
  /** Raw customer input; validated here against the catalog row. */
  params?: Record<string, unknown>;
  quantity?: number;
};

/**
 * Fulfils one order line from its preferred supplier.
 *
 * Returns rather than throws: a supplier outage must leave a diagnosable
 * record, not a stack trace in an admin screen.
 */
export async function fulfilOrderItem(input: PurchaseInput): Promise<FulfilmentResult> {
  const orderItem = await prisma.orderItem.findUnique({
    where: { id: input.orderItemId },
    select: {
      id: true,
      orderId: true,
      variantId: true,
      quantity: true,
      deliveredCode: true,
      order: { select: { userId: true } },
      supplierOrder: { select: { id: true, status: true, orderUuid: true } },
    },
  });

  if (!orderItem) {
    return { status: "FAILED", supplierOrderId: "", message: "بند الطلب غير موجود" };
  }

  // ── 1. an existing claim wins ────────────────────────────────────────────
  const existing = orderItem.supplierOrder;
  if (existing && !RETRYABLE_STATES.includes(existing.status)) {
    return {
      status: existing.status,
      supplierOrderId: existing.id,
      deduplicated: true,
      message:
        existing.status === "COMPLETED"
          ? "هذا البند مُنفَّذ بالفعل — لم يُرسل أي طلب جديد"
          : existing.status === "PROCESSING"
            ? "طلب سابق قيد التنفيذ لدى المزوّد — حدّث الحالة بدل إعادة الشراء"
            : "هذا البند بحاجة إلى مراجعة يدوية قبل أي محاولة جديدة",
    };
  }

  if (!orderItem.variantId) {
    return { status: "FAILED", supplierOrderId: "", message: "البند غير مرتبط بفئة سعرية" };
  }

  // ── 2. resolve the supplier behind this variant ──────────────────────────
  const mapping = await prisma.productSupplierMapping.findFirst({
    where: { variantId: orderItem.variantId, isPreferred: true, isEnabled: true },
    select: {
      supplierId: true,
      supplier: {
        select: {
          id: true,
          name: true,
          adapter: true,
          baseUrl: true,
          authType: true,
          secretCipher: true,
          currency: true,
          timeoutMs: true,
          environment: true,
          status: true,
        },
      },
      supplierProduct: {
        select: {
          externalProductId: true,
          externalVariantId: true,
          productType: true,
          paramFieldsJson: true,
          availability: true,
          missingSince: true,
          cost: true,
          currency: true,
          minQty: true,
          maxQty: true,
        },
      },
    },
  });

  if (!mapping) {
    return { status: "FAILED", supplierOrderId: "", message: "لا يوجد مزوّد معتمد لهذا البند" };
  }
  if (mapping.supplier.status !== "ACTIVE") {
    return { status: "FAILED", supplierOrderId: "", message: "المزوّد معطّل" };
  }
  if (mapping.supplierProduct.missingSince !== null) {
    return {
      status: "FAILED",
      supplierOrderId: "",
      message: "العنصر لم يعد موجوداً في كتالوج المزوّد",
    };
  }

  const adapter = getAdapter(mapping.supplier.adapter);
  if (!adapter?.purchase) {
    return {
      status: "FAILED",
      supplierOrderId: "",
      message: `نوع الربط "${mapping.supplier.adapter}" لا يدعم الشراء`,
    };
  }

  // ── 3. validate quantity and customer inputs ─────────────────────────────
  const quantity = Math.max(1, Math.trunc(input.quantity ?? orderItem.quantity ?? 1));
  const { minQty, maxQty } = mapping.supplierProduct;
  if (minQty && quantity < minQty) {
    return { status: "FAILED", supplierOrderId: "", message: `الحد الأدنى للكمية ${minQty}` };
  }
  if (maxQty && quantity > maxQty) {
    return { status: "FAILED", supplierOrderId: "", message: `الحد الأقصى للكمية ${maxQty}` };
  }

  const fields = parseParamFields(mapping.supplierProduct.paramFieldsJson);
  const validation = validateParams(fields, input.params ?? {});
  if (!validation.ok) {
    return { status: "FAILED", supplierOrderId: "", message: validation.error };
  }

  const productType: SupplierProductType = mapping.supplierProduct.productType;

  // ── 4. claim the line, before any network call ───────────────────────────
  // The unique index on orderItemId is what makes this a claim rather than a
  // hope: a concurrent second request fails here instead of buying again.
  let claim: { id: string; orderUuid: string; attempts: number };

  try {
    claim = await prisma.$transaction(async (tx) => {
      const current = await tx.supplierOrder.findUnique({
        where: { orderItemId: orderItem.id },
        select: { id: true, status: true, orderUuid: true, attempts: true },
      });

      if (current) {
        if (!RETRYABLE_STATES.includes(current.status)) {
          throw new AlreadyClaimedError(current.id, current.status);
        }
        // A retry keeps the original uuid — that is the whole point of it.
        const updated = await tx.supplierOrder.update({
          where: { id: current.id },
          data: {
            status: "PROCESSING",
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
            paramsJson: JSON.stringify(validation.params),
            quantity,
          },
          select: { id: true, orderUuid: true, attempts: true },
        });
        return updated;
      }

      const created = await tx.supplierOrder.create({
        data: {
          supplierId: mapping.supplierId,
          orderItemId: orderItem.id,
          orderId: orderItem.orderId,
          userId: orderItem.order.userId,
          productType,
          status: "PROCESSING",
          orderUuid: randomUUID(),
          externalProductId: mapping.supplierProduct.externalProductId,
          externalVariantId: mapping.supplierProduct.externalVariantId,
          quantity,
          paramsJson: JSON.stringify(validation.params),
          cost: mapping.supplierProduct.cost,
          currency: mapping.supplierProduct.currency,
          attempts: 1,
          lastAttemptAt: new Date(),
        },
        select: { id: true, orderUuid: true, attempts: true },
      });
      return created;
    });
  } catch (error) {
    if (error instanceof AlreadyClaimedError) {
      return {
        status: error.status,
        supplierOrderId: error.supplierOrderId,
        deduplicated: true,
        message: "طلب آخر لنفس البند سبقك — لم يُرسل شراء جديد",
      };
    }
    console.error("[suppliers/fulfil] claim failed", error);
    return { status: "FAILED", supplierOrderId: "", message: "تعذّر حجز البند للتنفيذ" };
  }

  await logSupplierAction({
    adminId: input.adminId,
    supplierId: mapping.supplierId,
    supplierName: mapping.supplier.name,
    action: "PURCHASE_ATTEMPT",
    detail: `محاولة ${claim.attempts} · ${productType} · ${mapping.supplierProduct.externalProductId}`,
  });

  // ── 5. buy ───────────────────────────────────────────────────────────────
  const context = toContext(mapping.supplier);
  let outcome: PurchaseOutcome;

  try {
    outcome = await adapter.purchase(context, {
      externalProductId: mapping.supplierProduct.externalProductId,
      externalVariantId: mapping.supplierProduct.externalVariantId,
      quantity,
      params: validation.params,
      orderUuid: claim.orderUuid,
      productType,
    });
  } catch (error) {
    // An adapter that threw instead of returning leaves the outcome unknown,
    // which is precisely the case that must not be auto-retried.
    const message = sanitize(error, context);
    await prisma.supplierOrder.update({
      where: { id: claim.id },
      data: { status: "NEEDS_REVIEW", lastError: message },
    });
    await logSupplierAction({
      adminId: input.adminId,
      supplierId: mapping.supplierId,
      supplierName: mapping.supplier.name,
      action: "PURCHASE_FAILURE",
      detail: `نتيجة غير مؤكدة — ${message}`,
    });
    return {
      status: "NEEDS_REVIEW",
      supplierOrderId: claim.id,
      message: `نتيجة غير مؤكدة، يلزم التحقق يدوياً: ${message}`,
    };
  }

  // ── 6. record what happened ──────────────────────────────────────────────
  return persistOutcome({
    outcome,
    claimId: claim.id,
    orderItemId: orderItem.id,
    adminId: input.adminId,
    supplierId: mapping.supplierId,
    supplierName: mapping.supplier.name,
    supplierCost: mapping.supplierProduct.cost,
    supplierCurrency: mapping.supplierProduct.currency,
    externalProductId: mapping.supplierProduct.externalProductId,
    externalVariantId: mapping.supplierProduct.externalVariantId,
  });
}

class AlreadyClaimedError extends Error {
  constructor(
    readonly supplierOrderId: string,
    readonly status: SupplierOrderStatus,
  ) {
    super("already claimed");
  }
}

async function persistOutcome(args: {
  outcome: PurchaseOutcome;
  claimId: string;
  orderItemId: string;
  adminId: string | null;
  supplierId: string;
  supplierName: string;
  supplierCost: number;
  supplierCurrency: string;
  externalProductId: string;
  externalVariantId: string;
}): Promise<FulfilmentResult> {
  const { outcome, claimId, orderItemId } = args;

  if (outcome.status === "COMPLETED") {
    await prisma.$transaction([
      prisma.supplierOrder.update({
        where: { id: claimId },
        data: {
          status: "COMPLETED",
          externalOrderId: outcome.externalOrderId ?? null,
          externalStatus: outcome.externalStatus ?? null,
          responseJson: JSON.stringify(outcome.snapshot ?? {}),
          lastError: null,
        },
      }),
      prisma.orderItem.update({
        where: { id: orderItemId },
        data: {
          // The goods live on the order line, reachable only through a query
          // that has already checked the owning customer.
          deliveredCode: outcome.secret?.code ?? null,
          deliveredSerial: outcome.secret?.serial ?? null,
          deliveredExpiry: outcome.secret?.expiresAt ?? null,
          supplierId: args.supplierId,
          supplierName: args.supplierName,
          externalProductId: args.externalProductId,
          externalVariantId: args.externalVariantId || null,
          supplierCost: args.supplierCost,
          supplierCurrency: args.supplierCurrency,
        },
      }),
    ]);

    await logSupplierAction({
      adminId: args.adminId,
      supplierId: args.supplierId,
      supplierName: args.supplierName,
      action: "PURCHASE_SUCCESS",
      // Deliberately records that goods arrived, never the goods themselves.
      detail: `تم التنفيذ · ${outcome.externalOrderId ?? "بدون رقم مزوّد"}`,
    });

    return { status: "COMPLETED", supplierOrderId: claimId, message: "تم الشراء والتسليم" };
  }

  if (outcome.status === "PROCESSING") {
    await prisma.supplierOrder.update({
      where: { id: claimId },
      data: {
        status: "PROCESSING",
        externalOrderId: outcome.externalOrderId ?? null,
        externalStatus: outcome.externalStatus ?? null,
        responseJson: JSON.stringify(outcome.snapshot ?? {}),
      },
    });

    return {
      status: "PROCESSING",
      supplierOrderId: claimId,
      message: "قبِل المزوّد الطلب وهو قيد التنفيذ — حدّث الحالة لاحقاً",
    };
  }

  // FAILED. A retryable failure stays FAILED so an admin may try again; an
  // ambiguous or balance-related one is escalated instead.
  const status: SupplierOrderStatus =
    outcome.supplierBalanceShort || !outcome.retryable ? "NEEDS_REVIEW" : "FAILED";

  await prisma.supplierOrder.update({
    where: { id: claimId },
    data: {
      status,
      externalOrderId: outcome.externalOrderId ?? null,
      externalStatus: outcome.externalStatus ?? null,
      responseJson: JSON.stringify(outcome.snapshot ?? {}),
      lastError: outcome.message,
    },
  });

  await logSupplierAction({
    adminId: args.adminId,
    supplierId: args.supplierId,
    supplierName: args.supplierName,
    action: "PURCHASE_FAILURE",
    detail: outcome.message,
  });

  return { status, supplierOrderId: claimId, message: outcome.message };
}

/**
 * Asks the supplier what became of a Social order.
 *
 * Pull-only and admin-triggered by design: polling every page load would hammer
 * the provider for information that changes on its own schedule.
 */
export async function refreshSupplierOrderStatus(
  supplierOrderId: string,
  adminId: string | null,
): Promise<FulfilmentResult> {
  const order = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    select: {
      id: true,
      orderUuid: true,
      externalOrderId: true,
      status: true,
      supplier: {
        select: {
          id: true,
          name: true,
          adapter: true,
          baseUrl: true,
          authType: true,
          secretCipher: true,
          currency: true,
          timeoutMs: true,
          environment: true,
        },
      },
    },
  });

  if (!order) return { status: "FAILED", supplierOrderId, message: "الطلب غير موجود" };

  const adapter = getAdapter(order.supplier.adapter);
  if (!adapter?.orderStatus) {
    return {
      status: order.status,
      supplierOrderId,
      message: "هذا المزوّد لا يدعم الاستعلام عن حالة الطلب",
    };
  }

  const context = toContext(order.supplier);
  const result = await adapter.orderStatus(context, {
    externalOrderId: order.externalOrderId,
    orderUuid: order.orderUuid,
  });

  // UNKNOWN never advances the record — not knowing is not news.
  const next: SupplierOrderStatus =
    result.status === "COMPLETED"
      ? "COMPLETED"
      : result.status === "FAILED"
        ? "NEEDS_REVIEW"
        : result.status === "PROCESSING"
          ? "PROCESSING"
          : order.status;

  await prisma.supplierOrder.update({
    where: { id: supplierOrderId },
    data: {
      status: next,
      externalStatus: result.externalStatus ?? undefined,
      ...(result.snapshot ? { responseJson: JSON.stringify(result.snapshot) } : {}),
      ...(result.message ? { lastError: sanitize(result.message, context) } : {}),
    },
  });

  await logSupplierAction({
    adminId,
    supplierId: order.supplier.id,
    supplierName: order.supplier.name,
    action: "STATUS_SYNC",
    detail: `${order.status} ← ${next} · ${result.externalStatus ?? "—"}`,
  });

  return {
    status: next,
    supplierOrderId,
    message: result.message ?? `الحالة لدى المزوّد: ${result.externalStatus ?? result.status}`,
  };
}

/**
 * Reverses the wallet debit for a failed line.
 *
 * Finds the PURCHASE transaction that actually charged this order and credits
 * it back inside one transaction, so a wallet cannot move without a matching
 * record. Refunding twice is refused by the `refundedAt` stamp.
 */
export async function refundOrderItem(
  supplierOrderId: string,
  adminId: string | null,
): Promise<{ ok: boolean; message: string }> {
  const supplierOrder = await prisma.supplierOrder.findUnique({
    where: { id: supplierOrderId },
    select: {
      id: true,
      orderId: true,
      userId: true,
      refundedAt: true,
      status: true,
      supplierId: true,
      supplier: { select: { name: true } },
      orderItem: { select: { id: true, total: true, productName: true } },
    },
  });

  if (!supplierOrder) return { ok: false, message: "الطلب غير موجود" };
  if (supplierOrder.refundedAt) return { ok: false, message: "سبق استرجاع هذا البند" };
  if (supplierOrder.status === "COMPLETED") {
    return { ok: false, message: "لا يمكن استرجاع بند مُنفَّذ بنجاح" };
  }
  if (!supplierOrder.userId || !supplierOrder.orderItem) {
    return { ok: false, message: "البند غير مرتبط بعميل" };
  }

  // A charge must actually have happened before anything is given back. The
  // transaction is the proof; the amount returned is this *line's* total, not
  // the whole order's — refunding one failed item must not hand back the price
  // of every item that was delivered alongside it.
  const charge = await prisma.transaction.findFirst({
    where: { orderId: supplierOrder.orderId ?? undefined, type: "PURCHASE" },
    select: { id: true, amount: true },
  });

  if (!charge) {
    await prisma.supplierOrder.update({
      where: { id: supplierOrderId },
      data: { refundedAt: new Date(), status: "REFUNDED" },
    });
    return { ok: true, message: "لا توجد عملية خصم مرتبطة — لم يُخصم من العميل شيء" };
  }

  const amount = supplierOrder.orderItem.total;
  if (amount <= 0) return { ok: false, message: "لا يوجد مبلغ لاسترجاعه" };

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: supplierOrder.userId! },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });

    await tx.transaction.create({
      data: {
        number: await nextNumber(tx, "deposit"),
        userId: supplierOrder.userId!,
        type: "REFUND",
        amount,
        balanceAfter: user.balance,
        description: `استرجاع تعذّر تنفيذه: ${supplierOrder.orderItem!.productName}`,
        orderId: supplierOrder.orderId,
        adminId,
      },
    });

    await tx.supplierOrder.update({
      where: { id: supplierOrderId },
      data: { refundedAt: new Date(), status: "REFUNDED" },
    });
  });

  await logSupplierAction({
    adminId,
    supplierId: supplierOrder.supplierId,
    supplierName: supplierOrder.supplier.name,
    action: "REFUND",
    detail: `استرجاع ${amount} وحدة صغرى للعميل`,
  });

  return { ok: true, message: "تم استرجاع المبلغ إلى محفظة العميل" };
}
