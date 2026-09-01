"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  Banknote,
  Bitcoin,
  Building2,
  CheckCircle2,
  CreditCard,
  Plus,
  Smartphone,
  X,
} from "lucide-react";
import { requestTopUp, type WalletState } from "@/app/(shop)/wallet/actions";
import { MoneyText } from "@/components/shop/money-text";
import { formatMoney, toMinor } from "@/lib/money";
import { formatExchangeRate, formatFeeBps, quoteTopUp } from "@/lib/wallet/fees";
import { cn } from "@/lib/utils";
import type { PaymentMethodKind } from "@/generated/prisma/enums";

/**
 * The top-up sheet.
 *
 * It rises from the bottom because that is where a thumb is, and it asks for one
 * decision at a time: choose a rail, then say how much. Choosing is a radio
 * rather than a jump, so a mis-tap costs nothing — nothing happens until
 * "المتابعة" is pressed, and that button stays disabled until a rail is picked.
 *
 * The fee shown while typing comes from the same function the server uses to
 * freeze the fee onto the request, so the customer is never quoted one number
 * and charged another.
 */

export type MethodOption = {
  id: string;
  name: string;
  kind: PaymentMethodKind;
  logo: string | null;
  description: string | null;
  instructions: string | null;
  feeBps: number;
  feeFixed: number;
  exchangeRate: number | null;
  minAmount: number | null;
  maxAmount: number | null;
};

const KIND_ICONS: Record<PaymentMethodKind, typeof CreditCard> = {
  BANK_CARD: CreditCard,
  EDFALI: Smartphone,
  MASARIF_PAY: Smartphone,
  YUSR_PAY: Smartphone,
  BANK_TRANSFER: Building2,
  CRYPTO: Bitcoin,
  OTHER: Banknote,
};

export function TopUpSheet({ methods }: { methods: MethodOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<MethodOption | null>(null);
  const [amount, setAmount] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  const [state, formAction] = useActionState(
    async (previous: WalletState, form: FormData) => {
      const result = await requestTopUp(previous, form);
      if (result.ok) router.refresh();
      return result;
    },
    {},
  );

  // Escape closes; the page behind stops scrolling while the sheet is up.
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setOpen(false);
    setChosenId(null);
    setConfirmed(null);
    setAmount("");
  }

  const quote = confirmed
    ? quoteTopUp(toMinor(amount || "0"), {
        feeBps: confirmed.feeBps,
        feeFixed: confirmed.feeFixed,
      })
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={methods.length === 0}
        className="tap flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
      >
        <Plus className="size-4.5" />
        شحن المحفظة
      </button>

      {methods.length === 0 && (
        <p className="text-center text-[11px] text-muted-2">
          لا توجد طرق شحن مفعّلة حالياً — تواصل مع الإدارة
        </p>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <button
            type="button"
            aria-label="إغلاق"
            onClick={close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="شحن المحفظة"
            className="relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl border border-line bg-ink-2 shadow-[var(--pc-shadow-pop)]"
          >
            {/* drag handle + title */}
            <div className="shrink-0 rounded-t-3xl bg-ink-2 pt-2.5">
              <div className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
              <div className="flex items-center gap-3 px-5 py-3">
                <h2 className="text-base font-bold text-fg">
                  {confirmed ? confirmed.name : "الشحن بواسطة"}
                </h2>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label="إغلاق"
                  className="tap ms-auto grid size-9 place-items-center rounded-xl border border-line bg-surface text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {state.ok ? (
              <div className="space-y-4 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4 text-center">
                <CheckCircle2 className="mx-auto size-12 text-success" />
                <p className="text-sm font-semibold text-fg">{state.message}</p>
                <button
                  type="button"
                  onClick={close}
                  className="tap w-full rounded-xl bg-brand py-3.5 text-sm font-bold text-white hover:bg-brand-600"
                >
                  تمام
                </button>
              </div>
            ) : !confirmed ? (
              <>
                {/* the rails, chosen by radio */}
                <ul
                  role="radiogroup"
                  aria-label="طرق الشحن"
                  className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-3"
                >
                  {methods.map((method) => {
                    const Icon = KIND_ICONS[method.kind];
                    const picked = chosenId === method.id;
                    const hasFee = method.feeBps > 0 || method.feeFixed > 0;

                    return (
                      <li key={method.id}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={picked}
                          onClick={() => setChosenId(method.id)}
                          className={cn(
                            "tap flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start transition",
                            picked
                              ? "border-brand bg-brand-soft"
                              : "border-line bg-surface hover:border-brand/40",
                          )}
                        >
                          {/* logo, or the icon its kind implies */}
                          <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface-2 text-brand">
                            {method.logo ? (
                              <Image
                                src={method.logo}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-contain p-1.5"
                              />
                            ) : (
                              <Icon className="size-5" />
                            )}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-fg">
                              {method.name}
                              {method.exchangeRate ? (
                                <span className="num ms-1.5 text-xs font-normal text-muted">
                                  — الصرف ({formatExchangeRate(method.exchangeRate)})
                                </span>
                              ) : null}
                            </span>
                            {method.description && (
                              <span className="block truncate text-xs text-muted">
                                {method.description}
                              </span>
                            )}
                            {hasFee && (
                              <span className="num block text-[11px] text-muted-2">
                                رسوم{" "}
                                {method.feeBps > 0 ? formatFeeBps(method.feeBps) : ""}
                                {method.feeBps > 0 && method.feeFixed > 0 ? " + " : ""}
                                {method.feeFixed > 0 ? formatMoney(method.feeFixed) : ""}
                              </span>
                            )}
                          </span>

                          {/* radio dot */}
                          <span
                            aria-hidden
                            className={cn(
                              "grid size-5 shrink-0 place-items-center rounded-full border-2 transition",
                              picked ? "border-brand" : "border-line",
                            )}
                          >
                            {picked && <span className="size-2.5 rounded-full bg-brand" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="shrink-0 border-t border-line px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3">
                  <button
                    type="button"
                    disabled={!chosenId}
                    onClick={() =>
                      setConfirmed(methods.find((method) => method.id === chosenId) ?? null)
                    }
                    className="tap w-full rounded-xl bg-brand py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-40"
                  >
                    المتابعة
                  </button>
                </div>
              </>
            ) : (
              <form
                action={formAction}
                className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
              >
                <input type="hidden" name="methodId" value={confirmed.id} />

                <div className="space-y-3 pb-3">
                  {confirmed.instructions && (
                    <div className="rounded-2xl border border-brand/40 bg-brand-soft p-3.5">
                      <p className="mb-1 text-xs font-bold text-fg">خطوات الدفع</p>
                      <p className="whitespace-pre-line text-xs leading-relaxed text-muted">
                        {confirmed.instructions}
                      </p>
                    </div>
                  )}

                  <label className="block space-y-1.5">
                    <span className="block text-sm font-medium text-fg">
                      المبلغ المدفوع (د.ل)
                    </span>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      dir="ltr"
                      required
                      autoFocus
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder="0.00"
                      className="h-12 w-full rounded-xl border border-line bg-surface px-3.5 text-start text-base text-fg outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
                    />
                    {(confirmed.minAmount || confirmed.maxAmount) && (
                      <span className="num block text-[11px] text-muted-2">
                        {confirmed.minAmount
                          ? `الحد الأدنى ${formatMoney(confirmed.minAmount)}`
                          : ""}
                        {confirmed.minAmount && confirmed.maxAmount ? " · " : ""}
                        {confirmed.maxAmount
                          ? `الحد الأقصى ${formatMoney(confirmed.maxAmount)}`
                          : ""}
                      </span>
                    )}
                  </label>

                  {quote && quote.amount > 0 && (
                    <div className="space-y-1.5 rounded-2xl border border-line bg-surface p-3.5">
                      <Row label="المبلغ" value={quote.amount} />
                      {quote.fee > 0 && <Row label="الرسوم" value={-quote.fee} sign muted />}
                      <div className="flex items-center justify-between border-t border-line pt-2">
                        <span className="text-sm font-bold text-fg">يُضاف لمحفظتك</span>
                        <MoneyText
                          value={quote.credited}
                          className="text-sm font-bold text-brand"
                        />
                      </div>
                    </div>
                  )}

                  <label className="block space-y-1.5">
                    <span className="block text-sm font-medium text-fg">
                      رقم العملية / الإيصال
                      <span className="ms-1 text-xs font-normal text-muted-2">(اختياري)</span>
                    </span>
                    <input
                      name="reference"
                      dir="ltr"
                      placeholder="TRX-123456"
                      className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-start text-sm text-fg outline-none transition focus:border-brand/60"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="block text-sm font-medium text-fg">
                      ملاحظة
                      <span className="ms-1 text-xs font-normal text-muted-2">(اختياري)</span>
                    </span>
                    <textarea
                      name="note"
                      rows={2}
                      className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-fg outline-none transition focus:border-brand/60"
                    />
                  </label>

                  {state.error && (
                    <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
                      {state.error}
                    </p>
                  )}
                </div>

                <div className="mt-auto space-y-2 border-t border-line pt-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmed(null)}
                      className="tap rounded-xl border border-line bg-surface px-5 py-3.5 text-sm font-semibold text-fg"
                    >
                      رجوع
                    </button>
                    <SubmitButton />
                  </div>

                  <p className="text-center text-[11px] text-muted-2">
                    يُراجع الطلب يدوياً — لن يُضاف الرصيد قبل تأكيد استلام المبلغ
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({
  label,
  value,
  sign,
  muted,
}: {
  label: string;
  value: number;
  sign?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <MoneyText value={value} sign={sign} className={cn(muted ? "text-muted" : "text-fg")} />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="tap flex-1 rounded-xl bg-brand py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
    >
      {pending ? "جارٍ الإرسال…" : "إرسال الطلب"}
    </button>
  );
}
