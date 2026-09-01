"use server";

import { revalidatePath } from "next/cache";
import { addMessage, closeThread, MAX_MESSAGE_LENGTH } from "@/lib/support";
import { getCurrentUser } from "@/lib/session";

/**
 * The customer's side of support.
 *
 * The thread is chosen by the session, never by the form: there is no field a
 * caller could set to write into — or close — somebody else's conversation, and
 * `fromStaff` is hard-coded false so a customer cannot post a line that renders
 * as a reply from the shop.
 */

export type SupportState = { ok?: boolean; error?: string };

export async function sendSupportMessage(
  _state: SupportState,
  form: FormData,
): Promise<SupportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "يجب تسجيل الدخول لمراسلة الدعم" };

  const raw = form.get("body");
  const body = typeof raw === "string" ? raw.trim() : "";
  if (!body) return { error: "اكتب رسالتك أولاً" };
  if (body.length > MAX_MESSAGE_LENGTH) {
    return { error: `الرسالة طويلة — الحد ${MAX_MESSAGE_LENGTH} حرف` };
  }

  await addMessage({ userId: user.id, body, fromStaff: false });

  revalidatePath("/support");
  return { ok: true };
}

export async function closeSupportThread(): Promise<SupportState> {
  const user = await getCurrentUser();
  if (!user) return { error: "يجب تسجيل الدخول" };

  // Their button tidies their screen; the shop keeps the record.
  await closeThread(user.id, user.id, { clearForCustomer: true });

  revalidatePath("/support");
  return { ok: true };
}
