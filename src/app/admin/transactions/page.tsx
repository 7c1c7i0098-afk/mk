import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";
import type { TransactionType } from "@/generated/prisma/enums";

/**
 * The whole ledger, filterable.
 *
 * Append-only by construction — nothing in the app updates or deletes a
 * transaction — so this page is a window onto history, never an editor of it.
 */

const PAGE_SIZE = 60;

const TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: "إيداع",
  PURCHASE: "شراء",
  REFUND: "استرجاع",
  ADJUSTMENT: "تعديل",
  TRANSFER: "تحويل",
};

const TYPE_FILTERS = [
  { value: "", label: "الكل" },
  { value: "DEPOSIT", label: "إيداع" },
  { value: "PURCHASE", label: "شراء" },
  { value: "REFUND", label: "استرجاع" },
  { value: "ADJUSTMENT", label: "تعديل" },
  { value: "TRANSFER", label: "تحويل" },
] as const;

type PageProps = {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
};

export default async function AdminTransactionsPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const term = query.q?.trim() ?? "";
  const type = query.type ?? "";
  const page = Math.max(1, Number(query.page) || 1);

  const where: Prisma.TransactionWhereInput = {
    ...(TYPE_FILTERS.some((filter) => filter.value === type && type !== "")
      ? { type: type as TransactionType }
      : {}),
    ...(term
      ? {
          OR: [
            { description: { contains: term } },
            { user: { name: { contains: term } } },
            { user: { email: { contains: term } } },
            { user: { publicId: { contains: term } } },
            { order: { orderNumber: { contains: term } } },
          ],
        }
      : {}),
  };

  const [transactions, total, sums] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
        user: { select: { name: true, email: true, publicId: true } },
        admin: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
    }),
    prisma.transaction.count({ where }),
    prisma.transaction.groupBy({ by: ["type"], _sum: { amount: true } }),
  ]);

  const credited = sums
    .filter((row) => (row._sum.amount ?? 0) > 0)
    .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);
  const debited = sums
    .filter((row) => (row._sum.amount ?? 0) < 0)
    .reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);

  const dateFormat = new Intl.DateTimeFormat("ar-LY", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function hrefFor(nextPage: number) {
    const search = new URLSearchParams();
    if (term) search.set("q", term);
    if (type) search.set("type", type);
    if (nextPage > 1) search.set("page", String(nextPage));
    const suffix = search.toString();
    return `/admin/transactions${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold text-fg">سجل العمليات</h1>
        <Link
          href="/admin/wallet"
          className="tap ms-auto rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-fg hover:border-brand/40"
        >
          إدارة المحفظة
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="إجمالي الإضافات" value={formatMoney(credited)} tone="success" />
        <Stat label="إجمالي الخصومات" value={formatMoney(Math.abs(debited))} tone="danger" />
        <Stat label="عدد العمليات" value={String(total)} />
      </div>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          name="q"
          defaultValue={term}
          placeholder="ابحث بالاسم أو البريد أو رقم الحساب أو رقم الطلب…"
          className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg outline-none focus:border-brand/60"
        />
        <select
          name="type"
          defaultValue={type}
          className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-brand/60"
        >
          {TYPE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="tap h-11 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-fg"
        >
          بحث
        </button>
      </form>

      {transactions.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          لا توجد نتائج
        </p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((entry) => {
            const credit = entry.amount > 0;

            return (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-xl border ${
                    credit
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-danger/40 bg-danger/10 text-danger"
                  }`}
                >
                  {credit ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-semibold text-fg">
                    {entry.user.name}
                    {entry.user.publicId && (
                      <span className="num ms-1.5 text-[11px] font-normal text-muted-2">
                        #{entry.user.publicId}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {TYPE_LABELS[entry.type]}
                    {entry.description ? ` · ${entry.description}` : ""}
                    {entry.admin ? ` · بواسطة ${entry.admin.name}` : ""}
                  </p>
                  <p className="num text-[11px] text-muted-2">
                    {dateFormat.format(entry.createdAt)}
                    {entry.order ? ` · ${entry.order.orderNumber}` : ""}
                  </p>
                </div>

                <div className="shrink-0 text-end">
                  <p
                    className={`num text-sm font-bold ${
                      credit ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatMoney(entry.amount, { sign: true })}
                  </p>
                  <p className="num text-[10px] text-muted-2">
                    {formatMoney(entry.balanceAfter)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="ترقيم الصفحات">
          {page > 1 && (
            <Link
              href={hrefFor(page - 1)}
              className="tap rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg"
            >
              السابق
            </Link>
          )}
          <span className="num text-xs text-muted">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link
              href={hrefFor(page + 1)}
              className="tap rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg"
            >
              التالي
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[11px] text-muted-2">{label}</p>
      <p
        className={`num mt-1 text-lg font-bold ${
          tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-fg"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
