import type { Metadata } from "next";
import { Check } from "lucide-react";
import { AccountScreen } from "@/components/shop/account-screen";

export const metadata: Metadata = { title: "اللغة" };

/** One language, said plainly. A picker with a single option pretending to be a
 *  choice is worse than a sentence telling the truth. */
export default function LanguagePage() {
  return (
    <AccountScreen title="اللغة">
      <section className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-bold text-brand">
            ع
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-fg">العربية</p>
            <p className="text-xs text-muted">لغة المتجر الحالية</p>
          </div>
          <Check className="size-5 shrink-0 text-brand" aria-hidden />
        </div>
      </section>

      <p className="px-1 text-xs leading-relaxed text-muted-2">
        المتجر بالعربية فقط حالياً. لغات أخرى قيد الإعداد.
      </p>
    </AccountScreen>
  );
}
