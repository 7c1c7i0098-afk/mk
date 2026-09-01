import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountScreen } from "@/components/shop/account-screen";
import { TransferForm } from "@/components/shop/transfer-form";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "تحويل رصيد" };

export default async function TransferPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/transfer");

  return (
    <AccountScreen title="تحويل رصيد">
      <TransferForm balance={user.balance} />
    </AccountScreen>
  );
}
