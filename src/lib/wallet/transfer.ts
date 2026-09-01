import "server-only";

import { prisma } from "@/lib/db";
import { nextNumber } from "@/lib/sequences";

/**
 * Wallet-to-wallet transfer between two customers.
 *
 * The rule this file exists to enforce: **money only moves inside the same
 * database transaction that records why, and only out of a balance that still
 * covers it.** The debit is a conditional `updateMany` — it matches only while
 * `balance >= amount`, so two transfers fired at the same moment cannot both
 * succeed on the same dinar. If it matches nothing, the whole transaction rolls
 * back and nobody's balance moved.
 *
 * The recipient is named by their public account id, never by a database id
 * from a form: the id is short enough to read out over the phone, and it
 * identifies without authorising anything.
 */

/** Small enough to be useful, large enough that a typo is not free. */
export const MIN_TRANSFER = 100; // 1.00 د.ل

export type TransferInput = {
  senderId: string;
  /** The recipient's public account id, as typed. */
  recipientPublicId: string;
  /** Minor units. */
  amount: number;
  note?: string | null;
};

export type TransferResult =
  | { ok: true; recipientName: string; amount: number; number: number }
  | { ok: false; error: string };

export async function transferBalance(input: TransferInput): Promise<TransferResult> {
  const publicId = input.recipientPublicId.trim().toUpperCase();
  if (!publicId) return { ok: false, error: "أدخل معرّف حساب المستلم" };

  if (!Number.isInteger(input.amount) || input.amount < MIN_TRANSFER) {
    return { ok: false, error: "أقل مبلغ للتحويل 1 د.ل" };
  }

  const recipient = await prisma.user.findUnique({
    where: { publicId },
    select: { id: true, name: true, status: true },
  });

  // Deliberately the same message for "no such account" and "that account is
  // blocked": the difference is not the sender's business, and telling them
  // would turn this box into a way to probe which ids exist.
  if (!recipient || recipient.status !== "ACTIVE") {
    return { ok: false, error: "لا يوجد حساب بهذا المعرّف" };
  }

  if (recipient.id === input.senderId) {
    return { ok: false, error: "لا يمكنك التحويل إلى نفسك" };
  }

  const note = input.note?.trim().slice(0, 140) || null;

  try {
    const number = await prisma.$transaction(async (tx) => {
      // Only succeeds while the balance still covers it.
      const debited = await tx.user.updateMany({
        where: { id: input.senderId, balance: { gte: input.amount } },
        data: { balance: { decrement: input.amount } },
      });
      if (debited.count !== 1) throw new InsufficientBalanceError();

      const credited = await tx.user.updateMany({
        where: { id: recipient.id, status: "ACTIVE" },
        data: { balance: { increment: input.amount } },
      });
      // The recipient was blocked between the check above and this write.
      if (credited.count !== 1) throw new RecipientUnavailableError();

      const [sender, receiver] = await Promise.all([
        tx.user.findUniqueOrThrow({
          where: { id: input.senderId },
          select: { balance: true, publicId: true, name: true },
        }),
        tx.user.findUniqueOrThrow({
          where: { id: recipient.id },
          select: { balance: true },
        }),
      ]);

      // Debits count on the order sequence, credits on the deposit one — the
      // same rule the rest of the wallet follows, so the two sides of a
      // transfer read correctly in each customer's own history.
      const [outNumber, inNumber] = await Promise.all([
        nextNumber(tx, "order"),
        nextNumber(tx, "deposit"),
      ]);

      await tx.transaction.createMany({
        data: [
          {
            number: outNumber,
            userId: input.senderId,
            type: "TRANSFER",
            amount: -input.amount,
            balanceAfter: sender.balance,
            description: `تحويل إلى ${recipient.name}${note ? ` — ${note}` : ""}`,
          },
          {
            number: inNumber,
            userId: recipient.id,
            type: "TRANSFER",
            amount: input.amount,
            balanceAfter: receiver.balance,
            description: `تحويل من ${sender.name}${note ? ` — ${note}` : ""}`,
          },
        ],
      });

      return outNumber;
    });

    return { ok: true, recipientName: recipient.name, amount: input.amount, number };
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { ok: false, error: "رصيدك لا يكفي لهذا التحويل" };
    }
    if (error instanceof RecipientUnavailableError) {
      return { ok: false, error: "لا يوجد حساب بهذا المعرّف" };
    }
    console.error("[wallet/transfer]", error);
    return { ok: false, error: "تعذّر تنفيذ التحويل، حاول مرة أخرى" };
  }
}

class InsufficientBalanceError extends Error {}
class RecipientUnavailableError extends Error {}

/** Everything this customer has spent on orders since they joined. */
export async function totalSpent(userId: string) {
  const spent = await prisma.transaction.aggregate({
    where: { userId, type: "PURCHASE" },
    _sum: { amount: true },
  });
  const refunded = await prisma.transaction.aggregate({
    where: { userId, type: "REFUND" },
    _sum: { amount: true },
  });

  // Purchases are negative and refunds positive, so the net of the two is what
  // actually left the wallet. A refunded order should not read as money spent.
  const net = (spent._sum.amount ?? 0) + (refunded._sum.amount ?? 0);
  return Math.max(0, -net);
}
