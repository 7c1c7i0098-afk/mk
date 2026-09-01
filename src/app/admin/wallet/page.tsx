import Link from "next/link";
import { PaymentMethods, type MethodRow } from "@/components/admin/payment-methods";
import { TopUpReview, type TopUpRow } from "@/components/admin/topup-review";
import { StatusPill } from "@/components/admin/supplier-ui";
import { prisma } from "@/lib/db";
import { formatCompact } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Wallet administration.
 *
 * Two jobs on one screen because they are the same job: deciding how money can
 * come in, and deciding whether a particular claim to have sent some is true.
 */

type PageProps = { searchParams: Promise<{ status?: string }> };

const STATUS_FILTERS = [
  { value: "PENDING", label: "قيد المراجعة" },
  { value: "APPROVED", label: "معتمد" },
  { value: "REJECTED", label: "مرفوض" },
  { value: "CANCELLED", label: "ملغى" },
  { value: "", label: "الكل" },
] as const;

export default async function AdminWalletPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const status = query.status ?? "PENDING";

  const where: Prisma.TopUpRequestWhereInput = STATUS_FILTERS.some(
    (filter) => filter.value === status && status !== "",
  )
    ? { status: status as Prisma.TopUpRequestWhereInput["status"] }
    : {};

  const [methods, pendingByMethod, requests, counts, totals] = await Promise.all([
    prisma.paymentMethod.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        logo: true,
        exchangeRate: true,
        description: true,
        instructions: true,
        feeBps: true,
        feeFixed: true,
        minAmount: true,
        maxAmount: true,
        sortOrder: true,
        isActive: true,
      },
    }),
    prisma.topUpRequest.groupBy({
      by: ["methodId"],
      where: { status: "PENDING" },
      _count: true,
    }),
    prisma.topUpRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        number: true,
        methodName: true,
        amount: true,
        fee: true,
        credited: true,
        status: true,
        reference: true,
        note: true,
        adminNote: true,
        createdAt: true,
        reviewedAt: true,
        user: { select: { name: true, email: true, publicId: true } },
        reviewer: { select: { name: true } },
      },
    }),
    prisma.topUpRequest.groupBy({ by: ["status"], _count: true }),
    prisma.topUpRequest.aggregate({
      where: { status: "APPROVED" },
      _sum: { credited: true },
    }),
  ]);

  const pendingMap = new Map(pendingByMethod.map((row) => [row.methodId, row._count]));

  const methodRows: MethodRow[] = methods.map((method) => ({
    ...method,
    pendingCount: pendingMap.get(method.id) ?? 0,
  }));

  const requestRows: TopUpRow[] = requests.map((request) => ({
    id: request.id,
    number: request.number,
    userName: request.user.name,
    userEmail: request.user.email,
    userPublicId: request.user.publicId,
    methodName: request.methodName,
    amount: request.amount,
    fee: request.fee,
    credited: request.credited,
    status: request.status,
    reference: request.reference,
    note: request.note,
    adminNote: request.adminNote,
    createdAt: formatCompact(request.createdAt),
    reviewedAt: request.reviewedAt ? formatCompact(request.reviewedAt) : null,
    reviewerName: request.reviewer?.name ?? null,
  }));

  const pendingTotal = counts.find((row) => row.status === "PENDING")?._count ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold text-fg">المحفظة</h1>
        {pendingTotal > 0 && (
          <StatusPill tone="warn">{pendingTotal} طلب بانتظار المراجعة</StatusPill>
        )}
        <Link
          href="/admin/transactions"
          className="tap ms-auto rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-fg hover:border-brand/40"
        >
          سجل العمليات
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="طلبات قيد المراجعة" value={String(pendingTotal)} />
        <Stat
          label="إجمالي المشحون"
          value={formatMoney(totals._sum.credited ?? 0)}
        />
        <Stat
          label="طرق مفعّلة"
          value={`${methods.filter((method) => method.isActive).length} / ${methods.length}`}
        />
      </div>

      <PaymentMethods methods={methodRows} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold text-fg">طلبات الشحن</h2>
          <div className="ms-auto flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <Link
                key={filter.value || "all"}
                href={filter.value ? `/admin/wallet?status=${filter.value}` : "/admin/wallet?status="}
                className={`tap rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition ${
                  status === filter.value
                    ? "border-brand/40 bg-brand-soft text-brand"
                    : "border-line bg-surface text-muted hover:text-fg"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        </div>

        <TopUpReview requests={requestRows} />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-[11px] text-muted-2">{label}</p>
      <p className="num mt-1 text-lg font-bold text-fg">{value}</p>
    </div>
  );
}
