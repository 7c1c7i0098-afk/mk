import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { StatusPill } from "@/components/admin/supplier-ui";
import { DefaultMarkupForm, SupplierCreatePanel } from "@/components/admin/supplier-panels";
import { prisma } from "@/lib/db";
import { listAdapters } from "@/lib/suppliers/adapters";
import { getDefaultRule } from "@/lib/suppliers/service";
import { BASE_CURRENCY, MARKUP_TYPE_LABELS, formatMarkupBps } from "@/lib/suppliers/pricing";
import { formatMoney } from "@/lib/money";

/**
 * Suppliers overview — step one of the flow:
 *   المزوّدون → الإعدادات والاتصال → الكتالوج → اختيار العناصر →
 *   الربط بالمنتجات → التسعير → المعاينة → النشر
 *
 * Note what this page does *not* select: `secretCipher` never leaves the
 * database, so no supplier credential can reach a React payload from here.
 */
export default async function AdminSuppliersPage() {
  const [suppliers, defaultRule] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        adapter: true,
        baseUrl: true,
        currency: true,
        status: true,
        markupType: true,
        markupValue: true,
        lastTestOk: true,
        lastSyncAt: true,
        lastSyncOutcome: true,
        lastSyncMessage: true,
        _count: { select: { products: true, mappings: true } },
      },
    }),
    getDefaultRule(),
  ]);

  const adapters = listAdapters();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-bold text-fg">المزوّدون</h1>
          <p className="text-xs text-muted">
            اربط واجهات المنتجات الخارجية، ثم اختر ما تريد بيعه منها فقط
          </p>
        </div>
        <div className="ms-auto">
          <SupplierCreatePanel adapters={adapters} />
        </div>
      </div>

      {suppliers.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          لا يوجد مزوّدون بعد — أضف مزوّداً لبدء ربط كتالوج خارجي
        </p>
      ) : (
        <ul className="space-y-2">
          {suppliers.map((supplier) => (
            <li key={supplier.id}>
              <Link
                href={`/admin/suppliers/${supplier.id}`}
                className="tap flex items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 transition hover:border-brand/40"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-fg">{supplier.name}</span>
                    <StatusPill tone={supplier.status === "ACTIVE" ? "success" : "muted"}>
                      {supplier.status === "ACTIVE" ? "مفعّل" : "معطّل"}
                    </StatusPill>
                    {supplier.lastTestOk === false && (
                      <StatusPill tone="danger">فشل آخر اختبار</StatusPill>
                    )}
                    {supplier.lastSyncOutcome === "PARTIAL" && (
                      <StatusPill tone="warn">مزامنة جزئية</StatusPill>
                    )}
                  </div>

                  <p dir="ltr" className="truncate text-start text-[11px] text-muted-2">
                    {supplier.baseUrl}
                  </p>

                  <p className="num text-[11px] text-muted">
                    {supplier._count.products} عنصراً في الكتالوج ·{" "}
                    {supplier._count.mappings} مرتبطاً · {supplier.currency} ·{" "}
                    {supplier.markupType === "PERCENT"
                      ? `ربح ${formatMarkupBps(supplier.markupValue)}`
                      : supplier.markupType === "FIXED"
                        ? `ربح ${formatMoney(supplier.markupValue)}`
                        : MARKUP_TYPE_LABELS.NONE}
                  </p>

                  {supplier.lastSyncAt && (
                    <p className="truncate text-[11px] text-muted-2">
                      آخر مزامنة:{" "}
                      {new Intl.DateTimeFormat("ar-LY", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(supplier.lastSyncAt)}{" "}
                      — {supplier.lastSyncMessage ?? "—"}
                    </p>
                  )}
                </div>

                <ChevronLeft className="size-5 shrink-0 text-muted-2" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <h2 className="text-sm font-bold text-fg">قاعدة الربح الافتراضية</h2>
          <p className="text-[11px] text-muted-2">
            تُستخدم عندما لا توجد قاعدة للفئة السعرية ولا للمنتج ولا للمزوّد. الأولوية:
            السعر اليدوي للفئة ← قاعدة الفئة ← قاعدة المنتج ← قاعدة المزوّد ← القاعدة
            الافتراضية.
          </p>
        </div>

        <DefaultMarkupForm markupType={defaultRule.type} markupValue={defaultRule.value} />
      </section>

      <p className="text-[11px] text-muted-2">
        جميع الأسعار تُخزَّن بعملة المتجر ({BASE_CURRENCY}). عملة كل مزوّد وسعر صرفه
        يُضبطان في صفحته.
      </p>
    </div>
  );
}
