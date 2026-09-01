import type { Metadata } from "next";
import { AccountScreen } from "@/components/shop/account-screen";
import { LegalText } from "@/components/shop/legal-text";
import { getLegalText } from "@/lib/site-content";

export const metadata: Metadata = { title: "سياسة الخصوصية" };

export default async function PrivacyPage() {
  const text = await getLegalText("privacy");

  return (
    <AccountScreen title="سياسة الخصوصية">
      <LegalText text={text} />
    </AccountScreen>
  );
}
