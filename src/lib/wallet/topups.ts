import "server-only";

import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/sequences";
import { quoteTopUp } from "@/lib/wallet/fees";

/**
 * Top-up requests: raising them, and turning an approved one into money.
 *
 * The rule the whole file exists to enforce: **a balance only ever moves inside
 * the same database transaction that records why.** Approval credits the wallet,
 * writes the `Transaction` row and stamps the request in one atomic step, and
 * the stamp is what makes approving twice impossible — the second attempt finds
 * the request no longer PENDING and stops.
 */

export type CreateTopUpInput = {
  userId: string;
  methodId: string;
  /** What the customer says they paid, in minor units. */
  amount: number;
  reference?: string | null;
  note?: string | null;
};

export type TopUpResult =
  | { ok: true; id: string; number: number }
  | { ok: false; error: string };

/** One pending claim at a time, so a queue of duplicates cannot build up. */
const MAX_PENDING_PER_USER = 3;

export async function createTopUpRequest(input: CreateTopUpInput): Promise<TopUpResult> {
  const method = await prisma.paymentMethod.findUnique({
    where: { id: input.methodId },
    select: {
      id: true,
      name: true,
      isActive: true,
      feeBps: true,
      feeFixed: true,
      minAmount: true,
      maxAmount: true,
    },
  });

  if (!method || !method.isActive) return { ok: false, error: "طريقة الشحن غير متاحة" };

  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "أدخل مبلغاً أكبر من صفر" };
  }
  if (method.minAmount && amount < method.minAmount) {
    return { ok: false, error: `الحد الأدنى لهذه الطريقة ${method.minAmount / 100} د.ل` };
  }
  if (method.maxAmount && amount > method.maxAmount) {
    return { ok: false, error: `الحد الأقصى لهذه الطريقة ${method.maxAmount / 100} د.ل` };
  }

  const pending = await prisma.topUpRequest.count({
    where: { userId: input.userId, status: "PENDING" },
  });
  if (pending >= MAX_PENDING_PER_USER) {
    return { ok: false, error: "لديك طلبات شحن قيد المراجعة — انتظر البتّ فيها أولاً" };
  }

  // The fee is frozen onto the request now. A later change to the rail's rate
  // must not silently alter what an already-submitted claim is worth.
  const quote = quoteTopUp(amount, { feeBps: method.feeBps, feeFixed: method.feeFixed });
  if (quote.credited <= 0) return { ok: false, error: "المبلغ لا يغطي رسوم هذه الطريقة" };

  // The number and the row are written together, so a failed create cannot
  // leave a gap in the deposit series.
  const created = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, "deposit");

    return tx.topUpRequest.create({
      data: {
        number,
        userId: input.userId,
        methodId: method.id,
        methodName: method.name,
        amount: quote.amount,
        fee: quote.fee,
        credited: quote.credited,
        reference: input.reference?.trim() || null,
        note: input.note?.trim() || null,
      },
      select: { id: true, number: true },
    });
  });

  return { ok: true, id: created.id, number: created.number };
}

/** A customer withdrawing their own claim. Only ever their own, only if pending. */
export async function cancelTopUpRequest(
  id: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const changed = await prisma.topUpRequest.updateMany({
    where: { id, userId, status: "PENDING" },
    data: { status: "CANCELLED" },
  });

  return changed.count === 1
    ? { ok: true }
    : { ok: false, error: "لا يمكن إلغاء هذا الطلب" };
}

export type ReviewResult =
  | { ok: true; credited: number; balanceAfter: number }
  | { ok: false; error: string };

/**
 * Approves a request and credits the wallet.
 *
 * Everything happens in one transaction, and it opens by moving the request out
 * of PENDING with a conditional update. If a second approval is racing this
 * one, its update matches zero rows and it aborts before any money moves — the
 * database decides the winner, not the order the requests arrived in.
 */
export async function approveTopUp(
  id: string,
  adminId: string,
  adminNote?: string | null,
): Promise<ReviewResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.topUpRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", reviewedById: adminId, reviewedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return { ok: false as const, error: "هذا الطلب لم يعد قيد المراجعة" };
      }

      const request = await tx.topUpRequest.findUniqueOrThrow({
        where: { id },
        select: {
          userId: true,
          credited: true,
          amount: true,
          fee: true,
          methodName: true,
          number: true,
        },
      });

      const user = await tx.user.update({
        where: { id: request.userId },
        data: { balance: { increment: request.credited } },
        select: { balance: true },
      });

      const transaction = await tx.transaction.create({
        data: {
          // The number the customer already saw on their request.
          number: request.number,
          userId: request.userId,
          type: "DEPOSIT",
          amount: request.credited,
          balanceAfter: user.balance,
          description: `شحن المحفظة - ${request.methodName}`,
          adminId,
        },
        select: { id: true },
      });

      await tx.topUpRequest.update({
        where: { id },
        data: { adminNote: adminNote?.trim() || null, transactionId: transaction.id },
      });

      await tx.adminActionLog.create({
        data: {
          adminId,
          targetUserId: request.userId,
          type: "TOPUP_APPROVED",
          amount: request.credited,
          balanceBefore: user.balance - request.credited,
          balanceAfter: user.balance,
          note: `شحن عبر ${request.methodName}${request.fee > 0 ? ` · رسوم ${request.fee}` : ""}`,
        },
      });

      return { ok: true as const, credited: request.credited, balanceAfter: user.balance };
    });
  } catch (error) {
    console.error("[wallet/approveTopUp]", error);
    return { ok: false, error: "تعذّر اعتماد الطلب" };
  }
}

/** Rejects a request. No balance moves, but the decision is still recorded. */
export async function rejectTopUp(
  id: string,
  adminId: string,
  adminNote?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const request = await prisma.topUpRequest.findUnique({
      where: { id },
      select: { userId: true, methodName: true, amount: true },
    });
    if (!request) return { ok: false, error: "الطلب غير موجود" };

    const changed = await prisma.topUpRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: "REJECTED",
        reviewedById: adminId,
        reviewedAt: new Date(),
        adminNote: adminNote?.trim() || null,
      },
    });
    if (changed.count !== 1) return { ok: false, error: "هذا الطلب لم يعد قيد المراجعة" };

    await prisma.adminActionLog.create({
      data: {
        adminId,
        targetUserId: request.userId,
        type: "TOPUP_REJECTED",
        amount: request.amount,
        note: adminNote?.trim() || `رفض شحن عبر ${request.methodName}`,
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("[wallet/rejectTopUp]", error);
    return { ok: false, error: "تعذّر رفض الطلب" };
  }
}
