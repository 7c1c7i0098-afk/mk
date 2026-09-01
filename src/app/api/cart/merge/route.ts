import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiError, apiFailure, readJson } from "@/lib/api";
import { mergeGuestCart } from "@/lib/cart-server";
import { getCurrentUser } from "@/lib/session";
import { cartItemsSchema } from "@/lib/validators/auth";

/**
 * Folds the guest cart into the customer's stored cart after authentication.
 * Identical variants are combined, never duplicated, and the merged cart is
 * returned so the client can adopt it as the source of truth.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ items: [], authenticated: false });

    const parsed = cartItemsSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return apiError("محتوى السلة غير صالح", 422);

    const items = await mergeGuestCart(user.id, parsed.data.items);
    return NextResponse.json({ items, authenticated: true });
  } catch (error) {
    return apiFailure("api/cart/merge", error);
  }
}
