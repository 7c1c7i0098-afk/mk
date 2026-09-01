"use server";

import { revalidatePath } from "next/cache";
import { toMinor } from "@/lib/money";
import { cancelTopUpRequest, createTopUpRequest } from "@/lib/wallet/topups";
import { getCurrentUser } from "@/lib/session";

/**
 * Customer wallet actions.
 *
 * Both re-read the session rather than trusting a field: the owner of a top-up
 * comes from the cookie, so no form can raise or cancel a request on somebody
 * else's wallet.
 */

export type WalletState = { ok?: boolean; error?: string; message?: string };

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function requestTopUp(
  _state: WalletState,
  form: FormData,
): Promise<WalletState> {
  const user = await getCurrentUser();
  if (!user) return { error: "يجب تسجيل الدخول" };

  const methodId = text(form, "methodId");
  if (!methodId) return { error: "اختر طريقة الشحن" };

  const amount = toMinor(text(form, "amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "أدخل مبلغاً صحيحاً" };

  const result = await createTopUpRequest({
    userId: user.id,
    methodId,
    amount,
    reference: text(form, "reference") || null,
    note: text(form, "note") || null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/wallet");
  return {
    ok: true,
    message: "تم إرسال طلب الشحن — سيظهر الرصيد بعد اعتماد الإدارة",
  };
}

export async function cancelTopUp(
  _state: WalletState,
  form: FormData,
): Promise<WalletState> {
  const user = await getCurrentUser();
  if (!user) return { error: "يجب تسجيل الدخول" };

  const result = await cancelTopUpRequest(text(form, "id"), user.id);
  if (!result.ok) return { error: result.error ?? "تعذّر الإلغاء" };

  revalidatePath("/wallet");
  return { ok: true, message: "تم إلغاء الطلب" };
}
