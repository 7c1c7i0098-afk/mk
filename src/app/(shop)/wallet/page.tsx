import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmptyTransactions } from "@/components/shop/empty-transactions";
import { MoneyText } from "@/components/shop/money-text";
import { PendingTopUps } from "@/components/shop/pending-topups";
import { RefreshButton } from "@/components/shop/refresh-button";
import { TopUpSheet, type MethodOption } from "@/components/shop/topup-sheet";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";
import type { TransactionType } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "المحفظة" };

/**
 * The customer's wallet.
 *
 * Read-only where money is concerned: a customer can *ask* to top up, but only
 * an admin approval moves a balance. Every row in the history below is the
 * immutable record written beside the change that produced it.
 *
 * ── On the transaction card ─────────────────────────────────────────────────
 * Every line in a row shares one type size and family. Weight and colour carry
 * the hierarchy instead, which keeps a dense list scannable without turning it
 * into three competing sizes.
 */

const TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: "شحن رصيد",
  PURCHASE: "عملية شراء",
  REFUND: "استرجاع مبلغ",
  ADJUSTMENT: "تعديل رصيد",
  TRANSFER: "تحويل رصيد",
};

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/wallet");

  const [transactions, methods, pending] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        number: true,
        description: true,
        createdAt: true,
      },
    }),
    prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        logo: true,
        description: true,
        instructions: true,
        feeBps: true,
        feeFixed: true,
        exchangeRate: true,
        minAmount: true,
        maxAmount: true,
      },
    }),
    prisma.topUpRequest.findMany({
      where: { userId: user.id, status: { in: ["PENDING", "REJECTED"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        number: true,
        methodName: true,
        amount: true,
        credited: true,
        status: true,
        adminNote: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-fg">المحفظة</h1>
        <div className="ms-auto">
          <RefreshButton label="تحديث الرصيد" />
        </div>
      </div>

      {/* ── balance ─────────────────────────────────────────────────────── */}
      <section className="space-y-5 rounded-3xl bg-linear-to-bl from-brand to-brand-600 p-5 shadow-[var(--pc-shadow-card)]">
        {/* The block stays RTL so the figure sits under its label on the right;
            only the money itself is isolated left-to-right, which is what keeps
            the number before the symbol. */}
        <div className="text-start">
          <p className="text-xs text-white/75">الرصيد</p>
          <MoneyText
            value={user.balance}
            className="mt-1 text-4xl font-bold tracking-tight text-white"
          />
        </div>

        <TopUpSheet methods={methods as MethodOption[]} />
      </section>

      {pending.length > 0 && (
        <PendingTopUps
          requests={pending.map((request) => ({
            id: request.id,
            number: request.number,
            methodName: request.methodName,
            amount: request.amount,
            credited: request.credited,
            status: request.status,
            adminNote: request.adminNote,
            createdAt: formatDateTime(request.createdAt),
          }))}
        />
      )}

      {/* ── history ─────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-fg">سجل المعاملات</h2>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <EmptyTransactions />
            <p className="text-base font-semibold text-fg">لا توجد نتائج</p>
            <p className="max-w-[17rem] text-xs text-muted">
              لم تُسجَّل أي معاملة على محفظتك بعد — ستظهر هنا فور أول عملية شحن أو شراء
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {transactions.map((entry) => {
              const credit = entry.amount > 0;

              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-sm"
                >
                  {/* One type size throughout; weight and colour do the ranking,
                      and the colour of the figure already says which way the
                      money went — an arrow would only repeat it. */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-semibold text-fg">
                      {entry.description ?? TYPE_LABELS[entry.type]}
                    </p>
                    <p className="tnum truncate text-muted">
                      رقم الطلب - #{entry.number}
                    </p>
                    <p className="tnum truncate text-muted-2">
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </div>

                  <MoneyText
                    value={entry.amount}
                    sign
                    className={`shrink-0 font-bold ${
                      credit ? "text-success" : "text-danger"
                    }`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
