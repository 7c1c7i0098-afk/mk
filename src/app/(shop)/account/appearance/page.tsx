import type { Metadata } from "next";
import { AccountScreen } from "@/components/shop/account-screen";
import { ThemeSelector } from "@/components/theme/theme-selector";

export const metadata: Metadata = { title: "المظهر" };

export default function AppearancePage() {
  return (
    <AccountScreen title="المظهر">
      <section className="space-y-3 rounded-3xl border border-line bg-surface p-5">
        <ThemeSelector />
        <p className="text-xs leading-relaxed text-muted-2">
          «حسب الجهاز» يتبع إعداد هاتفك، فيتحوّل للوضع الليلي مع الهاتف مساءً.
        </p>
      </section>
    </AccountScreen>
  );
}
