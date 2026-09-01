"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { AdminField, inputClass } from "@/components/admin/ui";
import { PendingButton, SupplierActionForm } from "@/components/admin/supplier-ui";
import { SupplierForm, type AdapterOption } from "@/components/admin/supplier-form";
import { saveDefaultMarkup } from "@/app/admin/suppliers/actions";
import { fromMinor } from "@/lib/money";
import { MARKUP_TYPE_LABELS } from "@/lib/suppliers/pricing";
import type { MarkupType } from "@/generated/prisma/enums";

/** "Add supplier" — collapsed until asked for, so the list stays the subject. */
export function SupplierCreatePanel({ adapters }: { adapters: AdapterOption[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
      >
        <Plus className="size-4" />
        مزوّد جديد
      </button>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-fg">مزوّد جديد</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="إغلاق"
          className="tap ms-auto grid size-8 place-items-center rounded-lg border border-line text-muted hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </div>

      <SupplierForm adapters={adapters} onDone={() => setOpen(false)} />
    </section>
  );
}

/**
 * The store-wide fallback markup — the last level of the precedence chain, and
 * the one that applies to a supplier item with no rule of its own anywhere.
 */
export function DefaultMarkupForm({
  markupType,
  markupValue,
}: {
  markupType: MarkupType;
  markupValue: number;
}) {
  const [type, setType] = useState<MarkupType>(markupType);

  return (
    <SupplierActionForm action={saveDefaultMarkup} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <AdminField label="نوع الربح الافتراضي">
          <select
            name="markupType"
            value={type}
            onChange={(event) => setType(event.target.value as MarkupType)}
            className={inputClass}
          >
            {(["PERCENT", "FIXED", "NONE"] as MarkupType[]).map((option) => (
              <option key={option} value={option}>
                {MARKUP_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </AdminField>

        {type === "NONE" ? (
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
                markupType === "PERCENT" ? markupValue / 100 : fromMinor(markupValue)
              }
              className={`${inputClass} text-start`}
            />
          </AdminField>
        )}

        <PendingButton variant="ghost" pendingLabel="جارٍ الحفظ…" className="sm:w-auto sm:px-6">
          حفظ
        </PendingButton>
      </div>
    </SupplierActionForm>
  );
}
