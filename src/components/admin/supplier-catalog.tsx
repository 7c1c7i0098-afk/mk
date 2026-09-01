"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare, Square } from "lucide-react";
import { AdminField, AdminToggle, inputClass } from "@/components/admin/ui";
import {
  PendingButton,
  StatusPill,
  SupplierActionForm,
} from "@/components/admin/supplier-ui";
import { importSelection, updateSelection } from "@/app/admin/suppliers/actions";
import { formatMoney } from "@/lib/money";
import { MARKUP_TYPE_LABELS } from "@/lib/suppliers/pricing";
import { AVAILABILITY_LABELS, PRODUCT_TYPE_LABELS } from "@/lib/suppliers/types";
import type { SupplierAvailability, SupplierProductType } from "@/generated/prisma/enums";

/**
 * The selection screen — the answer to "the API has 500 products and I want 20".
 *
 * Nothing here publishes anything on its own. Ticking rows builds a shortlist;
 * publishing is the explicit "استيراد ونشر" step below, with its own options
 * for where the products land and whether they go live immediately.
 */

export type CatalogRow = {
  id: string;
  externalProductId: string;
  externalVariantId: string;
  name: string;
  category: string | null;
  variantLabel: string | null;
  cost: number;
  currency: string;
  availability: SupplierAvailability;
  productType: SupplierProductType;
  /** Customer inputs this product needs at purchase time. */
  paramFieldCount: number;
  missing: boolean;
  isSelected: boolean;
  /** Set once the row is published — links to the local product. */
  mapped: { productId: string; productName: string; variantName: string } | null;
  /** What a customer would pay if imported now; null when unpriceable. */
  previewPrice: number | null;
};

const AVAILABILITY_TONE: Record<SupplierAvailability, "success" | "danger" | "warn"> = {
  AVAILABLE: "success",
  UNAVAILABLE: "danger",
  UNKNOWN: "warn",
};

export function SupplierCatalog({
  supplierId,
  rows,
  categories,
  products,
}: {
  supplierId: string;
  rows: CatalogRow[];
  categories: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // The profit rule for this batch: one selection can go in at a percentage and
  // the next at a flat amount.
  const [markupType, setMarkupType] = useState<string>("INHERIT");

  // Published rows cannot be re-imported, so they are never selectable.
  const selectable = useMemo(() => rows.filter((row) => !row.mapped), [rows]);
  const allChecked = selectable.length > 0 && selectable.every((row) => checked.has(row.id));

  function toggle(id: string) {
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setChecked(allChecked ? new Set() : new Set(selectable.map((row) => row.id)));
  }

  const ids = [...checked];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
        <button
          type="button"
          onClick={toggleAll}
          disabled={selectable.length === 0}
          className="tap flex items-center gap-1.5 text-xs font-semibold text-fg disabled:opacity-50"
        >
          {allChecked ? (
            <CheckSquare className="size-4 text-brand" />
          ) : (
            <Square className="size-4 text-muted" />
          )}
          تحديد كل المعروض ({selectable.length})
        </button>

        <span className="num text-xs text-muted">{ids.length} محدَّد</span>
      </div>

      {ids.length > 0 && (
        <section className="space-y-4 rounded-2xl border border-brand/40 bg-brand-soft p-4">
          <h2 className="text-sm font-bold text-fg">إجراءات على {ids.length} عنصراً</h2>

          {/* shortlist only — no publishing */}
          <div className="grid gap-2 sm:grid-cols-2">
            <SupplierActionForm action={updateSelection}>
              <HiddenIds supplierId={supplierId} ids={ids} />
              <input type="hidden" name="selected" value="true" />
              <PendingButton variant="ghost" className="py-2 text-xs">
                إضافة إلى القائمة المختارة
              </PendingButton>
            </SupplierActionForm>

            <SupplierActionForm action={updateSelection}>
              <HiddenIds supplierId={supplierId} ids={ids} />
              <input type="hidden" name="selected" value="false" />
              <PendingButton variant="ghost" className="py-2 text-xs">
                إزالة من القائمة المختارة
              </PendingButton>
            </SupplierActionForm>
          </div>

          {/* the publishing step */}
          <SupplierActionForm action={importSelection} className="space-y-3" onDone={() => setChecked(new Set())}>
            <HiddenIds supplierId={supplierId} ids={ids} />

            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField
                label="فئة المنتجات الجديدة"
                hint="تُستخدم فقط عند إنشاء منتج محلي جديد"
              >
                <select name="categoryId" className={inputClass} defaultValue="">
                  <option value="">— اختر الفئة —</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </AdminField>

              <AdminField
                label="أو أضِف إلى منتج موجود"
                hint="كل العناصر المحدَّدة ستصبح فئات سعرية داخله"
              >
                <select name="targetProductId" className={inputClass} defaultValue="">
                  <option value="">— إنشاء منتجات جديدة —</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </AdminField>

              <AdminField
                label="طريقة التسعير"
                hint="التلقائي يتتبّع تكلفة المزوّد؛ اليدوي يثبّت السعر ولا تغيّره المزامنة"
              >
                <select name="priceMode" className={inputClass} defaultValue="AUTO">
                  <option value="AUTO">تلقائي — تكلفة + ربح</option>
                  <option value="MANUAL">يدوي — سعر ثابت</option>
                </select>
              </AdminField>

              <AdminField
                label="ربح هذه الدفعة"
                hint="يُكتب على كل فئة سعرية تُنشأ الآن، ويغلب قواعد المنتج والمزوّد"
              >
                <select
                  name="markupType"
                  value={markupType}
                  onChange={(event) => setMarkupType(event.target.value)}
                  className={inputClass}
                >
                  <option value="INHERIT">وراثة قاعدة المزوّد</option>
                  <option value="PERCENT">{MARKUP_TYPE_LABELS.PERCENT}</option>
                  <option value="FIXED">{MARKUP_TYPE_LABELS.FIXED}</option>
                  <option value="NONE">{MARKUP_TYPE_LABELS.NONE}</option>
                </select>
              </AdminField>

              {(markupType === "PERCENT" || markupType === "FIXED") && (
                <AdminField
                  label={markupType === "PERCENT" ? "النسبة %" : "المبلغ (د.ل)"}
                >
                  <input
                    name="markupValue"
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    required
                    placeholder={markupType === "PERCENT" ? "15" : "2.50"}
                    className={`${inputClass} text-start`}
                  />
                </AdminField>
              )}

              <div className="flex items-end pb-2">
                <AdminToggle name="activate" label="نشر في المتجر مباشرة" defaultChecked />
              </div>
            </div>

            <PendingButton pendingLabel="جارٍ الاستيراد…" className="sm:w-auto sm:px-8">
              استيراد ونشر {ids.length} عنصراً
            </PendingButton>
          </SupplierActionForm>
        </section>
      )}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          لا توجد عناصر مطابقة — جرّب مزامنة الكتالوج أو تغيير البحث
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => {
            const isChecked = checked.has(row.id);

            return (
              <li
                key={row.id}
                className={`flex items-start gap-3 rounded-2xl border p-3 transition ${
                  isChecked ? "border-brand/50 bg-brand-soft" : "border-line bg-surface"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(row.id)}
                  disabled={Boolean(row.mapped)}
                  aria-label={isChecked ? "إلغاء التحديد" : "تحديد"}
                  className="tap mt-0.5 shrink-0 disabled:opacity-40"
                >
                  {isChecked ? (
                    <CheckSquare className="size-5 text-brand" />
                  ) : (
                    <Square className="size-5 text-muted" />
                  )}
                </button>

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-fg">{row.name}</span>
                    {row.isSelected && !row.mapped && (
                      <StatusPill tone="muted">مختار</StatusPill>
                    )}
                    {row.mapped && <StatusPill tone="success">منشور</StatusPill>}
                    {row.productType !== "GENERIC" && (
                      <StatusPill tone="muted">{PRODUCT_TYPE_LABELS[row.productType]}</StatusPill>
                    )}
                    {row.paramFieldCount > 0 && (
                      <StatusPill tone="warn">
                        {row.paramFieldCount} حقل مطلوب من العميل
                      </StatusPill>
                    )}
                    {row.missing ? (
                      <StatusPill tone="danger">مفقود</StatusPill>
                    ) : (
                      <StatusPill tone={AVAILABILITY_TONE[row.availability]}>
                        {AVAILABILITY_LABELS[row.availability]}
                      </StatusPill>
                    )}
                  </div>

                  <p className="text-[11px] text-muted">
                    {row.category ?? "بدون فئة"}
                    {row.variantLabel ? ` · ${row.variantLabel}` : ""}
                  </p>

                  <p dir="ltr" className="truncate text-start text-[10px] text-muted-2">
                    {row.externalProductId}
                    {row.externalVariantId ? ` / ${row.externalVariantId}` : ""}
                  </p>

                  {row.mapped && (
                    <Link
                      href={`/admin/products/${row.mapped.productId}`}
                      className="block truncate text-[11px] text-brand hover:underline"
                    >
                      {row.mapped.productName} — {row.mapped.variantName}
                    </Link>
                  )}
                </div>

                <div className="shrink-0 space-y-0.5 text-end">
                  <p dir="ltr" className="num text-xs text-muted">
                    {(row.cost / 100).toFixed(2)} {row.currency}
                  </p>
                  <p className="num text-xs font-semibold text-fg">
                    {row.previewPrice === null ? (
                      <span className="text-warn">بلا سعر</span>
                    ) : (
                      formatMoney(row.previewPrice)
                    )}
                  </p>
                  <p className="text-[10px] text-muted-2">سعر البيع المتوقّع</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function HiddenIds({ supplierId, ids }: { supplierId: string; ids: string[] }) {
  return (
    <>
      <input type="hidden" name="supplierId" value={supplierId} />
      {ids.map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
    </>
  );
}
