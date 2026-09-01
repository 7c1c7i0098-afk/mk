"use client";

import { useActionState, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import {
  AdminField,
  AdminToggle,
  inputClass,
  textareaClass,
} from "@/components/admin/ui";
import {
  PendingButton,
  StatusPill,
  SupplierActionForm,
  SupplierButtonForm,
} from "@/components/admin/supplier-ui";
import {
  deletePaymentMethod,
  movePaymentMethod,
  savePaymentMethod,
  seedDefaultMethods,
  togglePaymentMethod,
} from "@/app/admin/wallet/actions";
import { ImageUpload } from "@/components/admin/image-upload";
import { Thumb } from "@/components/ui/thumb";
import { formatMoney, fromMinor } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  formatExchangeRate,
  formatFeeBps,
} from "@/lib/wallet/fees";
import type { PaymentMethodKind } from "@/generated/prisma/enums";

/**
 * The rails offered in the customer's top-up sheet.
 *
 * Order matters here — it is the order customers see — so it is editable
 * directly rather than through a number field nobody would maintain.
 */

export type MethodRow = {
  id: string;
  name: string;
  kind: PaymentMethodKind;
  description: string | null;
  instructions: string | null;
  logo: string | null;
  exchangeRate: number | null;
  feeBps: number;
  feeFixed: number;
  minAmount: number | null;
  maxAmount: number | null;
  sortOrder: number;
  isActive: boolean;
  pendingCount: number;
};

const KINDS: PaymentMethodKind[] = [
  "BANK_CARD",
  "EDFALI",
  "MASARIF_PAY",
  "YUSR_PAY",
  "BANK_TRANSFER",
  "CRYPTO",
  "OTHER",
];

export function PaymentMethods({ methods }: { methods: MethodRow[] }) {
  const [editing, setEditing] = useState<MethodRow | null>(null);
  const [creating, setCreating] = useState(false);
  const showForm = creating || editing !== null;

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-sm font-bold text-fg">طرق الشحن</h2>
          <p className="text-[11px] text-muted-2">
            تظهر للعميل في نافذة شحن المحفظة بالترتيب أدناه
          </p>
        </div>

        {!showForm && (
          <div className="ms-auto flex items-center gap-2">
            {methods.length === 0 && (
              <div className="w-44">
                <SupplierButtonForm
                  action={seedDefaultMethods}
                  fields={{}}
                  label={
                    <>
                      <Sparkles className="size-3.5" />
                      إضافة الطرق الشائعة
                    </>
                  }
                  className="py-2 text-xs"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="tap flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              <Plus className="size-4" />
              طريقة جديدة
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <SupplierActionForm
          key={editing?.id ?? "new"}
          action={savePaymentMethod}
          className="space-y-3 rounded-xl border border-line bg-ink p-3"
          onDone={() => {
            setEditing(null);
            setCreating(false);
          }}
        >
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold text-fg">
              {editing ? `تعديل ${editing.name}` : "طريقة شحن جديدة"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
              aria-label="إغلاق"
              className="tap ms-auto grid size-8 place-items-center rounded-lg border border-line text-muted hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="الاسم">
              <input
                name="name"
                defaultValue={editing?.name ?? ""}
                required
                placeholder="مصرفي باي"
                className={inputClass}
              />
            </AdminField>

            <AdminField label="النوع" hint="يحدّد الأيقونة في نافذة العميل">
              <select
                name="kind"
                defaultValue={editing?.kind ?? "OTHER"}
                className={inputClass}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {PAYMENT_METHOD_LABELS[kind]}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>

          <ImageUpload
            name="logo"
            kind="methods"
            initialPath={editing?.logo}
            label="شعار الطريقة"
          />

          <AdminField
            label="سعر الصرف"
            hint="للعملات الرقمية فقط — يظهر بجانب الاسم للعميل. اتركه فارغاً للطرق بالدينار"
          >
            <input
              name="exchangeRate"
              type="number"
              step="0.000001"
              min="0"
              dir="ltr"
              defaultValue={formatExchangeRate(editing?.exchangeRate)}
              placeholder="8.1"
              className={`${inputClass} text-start`}
            />
          </AdminField>

          <AdminField label="وصف مختصر" hint="سطر واحد تحت الاسم">
            <input
              name="description"
              defaultValue={editing?.description ?? ""}
              placeholder="تحويل عبر تطبيق مصرفي باي"
              className={inputClass}
            />
          </AdminField>

          <AdminField
            label="تعليمات الدفع"
            hint="تظهر للعميل بعد اختيار الطريقة — رقم الحساب أو الخطوات"
          >
            <textarea
              name="instructions"
              rows={3}
              defaultValue={editing?.instructions ?? ""}
              placeholder={"حوّل المبلغ إلى الحساب:\n0123456789\nثم أرسل رقم العملية"}
              className={textareaClass}
            />
          </AdminField>

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminField label="رسوم نسبية %" hint="0 يعني بلا رسوم نسبية">
              <input
                name="feePercent"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={editing ? editing.feeBps / 100 : 0}
                className={`${inputClass} text-start`}
              />
            </AdminField>

            <AdminField label="رسوم ثابتة (د.ل)">
              <input
                name="feeFixed"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={editing ? fromMinor(editing.feeFixed) : 0}
                className={`${inputClass} text-start`}
              />
            </AdminField>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <AdminField label="أقل مبلغ (د.ل)" hint="اتركه فارغاً بلا حد">
              <input
                name="minAmount"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={editing?.minAmount ? fromMinor(editing.minAmount) : ""}
                className={`${inputClass} text-start`}
              />
            </AdminField>

            <AdminField label="أعلى مبلغ (د.ل)" hint="اتركه فارغاً بلا حد">
              <input
                name="maxAmount"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={editing?.maxAmount ? fromMinor(editing.maxAmount) : ""}
                className={`${inputClass} text-start`}
              />
            </AdminField>

            <div className="flex items-end pb-2">
              <AdminToggle
                name="isActive"
                label="مفعّلة"
                defaultChecked={editing?.isActive ?? false}
              />
            </div>
          </div>

          <input type="hidden" name="sortOrder" value={editing?.sortOrder ?? methods.length} />

          <PendingButton pendingLabel="جارٍ الحفظ…" className="sm:w-auto sm:px-8">
            {editing ? "حفظ التعديلات" : "إضافة الطريقة"}
          </PendingButton>
        </SupplierActionForm>
      )}

      {methods.length === 0 ? (
        <p className="rounded-xl border border-line bg-ink px-4 py-8 text-center text-sm text-muted">
          لا توجد طرق شحن — أضف واحدة أو استخدم الطرق الشائعة
        </p>
      ) : (
        <ul className="space-y-2">
          {methods.map((method, index) => (
            <li
              key={method.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-ink p-3"
            >
              <div className="flex shrink-0 flex-col gap-1">
                <ReorderButton id={method.id} direction="up" disabled={index === 0} />
                <ReorderButton
                  id={method.id}
                  direction="down"
                  disabled={index === methods.length - 1}
                />
              </div>

              <Thumb
                src={method.logo}
                alt={method.name}
                sizes="40px"
                rounded="rounded-lg"
                className="size-10 shrink-0"
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-fg">{method.name}</span>
                  {method.exchangeRate ? (
                    <StatusPill tone="muted">
                      الصرف {formatExchangeRate(method.exchangeRate)}
                    </StatusPill>
                  ) : null}
                  <StatusPill tone="muted">{PAYMENT_METHOD_LABELS[method.kind]}</StatusPill>
                  {method.pendingCount > 0 && (
                    <StatusPill tone="warn">{method.pendingCount} قيد المراجعة</StatusPill>
                  )}
                </div>
                {method.description && (
                  <p className="truncate text-xs text-muted">{method.description}</p>
                )}
                <p className="num text-[11px] text-muted-2">
                  {method.feeBps > 0 || method.feeFixed > 0
                    ? `رسوم ${method.feeBps > 0 ? formatFeeBps(method.feeBps) : ""}${
                        method.feeBps > 0 && method.feeFixed > 0 ? " + " : ""
                      }${method.feeFixed > 0 ? formatMoney(method.feeFixed) : ""}`
                    : "بلا رسوم"}
                  {method.minAmount ? ` · من ${formatMoney(method.minAmount)}` : ""}
                  {method.maxAmount ? ` · إلى ${formatMoney(method.maxAmount)}` : ""}
                  {!method.instructions ? " · بلا تعليمات دفع" : ""}
                </p>
              </div>

              <div className="w-24 shrink-0">
                <SupplierButtonForm
                  action={togglePaymentMethod}
                  fields={{ id: method.id }}
                  label={method.isActive ? "مفعّلة" : "معطّلة"}
                  className={`py-1.5 text-[11px] ${
                    method.isActive
                      ? "border-success/40 bg-success/10 text-success"
                      : ""
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setEditing(method);
                }}
                aria-label={`تعديل ${method.name}`}
                className="tap grid size-9 shrink-0 place-items-center rounded-lg border border-line text-muted hover:text-fg"
              >
                <Pencil className="size-4" />
              </button>

              <div className="w-24 shrink-0">
                <SupplierButtonForm
                  action={deletePaymentMethod}
                  fields={{ id: method.id }}
                  variant="danger"
                  confirm={`حذف طريقة "${method.name}"؟ السجلات السابقة تبقى كما هي.`}
                  label={
                    <>
                      <Trash2 className="size-3.5" />
                      حذف
                    </>
                  }
                  className="py-1.5 text-[11px]"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReorderButton({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <span className="grid size-6 place-items-center rounded border border-line/50 text-muted-2 opacity-40">
        {direction === "up" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </span>
    );
  }

  // useActionState absorbs the action's return value; a bare form action is
  // required to resolve to void.
  const [, formAction] = useActionState(movePaymentMethod, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        aria-label={direction === "up" ? "أعلى" : "أسفل"}
        className="tap grid size-6 place-items-center rounded border border-line text-muted hover:text-fg"
      >
        {direction === "up" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>
    </form>
  );
}
