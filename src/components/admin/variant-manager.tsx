"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { deleteVariant, saveVariant } from "@/app/admin/actions";
import {
  ActionForm,
  AdminField,
  AdminToggle,
  ConfirmForm,
  SubmitButton,
  inputClass,
  textareaClass,
} from "@/components/admin/ui";
import { formatMoney, fromMinor } from "@/lib/money";

type Variant = {
  id: string;
  name: string;
  value: string | null;
  price: number;
  stock: number;
  sortOrder: number;
  isActive: boolean;
  description: string | null;
  usageInstructions: string | null;
  rechargeInstructions: string | null;
  redemptionInstructions: string | null;
  helpLink: string | null;
};

/** Denominations under one product — UC 60, $10, … */
export function VariantManager({
  productId,
  variants,
}: {
  productId: string;
  variants: Variant[];
}) {
  const [editing, setEditing] = useState<Variant | null>(null);
  const [creating, setCreating] = useState(false);
  const showForm = creating || editing !== null;

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold text-fg">الفئات السعرية</h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="tap ms-auto flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg hover:border-brand/40"
          >
            <Plus className="size-3.5" />
            إضافة فئة
          </button>
        )}
      </div>

      {showForm && (
        <ActionForm
          key={editing?.id ?? "new"}
          action={saveVariant}
          className="space-y-3 rounded-xl border border-line bg-ink p-3"
          onDone={() => {
            setEditing(null);
            setCreating(false);
          }}
        >
          <input type="hidden" name="productId" value={productId} />
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AdminField label="الاسم">
              <input
                name="name"
                defaultValue={editing?.name ?? ""}
                required
                placeholder="بطاقة 10 دولار"
                className={inputClass}
              />
            </AdminField>

            <AdminField label="القيمة المعروضة" hint="مثل ‎$10 أو 60 UC">
              <input
                name="value"
                dir="ltr"
                defaultValue={editing?.value ?? ""}
                className={inputClass}
              />
            </AdminField>

            <AdminField label="السعر (د.ل)">
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={editing ? fromMinor(editing.price) : ""}
                required
                className={inputClass}
              />
            </AdminField>

            <AdminField label="المخزون">
              <input
                name="stock"
                type="number"
                min="0"
                dir="ltr"
                defaultValue={editing?.stock ?? 100}
                className={inputClass}
              />
            </AdminField>

            <AdminField label="ترتيب العرض">
              <input
                name="sortOrder"
                type="number"
                dir="ltr"
                defaultValue={editing?.sortOrder ?? 0}
                className={inputClass}
              />
            </AdminField>

            <div className="flex items-end pb-3">
              <AdminToggle
                name="isActive"
                label="مفعّلة"
                defaultChecked={editing?.isActive ?? true}
              />
            </div>
          </div>

          {/* Overrides — left blank, the denomination inherits the product's
              own description and instructions instead of duplicating them. */}
          <details className="rounded-xl border border-line bg-ink p-3">
            <summary className="cursor-pointer text-xs font-semibold text-fg">
              تخصيص الوصف والتعليمات لهذه الفئة (اختياري)
            </summary>

            <div className="mt-3 space-y-3">
              <p className="text-[11px] leading-relaxed text-muted">
                اترك أي حقل فارغاً لاستخدام نص المنتج الأصلي.
              </p>

              <AdminField label="الوصف">
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editing?.description ?? ""}
                  className={textareaClass}
                />
              </AdminField>

              <AdminField label="طريقة الاستخدام">
                <textarea
                  name="usageInstructions"
                  rows={3}
                  defaultValue={editing?.usageInstructions ?? ""}
                  className={textareaClass}
                />
              </AdminField>

              <AdminField label="طريقة الشحن">
                <textarea
                  name="rechargeInstructions"
                  rows={3}
                  defaultValue={editing?.rechargeInstructions ?? ""}
                  className={textareaClass}
                />
              </AdminField>

              <AdminField label="طريقة التفعيل والاسترداد">
                <textarea
                  name="redemptionInstructions"
                  rows={3}
                  defaultValue={editing?.redemptionInstructions ?? ""}
                  className={textareaClass}
                />
              </AdminField>

              <AdminField label="رابط المساعدة / الاسترداد">
                <input
                  name="helpLink"
                  type="url"
                  dir="ltr"
                  placeholder="https://"
                  defaultValue={editing?.helpLink ?? ""}
                  className={inputClass}
                />
              </AdminField>
            </div>
          </details>

          <div className="flex gap-2">
            <SubmitButton>حفظ</SubmitButton>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
              className="tap rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-fg"
            >
              إلغاء
            </button>
          </div>
        </ActionForm>
      )}

      {variants.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">لا توجد فئات سعرية بعد</p>
      ) : (
        <ul className="divide-y divide-line">
          {variants.map((variant) => (
            <li key={variant.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">{variant.name}</p>
                <p className="num truncate text-xs text-muted">
                  {variant.value ?? "—"} · مخزون {variant.stock}
                </p>
              </div>

              <span className="num text-sm font-bold text-brand">
                {formatMoney(variant.price)}
              </span>

              {!variant.isActive && (
                <span className="rounded-lg border border-line px-2 py-1 text-[10px] text-muted">
                  معطّلة
                </span>
              )}

              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(variant);
                }}
                className="tap rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-muted hover:text-fg"
              >
                تعديل
              </button>

              <ConfirmForm
                action={deleteVariant}
                id={variant.id}
                message={`حذف "${variant.name}"؟`}
              >
                <button
                  type="submit"
                  aria-label={`حذف ${variant.name}`}
                  className="tap grid size-8 place-items-center rounded-lg border border-line text-muted hover:border-danger/40 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </ConfirmForm>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
