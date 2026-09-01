"use client";

import Link from "next/link";
import { RefreshCw, RotateCcw, Undo2 } from "lucide-react";
import { StatusPill, SupplierButtonForm } from "@/components/admin/supplier-ui";
import { fulfilItem, refreshOrderStatus, refundItem } from "@/app/admin/suppliers/actions";
import { formatMoney } from "@/lib/money";
import { PRODUCT_TYPE_LABELS } from "@/lib/suppliers/types";
import type { SupplierOrderStatus, SupplierProductType } from "@/generated/prisma/enums";

/**
 * Supplier purchases, and the three controls that are safe to offer an admin.
 *
 * Which controls appear is decided by status, not by convenience:
 *
 *   • **Retry** only from FAILED — a state that means "the supplier refused and
 *     said so". It is never offered for PROCESSING or NEEDS_REVIEW, where a
 *     purchase may already exist and a second attempt could double-charge.
 *   • **Refresh** for anything still open, because asking is always safe.
 *   • **Refund** only where money could be owed back, and never after a
 *     completed delivery.
 */

export type SupplierOrderRow = {
  id: string;
  status: SupplierOrderStatus;
  productType: SupplierProductType;
  orderUuid: string;
  externalOrderId: string | null;
  externalStatus: string | null;
  externalProductId: string;
  quantity: number;
  attempts: number;
  cost: number | null;
  currency: string | null;
  lastError: string | null;
  refunded: boolean;
  createdAt: string;
  lastAttemptAt: string | null;
  /** The PLUS CARD line this fulfils, when there is one. */
  orderItem: {
    id: string;
    productName: string;
    variantName: string;
    total: number;
    orderNumber: string | null;
    delivered: boolean;
  } | null;
};

const STATUS_LABELS: Record<SupplierOrderStatus, string> = {
  PENDING: "بانتظار التنفيذ",
  PROCESSING: "قيد التنفيذ لدى المزوّد",
  COMPLETED: "مكتمل",
  FAILED: "فشل",
  NEEDS_REVIEW: "يحتاج مراجعة",
  REFUNDED: "مسترجع",
};

const STATUS_TONE: Record<SupplierOrderStatus, "success" | "danger" | "warn" | "muted"> = {
  PENDING: "muted",
  PROCESSING: "warn",
  COMPLETED: "success",
  FAILED: "danger",
  NEEDS_REVIEW: "danger",
  REFUNDED: "muted",
};

export function SupplierOrders({
  supplierId,
  rows,
}: {
  supplierId: string;
  rows: SupplierOrderRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
        لا توجد عمليات شراء من هذا المزوّد بعد
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const canRetry = row.status === "FAILED";
        const canRefresh = row.status === "PROCESSING" || row.status === "NEEDS_REVIEW";
        const canRefund =
          !row.refunded &&
          (row.status === "FAILED" || row.status === "NEEDS_REVIEW") &&
          row.orderItem !== null;

        return (
          <li key={row.id} className="space-y-3 rounded-2xl border border-line bg-surface p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-fg">
                {row.orderItem
                  ? `${row.orderItem.productName} — ${row.orderItem.variantName}`
                  : row.externalProductId}
              </span>
              <StatusPill tone={STATUS_TONE[row.status]}>{STATUS_LABELS[row.status]}</StatusPill>
              <StatusPill tone="muted">{PRODUCT_TYPE_LABELS[row.productType]}</StatusPill>
              {row.attempts > 1 && (
                <StatusPill tone="warn">{row.attempts} محاولات</StatusPill>
              )}
              {row.orderItem?.delivered && <StatusPill tone="success">سُلِّم للعميل</StatusPill>}
            </div>

            <div className="grid gap-2 rounded-xl border border-line bg-ink p-3 sm:grid-cols-4">
              <Fact label="طلب PLUS CARD">
                {row.orderItem?.orderNumber ? (
                  <span className="num">{row.orderItem.orderNumber}</span>
                ) : (
                  <span className="text-muted-2">—</span>
                )}
              </Fact>
              <Fact label="رقم المزوّد">
                <span dir="ltr" className="num block truncate text-start">
                  {row.externalOrderId ?? "—"}
                </span>
              </Fact>
              <Fact label="حالة المزوّد">
                <span dir="ltr" className="block truncate text-start">
                  {row.externalStatus ?? "—"}
                </span>
              </Fact>
              <Fact label="التكلفة">
                {row.cost === null ? (
                  <span className="text-muted-2">—</span>
                ) : (
                  <span dir="ltr" className="num">
                    {(row.cost / 100).toFixed(2)} {row.currency ?? ""}
                  </span>
                )}
              </Fact>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-2">
              <span dir="ltr" className="num">
                uuid {row.orderUuid.slice(0, 8)}…
              </span>
              <span className="num">أُنشئ {row.createdAt}</span>
              {row.lastAttemptAt && <span className="num">آخر محاولة {row.lastAttemptAt}</span>}
              {row.orderItem && (
                <span className="num">سعر العميل {formatMoney(row.orderItem.total)}</span>
              )}
            </div>

            {row.lastError && (
              <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
                {row.lastError}
              </p>
            )}

            {row.status === "NEEDS_REVIEW" && (
              <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] text-warn">
                لم تتأكّد نتيجة هذه العملية لدى المزوّد. حدّث الحالة أو تحقّق من حساب المزوّد
                قبل أي إجراء — إعادة المحاولة معطّلة هنا عمداً لتفادي شراء مكرّر.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {canRefresh && (
                <div className="w-40">
                  <SupplierButtonForm
                    action={refreshOrderStatus}
                    fields={{ id: row.id, supplierId }}
                    pendingLabel="جارٍ التحديث…"
                    label={
                      <>
                        <RefreshCw className="size-3.5" />
                        تحديث الحالة
                      </>
                    }
                    className="py-2 text-xs"
                  />
                </div>
              )}

              {canRetry && row.orderItem && (
                <div className="w-40">
                  <SupplierButtonForm
                    action={fulfilItem}
                    fields={{ orderItemId: row.orderItem.id, supplierId }}
                    pendingLabel="جارٍ الشراء…"
                    confirm="إعادة المحاولة ترسل طلب شراء جديد بنفس المعرّف. متابعة؟"
                    label={
                      <>
                        <RotateCcw className="size-3.5" />
                        إعادة المحاولة
                      </>
                    }
                    className="py-2 text-xs"
                  />
                </div>
              )}

              {canRefund && (
                <div className="w-40">
                  <SupplierButtonForm
                    action={refundItem}
                    fields={{ id: row.id, supplierId }}
                    variant="danger"
                    confirm="إرجاع قيمة هذا البند إلى محفظة العميل؟"
                    label={
                      <>
                        <Undo2 className="size-3.5" />
                        استرجاع للعميل
                      </>
                    }
                    className="py-2 text-xs"
                  />
                </div>
              )}

              {row.orderItem && (
                <Link
                  href="/admin/orders"
                  className="tap flex items-center rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-fg hover:border-brand/40"
                >
                  الطلبات
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] text-muted-2">{label}</p>
      <div className="min-w-0 text-xs text-fg">{children}</div>
    </div>
  );
}
