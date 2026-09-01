"use server";

import { revalidatePath } from "next/cache";
import { toMinor } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";
import { transferBalance } from "@/lib/wallet/transfer";

/**
 * Sending balance to another customer.
 *
 * The sender is the session, never a form field. Everything else is re-checked
 * inside the transfer itself — this action only shapes the input.
 */

export type TransferState = {
  ok?: boolean;
  error?: string;
  message?: string;
};

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendBalance(
  _state: TransferState,
  form: FormData,
): Promise<TransferState> {
  const user = await getCurrentUser();
  if (!user) return { error: "يجب تسجيل الدخول" };

  const recipientPublicId = text(form, "recipient");
  const rawAmount = text(form, "amount");

  const amount = toMinor(rawAmount);
  if (!rawAmount || amount <= 0) return { error: "أدخل مبلغاً صحيحاً" };

  const result = await transferBalance({
    senderId: user.id,
    recipientPublicId,
    amount,
    note: text(form, "note") || null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/account");
  revalidatePath("/account/transfer");
  revalidatePath("/wallet");
  revalidatePath("/", "layout");

  return { ok: true, message: `تم تحويل المبلغ إلى ${result.recipientName}` };
}
