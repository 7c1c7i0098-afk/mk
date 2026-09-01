"use server";

import { revalidatePath } from "next/cache";
import { placeOrder } from "@/lib/orders/checkout";
import { getCurrentUser } from "@/lib/session";

/**
 * The checkout endpoint.
 *
 * Like every server action this is a public POST, so it re-reads the session
 * rather than trusting anything the form carried: the customer id comes from
 * the cookie, never from a field. The form supplies only the per-product inputs
 * the supplier asked for, and even those are re-validated server-side.
 */

export type CheckoutState = {
  ok?: boolean;
  error?: string;
  /** The customer-facing order number — the same one the wallet entry shows. */
  number?: number;
  message?: string;
};

export async function submitCheckout(
  _state: CheckoutState,
  form: FormData,
): Promise<CheckoutState> {
  const user = await getCurrentUser();
  if (!user) return { error: "يجب تسجيل الدخول لإتمام الطلب" };

  // Inputs arrive as `param__<variantId>__<fieldName>`, so one product's fields
  // can never be read as another's.
  const params: Record<string, Record<string, string>> = {};

  for (const [key, value] of form.entries()) {
    if (!key.startsWith("param__") || typeof value !== "string") continue;
    const [, variantId, ...rest] = key.split("__");
    if (!variantId || rest.length === 0) continue;
    params[variantId] ??= {};
    params[variantId][rest.join("__")] = value;
  }

  const result = await placeOrder({ userId: user.id, params });

  if (!result.ok) return { error: result.error };

  revalidatePath("/orders");
  revalidatePath("/wallet");
  revalidatePath("/cart");
  revalidatePath("/", "layout");

  const { summary } = result;
  const parts: string[] = [];
  if (summary.delivered > 0) parts.push(`${summary.delivered} سُلِّم فوراً`);
  if (summary.pending > 0) parts.push(`${summary.pending} قيد التنفيذ`);
  if (summary.refunded > 0) parts.push(`${summary.refunded} تعذّر وأُعيد مبلغه`);

  return {
    ok: true,
    number: result.number,
    message: parts.join(" · ") || "تم استلام الطلب",
  };
}
