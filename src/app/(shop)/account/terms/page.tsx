import type { Metadata } from "next";
import { AccountScreen } from "@/components/shop/account-screen";
import { LegalText } from "@/components/shop/legal-text";
import { getLegalText } from "@/lib/site-content";

export const metadata: Metadata = { title: "الشروط والأحكام" };

export default async function TermsPage() {
  const text = await getLegalText("terms");

  return (
    <AccountScreen title="الشروط والأحكام">
      <LegalText text={text} />
    </AccountScreen>
  );
}
