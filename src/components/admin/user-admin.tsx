"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { adjustUserBalance, clearUserDiscount, setUserDiscount } from "@/app/admin/actions";
import {
  ActionForm,
  AdminField,
  ConfirmForm,
  SubmitButton,
  inputClass,
} from "@/components/admin/ui";
import { formatMoney, fromMinor, toMinor } from "@/lib/money";
import { MAX_DISCOUNT_BPS, discountedPrice, formatBps } from "@/lib/pricing";
import type { AdminActionType } from "@/generated/prisma/enums";

export type AdminUserDetail = {
  id: string;
  publicId: string | null;
  name: string;
  email: string;
  balance: number;
  discountBps: number;
  status: "ACTIVE" | "SUSPENDED";
  role: "USER" | "ADMIN";
  createdAt: string;
  discounts: { id: string; percentBps: number; productId: string; productName: string }[];
};

export type AuditEntry = {
  id: string;
  type: AdminActionType;
  amount: number | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  discountBeforeBps: number | null;
  discountAfterBps: number | null;
  productName: string | null;
  note: string | null;
  createdAt: string;
  adminName: string | null;
};

const TYPE_LABEL: Record<AdminActionType, string> = {
  BALANCE_CREDIT: "إضافة رصيد",
  BALANCE_DEBIT: "خصم رصيد",
  DISCOUNT_SET: "تعديل خصم",
  DISCOUNT_CLEAR: "إلغاء خصم",
  TOPUP_APPROVED: "اعتماد شحن",
  TOPUP_REJECTED: "رفض شحن",
};

export function UserAdmin({
  user,
  audit,
  products,
}: {
  user: AdminUserDetail;
  audit: AuditEntry[];
  products: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-4">
      <UserSummary user={user} />
      <BalancePanel user={user} />
      <DiscountPanel user={user} products={products} />
      <AuditPanel audit={audit} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-fg">{children}</span>
    </div>
  );
}

function UserSummary({ user }: { user: AdminUserDetail }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="divide-y divide-line">
        <Row label="معرّف المستخدم">
          <span dir="ltr" className="num block truncate font-bold tracking-widest text-brand">
            {user.publicId ?? "—"}
          </span>
        </Row>
        <Row label="الاسم">{user.name}</Row>
        <Row label="البريد الإلكتروني">
          <span dir="ltr" className="block truncate">
            {user.email}
          </span>
        </Row>
        <Row label="الرصيد الحالي">
          <span className="num font-bold text-brand">{formatMoney(user.balance)}</span>
        </Row>
        <Row label="حالة الحساب">
          {user.status === "ACTIVE" ? (
            <span className="rounded-lg border border-success/40 bg-success/10 px-2 py-1 text-[11px] font-semibold text-success">
              نشط
            </span>
          ) : (
            <span className="rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] font-semibold text-danger">
              موقوف
            </span>
          )}
        </Row>
        <Row label="تاريخ إنشاء الحساب">
          <span className="num">{user.createdAt}</span>
        </Row>
      </div>
    </section>
  );
}

/**
 * Add / deduct, with the resulting balance shown before anything is submitted
 * and a confirmation step in front of the write. The server repeats every one
 * of these checks — this panel is convenience, not enforcement.
 */
function BalancePanel({ user }: { user: AdminUserDetail }) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");

  const minor = toMinor(amount || "0");
  const valid = minor > 0;
  const projected = direction === "credit" ? user.balance + minor : user.balance - minor;
  const wouldGoNegative = direction === "debit" && projected < 0;
  const blocked = !valid || wouldGoNegative;

  const confirmMessage = valid
    ? `${direction === "credit" ? "إضافة" : "خصم"} ${fromMinor(minor)} د.ل — الرصيد سيصبح ${fromMinor(projected)} د.ل. متابعة؟`
    : "";

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold text-fg">إدارة الرصيد</h2>

      <ActionForm
        action={adjustUserBalance}
        className="space-y-3"
        onDone={() => setAmount("")}
      >
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="direction" value={direction} />

        <div className="grid grid-cols-2 gap-2">
          {(["credit", "debit"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDirection(option)}
              className={
                direction === option
                  ? "tap rounded-xl border border-brand/50 bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand"
                  : "tap rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm font-semibold text-muted hover:text-fg"
              }
            >
              {option === "credit" ? "إضافة رصيد" : "خصم رصيد"}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="المبلغ (د.ل)">
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClass}
            />
          </AdminField>

          <AdminField label="ملاحظة" hint="اختياري — تُحفظ في السجل">
            <input name="note" className={inputClass} />
          </AdminField>
        </div>

        <div className="space-y-1 rounded-xl border border-line bg-ink p-3 text-xs">
          <div className="flex justify-between">
            <span className="text-muted">الرصيد الحالي</span>
            <span className="num font-semibold text-fg">{formatMoney(user.balance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">الرصيد بعد العملية</span>
            <span className={wouldGoNegative ? "num font-bold text-danger" : "num font-bold text-brand"}>
              {valid ? formatMoney(projected) : "—"}
            </span>
          </div>
        </div>

        {wouldGoNegative && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            لا يمكن أن يصبح الرصيد بالسالب — المتاح {formatMoney(user.balance)}
          </p>
        )}

        <div
          onClickCapture={(event) => {
            const submit = (event.target as HTMLElement).closest("button[type=submit]");
            if (!submit) return;
            if (blocked || !window.confirm(confirmMessage)) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <SubmitButton className={blocked ? "opacity-50" : undefined}>
            تنفيذ العملية
          </SubmitButton>
        </div>
      </ActionForm>
    </section>
  );
}

function DiscountPanel({
  user,
  products,
}: {
  user: AdminUserDetail;
  products: { id: string; name: string }[];
}) {
  const [percent, setPercent] = useState("");

  // A concrete example, so the admin sees the price the customer will pay.
  const SAMPLE = 1000; // 10.00 د.ل in minor units
  const bps = Math.min(Math.max(Math.round(Number(percent || 0) * 100), 0), MAX_DISCOUNT_BPS);

  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold text-fg">الخصم الخاص</h2>

      <ActionForm action={setUserDiscount} className="space-y-3" onDone={() => setPercent("")}>
        <input type="hidden" name="userId" value={user.id} />

        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="نسبة الخصم %" hint={`بين 0 و ${MAX_DISCOUNT_BPS / 100}`}>
            <input
              name="percent"
              type="number"
              step="0.01"
              min="0"
              max={MAX_DISCOUNT_BPS / 100}
              dir="ltr"
              required
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              className={inputClass}
            />
          </AdminField>

          <AdminField label="النطاق" hint="خصم على منتج يلغي الخصم العام لذلك المنتج">
            <select name="productId" defaultValue="" className={inputClass}>
              <option value="">كل المنتجات</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </AdminField>
        </div>

        <p className="rounded-xl border border-line bg-ink px-3 py-2 text-xs text-muted">
          مثال: منتج بـ <span className="num">{formatMoney(SAMPLE)}</span> يصبح{" "}
          <span className="num font-bold text-brand">
            {formatMoney(discountedPrice(SAMPLE, bps))}
          </span>
        </p>

        <SubmitButton>حفظ الخصم</SubmitButton>
      </ActionForm>

      <div className="divide-y divide-line border-t border-line pt-1">
        <DiscountRow
          id={`global:${user.id}`}
          label="كل المنتجات"
          bps={user.discountBps}
          removable={user.discountBps > 0}
        />
        {user.discounts.map((discount) => (
          <DiscountRow
            key={discount.id}
            id={discount.id}
            label={discount.productName}
            bps={discount.percentBps}
            removable
          />
        ))}
      </div>
    </section>
  );
}

function DiscountRow({
  id,
  label,
  bps,
  removable,
}: {
  id: string;
  label: string;
  bps: number;
  removable: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="min-w-0 flex-1 truncate text-sm text-fg">{label}</span>
      <span className={bps > 0 ? "num text-sm font-bold text-brand" : "num text-sm text-muted-2"}>
        {formatBps(bps)}
      </span>
      {removable && (
        <ConfirmForm action={clearUserDiscount} id={id} message={`إلغاء الخصم على "${label}"؟`}>
          <button
            type="submit"
            aria-label={`إلغاء الخصم على ${label}`}
            className="tap grid size-8 place-items-center rounded-lg border border-line text-muted hover:border-danger/40 hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </ConfirmForm>
      )}
    </div>
  );
}

function AuditPanel({ audit }: { audit: AuditEntry[] }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-sm font-bold text-fg">سجل العمليات</h2>

      {audit.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">لا توجد عمليات بعد</p>
      ) : (
        <ul className="divide-y divide-line">
          {audit.map((entry) => (
            <li key={entry.id} className="space-y-1 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-fg">{TYPE_LABEL[entry.type]}</span>
                {entry.amount !== null && (
                  <span
                    className={
                      entry.amount > 0
                        ? "num text-sm font-bold text-success"
                        : "num text-sm font-bold text-danger"
                    }
                  >
                    {formatMoney(entry.amount, { sign: true })}
                  </span>
                )}
                <span className="num ms-auto shrink-0 text-[11px] text-muted-2">
                  {entry.createdAt}
                </span>
              </div>

              {entry.balanceBefore !== null && entry.balanceAfter !== null && (
                <p className="num text-xs text-muted">
                  {formatMoney(entry.balanceBefore)} ← {formatMoney(entry.balanceAfter)}
                </p>
              )}

              {entry.discountBeforeBps !== null && entry.discountAfterBps !== null && (
                <p className="text-xs text-muted">
                  <span className="num">{formatBps(entry.discountBeforeBps)}</span> ←{" "}
                  <span className="num">{formatBps(entry.discountAfterBps)}</span>
                  {entry.productName ? ` · ${entry.productName}` : " · كل المنتجات"}
                </p>
              )}

              {entry.note && <p className="text-xs text-muted-2">{entry.note}</p>}

              <p className="text-[11px] text-muted-2">نفّذها: {entry.adminName ?? "—"}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
