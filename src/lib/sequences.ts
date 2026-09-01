import "server-only";

import type { Prisma } from "@/generated/prisma/client";

/**
 * Customer-facing numbers.
 *
 * Two separate series, deliberately: a customer reading "#1" on a deposit and
 * "#1" on an order is reading two unrelated things, and collapsing them into one
 * counter would make every support conversation ambiguous.
 *
 * The counter advances with `increment` inside the caller's transaction, so the
 * read and the write are one atomic step — two checkouts racing get 7 and 8,
 * never 7 twice — and a rolled-back transaction gives its number back rather
 * than burning it.
 */

export type SequenceKey = "order" | "deposit";

/**
 * Returns the next number for `key`. Must be called inside a transaction that
 * also writes the record being numbered.
 */
export async function nextNumber(
  tx: Prisma.TransactionClient,
  key: SequenceKey,
): Promise<number> {
  const row = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });

  return row.value;
}

/** `#12` — the way a number is shown to a customer. */
export function formatNumber(value: number): string {
  return `#${value}`;
}
