"use server";

import { revalidatePath } from "next/cache";
import { addMessage, closeThread, MAX_MESSAGE_LENGTH } from "@/lib/support";
import { assertAdmin } from "@/lib/admin/guard";

/**
 * The shop's side of support.
 *
 * `assertAdmin()` runs on every call rather than trusting the page that
 * rendered the form — a server action is a public endpoint, and the customer
 * id it receives would otherwise let anyone write into, or close, any thread as
 * the shop.
 */

export type ReplyState = { ok?: boolean; error?: string };

export async function replyToSupport(
  _state: ReplyState,
  form: FormData,
): Promise<ReplyState> {
  const admin = await assertAdmin();

  const userId = form.get("userId");
  const raw = form.get("body");
  const body = typeof raw === "string" ? raw.trim() : "";

  if (typeof userId !== "string" || !userId) return { error: "المحادثة غير معروفة" };
  if (!body) return { error: "اكتب الرد أولاً" };
  if (body.length > MAX_MESSAGE_LENGTH) {
    return { error: `الرد طويل — الحد ${MAX_MESSAGE_LENGTH} حرف` };
  }

  await addMessage({ userId, body, fromStaff: true, staffId: admin.id });

  revalidatePath(`/admin/support/${userId}`);
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function closeSupportThreadAsAdmin(userId: string): Promise<ReplyState> {
  const admin = await assertAdmin();
  if (!userId) return { error: "المحادثة غير معروفة" };

  await closeThread(userId, admin.id);

  revalidatePath(`/admin/support/${userId}`);
  revalidatePath("/admin/support");
  return { ok: true };
}
