import Link from "next/link";
import { notFound } from "next/navigation";
import { SupplierOrders, type SupplierOrderRow } from "@/components/admin/supplier-orders";
import { StatusPill } from "@/components/admin/supplier-ui";
import { prisma } from "@/lib/db";
import { ENVIRONMENT_LABELS } from "@/lib/suppliers/types";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Every purchase attempted against one supplier.
 *
 * This is the reconciliation screen: it is where an admin sees that a line is
 * still open at the provider, that an attempt ended ambiguously, or that a
 * customer is owed money back — and it is the only place those are acted on.
 */

const PAGE_SIZE = 50;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
};

const STATUS_FILTERS = [
  { value: "", label: "الكل" },
  { value: "PROCESSING", label: "قيد التنفيذ" },
  { value: "NEEDS_REVIEW", label: "يحتاج مراجعة" },
  { value: "FAILED", label: "فشل" },
  { value: "COMPLETED", label: "مكتمل" },
  { value: "REFUNDED", label: "مسترجع" },
] as const;

export default async function SupplierOrdersPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: { id: true, name: true, environment: true, status: true },
  });
  if (!supplier) notFound();

  const status = query.status ?? "";
  const page = Math.max(1, Number(query.page) || 1);

  const where: Prisma.SupplierOrderWhereInput = {
    supplierId: id,
    ...(STATUS_FILTERS.some((filter) => filter.value === status && status !== "")
      ? { status: status as Prisma.SupplierOrderWhereInput["status"] }
      : {}),
  };

  const [orders, total, counts] = await Promise.all([
    prisma.supplierOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        status: true,
        productType: true,
        orderUuid: true,
        externalOrderId: true,
        externalStatus: true,
        externalProductId: true,
        quantity: true,
        attempts: true,
        cost: true,
        currency: true,
        lastError: true,
        refundedAt: true,
        createdAt: true,
        lastAttemptAt: true,
        orderItem: {
          select: {
            id: true,
            productName: true,
            variantName: true,
            total: true,
            deliveredCode: true,
            order: { select: { orderNumber: true } },
          },
        },
      },
    }),
    prisma.supplierOrder.count({ where }),
    prisma.supplierOrder.groupBy({
      by: ["status"],
      where: { supplierId: id },
      _count: true,
    }),
  ]);

  const dateFormat = new Intl.DateTimeFormat("ar-LY", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const rows: SupplierOrderRow[] = orders.map((order) => ({
    id: order.id,
    status: order.status,
    productType: order.productType,
    orderUuid: order.orderUuid,
    externalOrderId: order.externalOrderId,
    externalStatus: order.externalStatus,
    externalProductId: order.externalProductId,
    quantity: order.quantity,
    attempts: order.attempts,
    cost: order.cost,
    currency: order.currency,
    lastError: order.lastError,
    refunded: order.refundedAt !== null,
    createdAt: dateFormat.format(order.createdAt),
    lastAttemptAt: order.lastAttemptAt ? dateFormat.format(order.lastAttemptAt) : null,
    orderItem: order.orderItem
      ? {
          id: order.orderItem.id,
          productName: order.orderItem.productName,
          variantName: order.orderItem.variantName,
          total: order.orderItem.total,
          orderNumber: order.orderItem.order?.orderNumber ?? null,
          // Whether goods exist, never the goods themselves.
          delivered: order.orderItem.deliveredCode !== null,
        }
      : null,
  }));

  const needsReview = counts.find((row) => row.status === "NEEDS_REVIEW")?._count ?? 0;
  const processing = counts.find((row) => row.status === "PROCESSING")?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (status) search.set("status", status);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/admin/suppliers/${id}/orders${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/suppliers" className="text-xs text-muted hover:text-fg">
          المزوّدون
        </Link>
        <span className="text-xs text-muted-2">/</span>
        <Link href={`/admin/suppliers/${id}`} className="text-xs text-muted hover:text-fg">
          {supplier.name}
        </Link>
        <span className="text-xs text-muted-2">/</span>
        <h1 className="text-lg font-bold text-fg">طلبات المزوّد</h1>

        <div className="ms-auto flex items-center gap-2">
          <StatusPill tone={supplier.environment === "PRODUCTION" ? "danger" : "muted"}>
            {ENVIRONMENT_LABELS[supplier.environment]}
          </StatusPill>
          {needsReview > 0 && <StatusPill tone="danger">{needsReview} تحتاج مراجعة</StatusPill>}
          {processing > 0 && <StatusPill tone="warn">{processing} قيد التنفيذ</StatusPill>}
        </div>
      </div>

      <form className="flex flex-wrap gap-2">
        <select
          name="status"
          defaultValue={status}
          className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-brand/60"
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="tap h-11 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-fg"
        >
          تصفية
        </button>
        <span className="num self-center text-xs text-muted">{total} عملية</span>
      </form>

      <SupplierOrders supplierId={id} rows={rows} />

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="ترقيم الصفحات">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
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
              href={pageHref(page + 1)}
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
