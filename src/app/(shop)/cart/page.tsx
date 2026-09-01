import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "السلة" };

export default async function CartPage() {
  const user = await getCurrentUser();
  return <CartView isAuthenticated={Boolean(user)} />;
}
