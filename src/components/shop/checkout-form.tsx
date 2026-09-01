"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import {
  CheckCircle2,
  BadgePercent,
  Coins,
  ReceiptText,
  ShoppingCart,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { submitCheckout, type CheckoutState } from "@/app/(shop)/checkout/actions";
import { useCart } from "@/components/cart/cart-provider";
import { Thumb } from "@/components/ui/thumb";
import { MoneyText } from "@/components/shop/money-text";
import type { CheckoutPreview } from "@/lib/orders/checkout";
import { cn } from "@/lib/utils";

/**
 * The purchase screen.
 *
 * Its one job beyond confirming the total is collecting what each supplier
 * demands — a player id here, an account link there — because those differ per
 * product and a purchase without them fails at the provider. The fields shown
 * are the ones the provider itself declared during the last catalog sync.
 *
 * Nothing here is trusted: the server re-prices the basket and re-validates
 * every field before a dinar moves.
 */
export function CheckoutForm({ preview }: { preview: CheckoutPreview }) {
  const router = useRouter();
  const cart = useCart();

  const [state, formAction] = useActionState(
    async (previous: CheckoutState, form: FormData) => {
      const result = await submitCheckout(previous, form);
      if (result.ok) {
        // The server already emptied the stored cart; clear the local mirror
        // so the badge and the floating bar agree with it.
        cart.clear();
        // replace, not push: the back arrow should reach the shop, never a
        // checkout form for a basket that has already been paid for.
        if (result.number) router.replace(`/orders/${result.number}`);
        else router.refresh();
      }
      return result;
    },
    {},
  );

  // Shown for the moment between the order landing and the details screen
  // taking over — the navigation above is already on its way.
  if (state.ok) {
    return (
      <div className="space-y-3 rounded-3xl border border-success/40 bg-success/10 px-6 py-10 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <h2 className="text-lg font-bold text-fg">تم استلام طلبك</h2>
        <p className="text-sm text-muted">
          رقم الطلب <span className="num">#{state.number}</span>
        </p>
        <p className="text-xs text-muted-2">جارٍ فتح تفاصيل الطلب…</p>
      </div>
    );
  }

  const canSubmit =
    preview.lines.length > 0 && preview.blocking.length === 0 && !preview.insufficient;

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="flex items-start gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {state.error}
        </p>
      )}

      <section className="space-y-3">
        <SectionHead icon={ShoppingCart} title="السلة" />

        <ul className="space-y-2.5">
          {preview.lines.map((line) => (
            <li
              key={line.variantId}
              className="space-y-3 rounded-2xl border border-line bg-surface p-3"
            >
              <div className="flex items-center gap-3">
                <Thumb
                  src={line.image}
                  alt={line.variantName}
                  sizes="64px"
                  rounded="rounded-xl"
                  className="size-16 shrink-0"
                />

                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="truncate pb-0.5 text-sm font-bold leading-[1.7] text-fg">
                    {line.variantName}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <MoneyText value={line.finalUnitPrice} className="text-xs text-muted" />
                    <span className="rounded-lg bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                      الكمية: <span className="num">{line.quantity}</span>
                    </span>
                  </div>
                </div>

                <div className="shrink-0 space-y-0.5 text-end">
                  <p className="text-[11px] text-muted-2">الإجمالي</p>
                  <MoneyText value={line.lineTotal} className="text-sm font-bold text-brand" />
                </div>
              </div>

              {line.problem && (
                <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
                  {line.problem}
                </p>
              )}

              {/* Fields the provider requires for this specific product */}
              {line.paramFields.length > 0 && (
                <div className="space-y-2 rounded-xl border border-line bg-ink p-3">
                  <p className="text-[11px] font-semibold text-fg">
                    بيانات مطلوبة لتنفيذ هذا المنتج
                  </p>
                  {line.paramFields.map((field) => (
                    <label key={field.name} className="block space-y-1">
                      <span className="block text-xs text-muted">
                        {field.label}
                        {field.required && <span className="text-danger"> *</span>}
                      </span>
                      <input
                        name={`param__${line.variantId}__${field.name}`}
                        type={field.type === "number" ? "text" : field.type}
                        inputMode={field.type === "number" ? "numeric" : undefined}
                        required={field.required}
                        placeholder={field.placeholder ?? ""}
                        autoComplete="off"
                        className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg outline-none transition focus:border-brand/60 focus:ring-4 focus:ring-brand/10"
                      />
                    </label>
                  ))}
                  <p className="text-[10px] text-muted-2">
                    تأكّد من صحتها — تُرسل إلى المزوّد كما هي ولا يمكن تعديلها بعد الشراء
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHead icon={ReceiptText} title="تفاصيل الطلب" />

        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <DetailRow icon={ShoppingCart} label="الإجمالي">
            <MoneyText value={preview.subtotal} className="text-fg" />
          </DetailRow>

          {preview.discount > 0 && (
            <DetailRow icon={BadgePercent} label="الخصم الخاص بك">
              <MoneyText
                value={-preview.discount}
                sign
                className="font-semibold text-success"
              />
            </DetailRow>
          )}

          {/* Coins, not a headset: the row is what the shop takes, not who to
              call. No fee is charged on top of the price, and saying so is
              worth a row — a blank where a fee could be makes people hesitate. */}
          <DetailRow icon={Coins} label="عمولة الخدمة">
            <span className="text-sm font-semibold text-success">مجاني</span>
          </DetailRow>

          <DetailRow icon={Wallet} label="رصيد محفظتك">
            <MoneyText
              value={preview.balance}
              className={cn(
                "font-semibold",
                preview.insufficient ? "text-danger" : "text-fg",
              )}
            />
          </DetailRow>

          <div className="border-t border-line pt-3">
            <DetailRow icon={ReceiptText} label="إجمالي الطلب" strong>
              <MoneyText value={preview.total} className="text-lg font-bold text-brand" />
            </DetailRow>
          </div>
        </div>

        {preview.insufficient && (
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
            رصيدك لا يكفي — تحتاج <MoneyText value={preview.total - preview.balance} /> إضافية
          </p>
        )}
      </section>

      {/* Bleeds to the screen edges so the bar reads as part of the frame rather
          than as one more card in the scroll. */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-line bg-ink/95 px-4 pb-3 pt-3 backdrop-blur md:-mx-6 md:px-6">
        <SubmitButton disabled={!canSubmit} />
      </div>
    </form>
  );
}

/** Icon tile, then the heading — the tile lands on the right in RTL. */
function SectionHead({
  icon: Icon,
  title,
}: {
  icon: typeof ShoppingCart;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <h2 className="pb-0.5 text-base font-bold leading-[1.7] text-fg">{title}</h2>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  strong = false,
  children,
}: {
  icon: typeof ShoppingCart;
  label: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <Icon
          className={cn("size-4 shrink-0", strong ? "text-brand" : "text-muted-2")}
          strokeWidth={2}
        />
        <span
          className={cn(
            "pb-0.5 leading-[1.7]",
            strong ? "text-sm font-bold text-brand" : "text-sm text-muted",
          )}
        >
          {label}
        </span>
      </span>
      {children}
    </div>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="tap w-full rounded-xl bg-brand py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
    >
      {pending ? "جارٍ تنفيذ الطلب…" : "تأكيد الطلب"}
    </button>
  );
}
