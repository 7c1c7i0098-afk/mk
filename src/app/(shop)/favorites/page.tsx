import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ComingSoon } from "@/components/shop/coming-soon";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "المفضلة" };

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/favorites");

  return (
    <ComingSoon
      title="المفضلة"
      description="منتجاتك المفضلة ستظهر هنا في مرحلة المفضلة."
    />
  );
}
