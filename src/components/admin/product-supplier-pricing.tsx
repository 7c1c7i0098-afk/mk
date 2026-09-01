"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminField, inputClass } from "@/components/admin/ui";
import {
  PendingButton,
  StatusPill,
  SupplierActionForm,
  SupplierButtonForm,
} from "@/components/admin/supplier-ui";
import { makePreferred, saveProductMarkup, saveVariantPricing } from "@/app/admin/suppliers/actions";
import { formatMoney, fromMinor } from "@/lib/money";
import {
  MARKUP_TYPE_LABELS,
  RULE_SOURCE_LABELS,
  formatMarkupBps,
  type RuleSource,
} from "@/lib/suppliers/pricing";
import { AVAILABILITY_LABELS } from "@/lib/suppliers/types";
import type { MarkupType, PriceMode, SupplierAvailability } from "@/generated/prisma/enums";

/**
 * Pricing for supplier-backed denominations, shown on the product screen where
 * the admin is already working.
 *
 * The two narrowest levels of the precedence chain live here — the product rule
 * and the variant rule — alongside the switch that matters most: MANUAL freezes
 * a price against every future sync, AUTO lets supplier costs flow through.
 */

export type VariantPricing = {
  id: string;
  name: string;
  price: number;
  priceMode: PriceMode;
  markupType: MarkupType | null;
  markupValue: number | null;
  ruleSource: RuleSource;
  ruleLabel: string;
  baseCost: number | null;
  computedPrice: number;
  priceIssue: string | null;
  suppliers: {
    mappingId: string;
    supplierId: string;
    supplierName: string;
    cost: number;
    currency: string;
    availability: SupplierAvailability;
    isPreferred: boolean;
    isEnabled: boolean;
  }[];
};

const MARKUP_OPTIONS: { value: string; label: string }[] = [
  { value: "INHERIT", label: "وراثة القاعدة الأعلى" },
  { value: "PERCENT", label: MARKUP_TYPE_LABELS.PERCENT },
  { value: "FIXED", label: MARKUP_TYPE_LABELS.FIXED },
  { value: "NONE", label: MARKUP_TYPE_LABELS.NONE },
];

const AVAILABILITY_TONE: Record<SupplierAvailability, "success" | "danger" | "warn"> = {
  AVAILABLE: "success",
  UNAVAILABLE: "danger",
  UNKNOWN: "warn",
};

export function ProductSupplierPricing({
  productId,
  markupType,
  markupValue,
  variants,
}: {
  productId: string;
  markupType: MarkupType | null;
  markupValue: number | null;
  variants: VariantPricing[];
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div>
        <h2 className="text-sm font-bold text-fg">التسعير من المزوّدين</h2>
        <p className="text-[11px] text-muted-2">
          الأولوية: السعر اليدوي للفئة ← قاعدة الفئة ← قاعدة المنتج ← قاعدة المزوّد ←
          القاعدة الافتراضية
        </p>
      </div>

      <MarkupRow
        action={saveProductMarkup}
        hiddenName="productId"
        hiddenValue={productId}
        label="قاعدة ربح هذا المنتج"
        markupType={markupType}
        markupValue={markupValue}
      />

      {variants.length === 0 ? (
        <p className="rounded-xl border border-line bg-ink px-3 py-4 text-center text-xs text-muted">
          لا توجد فئات سعرية مرتبطة بمزوّد في هذا المنتج
        </p>
      ) : (
        <ul className="space-y-3">
          {variants.map((variant) => (
            <VariantCard key={variant.id} variant={variant} />
          ))}
        </ul>
      )}
    </section>
  );
}

function VariantCard({ variant }: { variant: VariantPricing }) {
  const [mode, setMode] = useState<PriceMode>(variant.priceMode);
  const [type, setType] = useState<string>(variant.markupType ?? "INHERIT");

  return (
    <li className="space-y-3 rounded-xl border border-line bg-ink p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="truncate text-sm font-semibold text-fg">{variant.name}</span>
        <StatusPill tone={variant.priceMode === "MANUAL" ? "muted" : "success"}>
          {variant.priceMode === "MANUAL" ? "سعر يدوي" : "سعر تلقائي"}
        </StatusPill>
        <span className="num ms-auto text-sm font-semibold text-fg">
          {formatMoney(variant.price)}
        </span>
      </div>

      {/* suppliers behind this denomination */}
      <ul className="space-y-1.5">
        {variant.suppliers.map((supplier) => (
          <li
            key={supplier.mappingId}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2"
          >
            <Link
              href={`/admin/suppliers/${supplier.supplierId}`}
              className="truncate text-xs font-semibold text-fg hover:text-brand"
            >
              {supplier.supplierName}
            </Link>
            <span dir="ltr" className="num text-[11px] text-muted">
              {(supplier.cost / 100).toFixed(2)} {supplier.currency}
            </span>
            <StatusPill tone={AVAILABILITY_TONE[supplier.availability]}>
              {AVAILABILITY_LABELS[supplier.availability]}
            </StatusPill>
            {!supplier.isEnabled && <StatusPill tone="muted">موقوف</StatusPill>}

            <div className="ms-auto">
              {supplier.isPreferred ? (
                <StatusPill tone="success">معتمد</StatusPill>
              ) : (
                <div className="w-28">
                  <SupplierButtonForm
                    action={makePreferred}
                    fields={{ id: supplier.mappingId }}
                    label="اعتماده"
                    className="py-1.5 text-[11px]"
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* price preview */}
      <div className="grid gap-2 rounded-lg border border-line bg-surface p-2.5 sm:grid-cols-3">
        <Fact label="التكلفة بالدينار">
          {variant.baseCost === null ? (
            <span className="text-warn">—</span>
          ) : (
            <span className="num">{formatMoney(variant.baseCost)}</span>
          )}
        </Fact>
        <Fact label={RULE_SOURCE_LABELS[variant.ruleSource]}>
          <span className="num">{variant.ruleLabel}</span>
        </Fact>
        <Fact label="السعر المحتسب">
          <span className="num">{formatMoney(variant.computedPrice)}</span>
          {variant.priceMode === "MANUAL" && variant.computedPrice !== variant.price && (
            <span className="ms-1 text-[10px] text-muted-2">(غير مطبَّق — السعر يدوي)</span>
          )}
        </Fact>
      </div>

      {variant.priceIssue && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] text-warn">
          {variant.priceIssue}
        </p>
      )}

      <SupplierActionForm action={saveVariantPricing} className="space-y-3">
        <input type="hidden" name="variantId" value={variant.id} />

        <div className="grid gap-3 sm:grid-cols-3">
          <AdminField label="طريقة التسعير">
            <select
              name="priceMode"
              value={mode}
              onChange={(event) => setMode(event.target.value as PriceMode)}
              className={inputClass}
            >
              <option value="AUTO">تلقائي — يتتبّع تكلفة المزوّد</option>
              <option value="MANUAL">يدوي — لا تغيّره المزامنة</option>
            </select>
          </AdminField>

          <AdminField label="قاعدة ربح الفئة">
            <select
              name="markupType"
              value={type}
              onChange={(event) => setType(event.target.value)}
              disabled={mode === "MANUAL"}
              className={inputClass}
            >
              {MARKUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </AdminField>

          {type !== "INHERIT" && type !== "NONE" && (
            <AdminField label={type === "PERCENT" ? "النسبة %" : "المبلغ (د.ل)"}>
              <input
                name="markupValue"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                disabled={mode === "MANUAL"}
                defaultValue={
                  variant.markupType === "PERCENT"
                    ? (variant.markupValue ?? 0) / 100
                    : variant.markupType === "FIXED"
                      ? fromMinor(variant.markupValue ?? 0)
                      : ""
                }
                className={`${inputClass} text-start`}
              />
            </AdminField>
          )}
        </div>

        <PendingButton variant="ghost" pendingLabel="جارٍ الحفظ…" className="sm:w-auto sm:px-6">
          حفظ تسعير الفئة
        </PendingButton>
      </SupplierActionForm>
    </li>
  );
}

/** The product-level rule, and the shared shape the variant form echoes. */
function MarkupRow({
  action,
  hiddenName,
  hiddenValue,
  label,
  markupType,
  markupValue,
}: {
  action: typeof saveProductMarkup;
  hiddenName: string;
  hiddenValue: string;
  label: string;
  markupType: MarkupType | null;
  markupValue: number | null;
}) {
  const [type, setType] = useState<string>(markupType ?? "INHERIT");

  return (
    <SupplierActionForm action={action} className="space-y-3 rounded-xl border border-line bg-ink p-3">
      <input type="hidden" name={hiddenName} value={hiddenValue} />

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <AdminField label={label}>
          <select
            name="markupType"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className={inputClass}
          >
            {MARKUP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </AdminField>

        {type === "INHERIT" || type === "NONE" ? (
          <div />
        ) : (
          <AdminField label={type === "PERCENT" ? "النسبة %" : "المبلغ (د.ل)"}>
            <input
              name="markupValue"
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              defaultValue={
                markupType === "PERCENT"
                  ? (markupValue ?? 0) / 100
                  : markupType === "FIXED"
                    ? fromMinor(markupValue ?? 0)
                    : ""
              }
              className={`${inputClass} text-start`}
            />
          </AdminField>
        )}

        <PendingButton variant="ghost" pendingLabel="جارٍ الحفظ…" className="sm:w-auto sm:px-6">
          حفظ
        </PendingButton>
      </div>

      <p className="text-[11px] text-muted-2">
        القاعدة الحالية:{" "}
        {markupType === "PERCENT"
          ? formatMarkupBps(markupValue ?? 0)
          : markupType === "FIXED"
            ? formatMoney(markupValue ?? 0)
            : markupType === "NONE"
              ? MARKUP_TYPE_LABELS.NONE
              : "وراثة القاعدة الأعلى"}
      </p>
    </SupplierActionForm>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-2">{label}</p>
      <p className="text-xs text-fg">{children}</p>
    </div>
  );
}
