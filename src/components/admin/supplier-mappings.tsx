"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Unlink } from "lucide-react";
import {
  PendingButton,
  StatusPill,
  SupplierActionForm,
  SupplierButtonForm,
} from "@/components/admin/supplier-ui";
import { AdminField, inputClass } from "@/components/admin/ui";
import {
  makePreferred,
  saveVariantPricing,
  toggleMapping,
  unlinkMapping,
} from "@/app/admin/suppliers/actions";
import { formatMoney, fromMinor } from "@/lib/money";
import {
  MARKUP_TYPE_LABELS,
  RULE_SOURCE_LABELS,
  type RuleSource,
} from "@/lib/suppliers/pricing";
import { AVAILABILITY_LABELS } from "@/lib/suppliers/types";
import type { MarkupType, PriceMode, SupplierAvailability } from "@/generated/prisma/enums";

/**
 * Published items for one supplier, each with the price preview that explains
 * it: supplier cost → converted cost → applied rule → customer price.
 *
 * Everything on this screen is admin-only by construction — cost, markup and
 * external ids appear nowhere in a customer-facing query.
 */

export type MappingRow = {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  isPreferred: boolean;
  isEnabled: boolean;
  /** How many suppliers this variant can be bought from. */
  supplierCount: number;
  externalProductId: string;
  externalVariantId: string;
  supplierCost: number;
  supplierCurrency: string;
  availability: SupplierAvailability;
  missing: boolean;
  /** Cost in store currency; null when no exchange rate is configured. */
  baseCost: number | null;
  finalPrice: number;
  storedPrice: number;
  manual: boolean;
  ruleLabel: string;
  ruleSource: RuleSource;
  priceIssue: string | null;
  /** The variant's own rule, if it carries one — the narrowest level. */
  variantMarkupType: MarkupType | null;
  variantMarkupValue: number | null;
  priceMode: PriceMode;
};

const AVAILABILITY_TONE: Record<SupplierAvailability, "success" | "danger" | "warn"> = {
  AVAILABLE: "success",
  UNAVAILABLE: "danger",
  UNKNOWN: "warn",
};

export function SupplierMappings({ rows }: { rows: MappingRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
        لا توجد عناصر منشورة من هذا المزوّد — افتح الكتالوج واختر ما تريد بيعه
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.id} className="space-y-3 rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/products/${row.productId}`}
              className="truncate text-sm font-semibold text-fg hover:text-brand"
            >
              {row.productName}
            </Link>
            <span className="truncate text-xs text-muted">{row.variantName}</span>

            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              {row.isPreferred ? (
                <StatusPill tone="success">المزوّد المعتمد</StatusPill>
              ) : (
                <StatusPill tone="muted">بديل</StatusPill>
              )}
              {!row.isEnabled && <StatusPill tone="muted">موقوف</StatusPill>}
              {row.missing ? (
                <StatusPill tone="danger">مفقود من الكتالوج</StatusPill>
              ) : (
                <StatusPill tone={AVAILABILITY_TONE[row.availability]}>
                  {AVAILABILITY_LABELS[row.availability]}
                </StatusPill>
              )}
              {row.supplierCount > 1 && (
                <StatusPill tone="muted">{row.supplierCount} مزوّدين</StatusPill>
              )}
            </div>
          </div>

          {/* price preview — cost, rule, customer price */}
          <div className="grid gap-2 rounded-xl border border-line bg-ink p-3 sm:grid-cols-4">
            <Fact label="تكلفة المزوّد">
              <span dir="ltr" className="num">
                {(row.supplierCost / 100).toFixed(2)} {row.supplierCurrency}
              </span>
            </Fact>
            <Fact label="التكلفة بالدينار">
              {row.baseCost === null ? (
                <span className="text-warn">—</span>
              ) : (
                <span className="num">{formatMoney(row.baseCost)}</span>
              )}
            </Fact>
            <Fact label={RULE_SOURCE_LABELS[row.ruleSource]}>
              <span className="num">{row.ruleLabel}</span>
            </Fact>
            <Fact label="سعر البيع">
              <span className="num font-semibold text-fg">{formatMoney(row.storedPrice)}</span>
              {row.manual ? (
                <span className="ms-1 text-[10px] text-muted-2">يدوي</span>
              ) : row.finalPrice !== row.storedPrice ? (
                <span className="ms-1 text-[10px] text-warn">
                  ← {formatMoney(row.finalPrice)}
                </span>
              ) : null}
            </Fact>
          </div>

          {row.priceIssue && (
            <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] text-warn">
              {row.priceIssue}
            </p>
          )}

          <p dir="ltr" className="truncate text-start text-[10px] text-muted-2">
            {row.externalProductId}
            {row.externalVariantId ? ` / ${row.externalVariantId}` : ""}
          </p>

          <VariantMarkup row={row} />

          <div className="flex flex-wrap gap-2">
            {!row.isPreferred && (
              <div className="w-40">
                <SupplierButtonForm
                  action={makePreferred}
                  fields={{ id: row.id }}
                  label={
                    <>
                      <Star className="size-3.5" />
                      اعتماد هذا المزوّد
                    </>
                  }
                  className="py-2 text-xs"
                />
              </div>
            )}

            <div className="w-32">
              <SupplierButtonForm
                action={toggleMapping}
                fields={{ id: row.id }}
                label={row.isEnabled ? "إيقاف الربط" : "تفعيل الربط"}
                className="py-2 text-xs"
              />
            </div>

            <div className="w-32">
              <SupplierButtonForm
                action={unlinkMapping}
                fields={{ id: row.id }}
                variant="danger"
                confirm={`إلغاء ربط "${row.variantName}" بهذا المزوّد؟ المنتج المحلي وسعره يبقيان كما هما.`}
                label={
                  <>
                    <Unlink className="size-3.5" />
                    إلغاء الربط
                  </>
                }
                className="py-2 text-xs"
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
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

/**
 * The profit rule for one denomination, editable where the admin is already
 * looking at its cost and its price.
 *
 * It writes the *variant* rule — the narrowest level in the chain — so one item
 * can sell at a percentage while the one beside it sells at a flat amount,
 * without either disturbing the supplier's own default.
 */
function VariantMarkup({ row }: { row: MappingRow }) {
  const [type, setType] = useState<string>(row.variantMarkupType ?? "INHERIT");
  const [mode, setMode] = useState<PriceMode>(row.priceMode);

  return (
    <SupplierActionForm
      action={saveVariantPricing}
      className="rounded-xl border border-line bg-ink p-3"
    >
      <input type="hidden" name="variantId" value={row.variantId} />

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <AdminField label="التسعير">
          <select
            name="priceMode"
            value={mode}
            onChange={(event) => setMode(event.target.value as PriceMode)}
            className={inputClass}
          >
            <option value="AUTO">تلقائي</option>
            <option value="MANUAL">يدوي</option>
          </select>
        </AdminField>

        <AdminField label="نوع الربح">
          <select
            name="markupType"
            value={type}
            onChange={(event) => setType(event.target.value)}
            disabled={mode === "MANUAL"}
            className={inputClass}
          >
            <option value="INHERIT">وراثة</option>
            <option value="PERCENT">{MARKUP_TYPE_LABELS.PERCENT}</option>
            <option value="FIXED">{MARKUP_TYPE_LABELS.FIXED}</option>
            <option value="NONE">{MARKUP_TYPE_LABELS.NONE}</option>
          </select>
        </AdminField>

        {type === "PERCENT" || type === "FIXED" ? (
          <AdminField label={type === "PERCENT" ? "النسبة %" : "المبلغ (د.ل)"}>
            <input
              name="markupValue"
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              disabled={mode === "MANUAL"}
              defaultValue={
                row.variantMarkupType === "PERCENT"
                  ? (row.variantMarkupValue ?? 0) / 100
                  : row.variantMarkupType === "FIXED"
                    ? fromMinor(row.variantMarkupValue ?? 0)
                    : ""
              }
              className={`${inputClass} text-start`}
            />
          </AdminField>
        ) : (
          <div />
        )}

        <PendingButton variant="ghost" pendingLabel="…" className="py-2.5 text-xs sm:px-5">
          حفظ الربح
        </PendingButton>
      </div>
    </SupplierActionForm>
  );
}
