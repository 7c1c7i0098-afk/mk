import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiFailure, apiError, readJson } from "@/lib/api";
import { getServerCart, replaceServerCart } from "@/lib/cart-server";
import { getCurrentUser } from "@/lib/session";
import { cartItemsSchema } from "@/lib/validators/auth";

/** Current stored cart for the signed-in customer. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ items: [], authenticated: false });

    return NextResponse.json({ items: await getServerCart(user.id), authenticated: true });
  } catch (error) {
    return apiFailure("api/cart GET", error);
  }
}

/** Mirrors the client cart into the database after every change. */
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ items: [], authenticated: false });

    const parsed = cartItemsSchema.safeParse(await readJson<unknown>(request));
    if (!parsed.success) return apiError("محتوى السلة غير صالح", 422);

    const items = await replaceServerCart(user.id, parsed.data.items);
    return NextResponse.json({ items, authenticated: true });
  } catch (error) {
    return apiFailure("api/cart PUT", error);
  }
}
