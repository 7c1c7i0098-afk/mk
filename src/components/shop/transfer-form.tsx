"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { sendBalance, type TransferState } from "@/app/(shop)/account/transfer/actions";
import { MoneyText } from "@/components/shop/money-text";
import { CURRENCY_SYMBOL, fromMinor } from "@/lib/money";

/**
 * Sending balance to another customer by their account id.
 *
 * The id is uppercased as it is typed because that is how it is printed
 * everywhere else — reading one off a screen and typing it back in should not
 * depend on the caps lock key.
 */
export function TransferForm({ balance }: { balance: number }) {
  const [state, formAction] = useActionState<TransferState, FormData>(sendBalance, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
        <span className="text-sm text-muted">الرصيد المتاح</span>
        <MoneyText value={balance} className="text-base font-bold text-brand" />
      </div>

      {state.error && (
        <p className="flex items-start gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      {state.ok && state.message && (
        <p className="flex items-start gap-2 rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      )}

      <label className="block space-y-1.5">
        <span className="block text-sm font-semibold text-fg">معرّف حساب المستلم</span>
        <input
          name="recipient"
          required
          dir="ltr"
          autoComplete="off"
          inputMode="text"
          placeholder="646A2P77"
          onInput={(event) => {
            event.currentTarget.value = event.currentTarget.value.toUpperCase();
          }}
          className="num h-12 w-full rounded-2xl border border-line bg-surface px-4 text-start text-base tracking-widest text-fg outline-none transition placeholder:text-muted placeholder:tracking-normal focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
        />
        <span className="block text-xs text-muted">
          يجده المستلم في صفحة حسابه تحت «معرّف الحساب».
        </span>
      </label>

      <label className="block space-y-1.5">
        {/* The unit lives in the label, not floating inside the field: a number
            input renders its digits left-to-right whatever the page direction,
            and a pinned symbol ends up sitting on top of them. */}
        <span className="block text-sm font-semibold text-fg">
          المبلغ <span className="font-normal text-muted">({CURRENCY_SYMBOL})</span>
        </span>
        <div>
          <input
            name="amount"
            required
            type="number"
            step="0.01"
            min={fromMinor(100)}
            max={fromMinor(balance)}
            inputMode="decimal"
            placeholder="0.00"
            className="num h-12 w-full rounded-2xl border border-line bg-surface px-4 text-start text-base text-fg outline-none transition placeholder:text-muted focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
          />
        </div>
      </label>

      <label className="block space-y-1.5">
        <span className="block text-sm font-semibold text-fg">
          ملاحظة <span className="font-normal text-muted-2">(اختياري)</span>
        </span>
        <input
          name="note"
          maxLength={140}
          autoComplete="off"
          placeholder="مثلاً: قيمة الكرت"
          className="h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-fg outline-none transition placeholder:text-muted focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
        />
      </label>

      <SubmitButton disabled={balance <= 0} />

      <p className="text-center text-xs leading-relaxed text-muted-2">
        التحويل فوري ولا يمكن التراجع عنه. تأكّد من المعرّف قبل الإرسال.
      </p>
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="tap w-full rounded-2xl bg-brand py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
    >
      {pending ? "جارٍ التحويل…" : disabled ? "لا يوجد رصيد للتحويل" : "تحويل الرصيد"}
    </button>
  );
}
