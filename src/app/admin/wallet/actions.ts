"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { removeUpload } from "@/lib/admin/uploads";
import { DEFAULT_METHODS, parseExchangeRate, parseFeePercent } from "@/lib/wallet/fees";
import { approveTopUp, rejectTopUp } from "@/lib/wallet/topups";
import type { PaymentMethodKind } from "@/generated/prisma/enums";

/**
 * Wallet administration: the rails customers may pay through, and the review of
 * what they claim to have paid.
 *
 * Every action re-checks the admin role server-side. These are the endpoints
 * that create money, so the check here — not the navigation — is what stops a
 * customer session from approving its own top-up.
 */

export type WalletAdminState = { ok?: boolean; error?: string; message?: string };

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function flag(form: FormData, key: string) {
  return form.get(key) === "on" || form.get(key) === "true";
}

function refresh() {
  revalidatePath("/admin/wallet");
  revalidatePath("/admin/transactions");
  revalidatePath("/admin/users");
  revalidatePath("/wallet");
}

const KINDS: PaymentMethodKind[] = [
  "BANK_CARD",
  "EDFALI",
  "MASARIF_PAY",
  "YUSR_PAY",
  "BANK_TRANSFER",
  "CRYPTO",
  "OTHER",
];

// ───────────────────────────── payment methods ─────────────────────────────

export async function savePaymentMethod(
  _state: WalletAdminState,
  form: FormData,
): Promise<WalletAdminState> {
  try {
    await assertAdmin();

    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) return { error: "اسم الطريقة مطلوب" };

    const kindRaw = text(form, "kind") || "OTHER";
    if (!KINDS.includes(kindRaw as PaymentMethodKind)) return { error: "نوع الطريقة غير صالح" };

    const feeBps = parseFeePercent(text(form, "feePercent") || "0");
    if (feeBps === null) return { error: "نسبة الرسوم غير صالحة" };

    const feeFixed = toMinor(text(form, "feeFixed") || "0");
    if (!Number.isFinite(feeFixed) || feeFixed < 0) return { error: "مبلغ الرسوم غير صالح" };

    const rateInput = text(form, "exchangeRate");
    const exchangeRate = rateInput ? parseExchangeRate(rateInput) : null;
    if (rateInput && exchangeRate === null) return { error: "سعر الصرف غير صالح" };

    const minInput = text(form, "minAmount");
    const maxInput = text(form, "maxAmount");
    const minAmount = minInput ? toMinor(minInput) : null;
    const maxAmount = maxInput ? toMinor(maxInput) : null;

    if (minAmount !== null && maxAmount !== null && minAmount > maxAmount) {
      return { error: "الحد الأدنى أكبر من الحد الأقصى" };
    }

    const logo = text(form, "logo") || null;

    const data = {
      name,
      kind: kindRaw as PaymentMethodKind,
      logo,
      exchangeRate,
      description: text(form, "description") || null,
      instructions: text(form, "instructions") || null,
      feeBps,
      feeFixed,
      minAmount,
      maxAmount,
      sortOrder: Number(text(form, "sortOrder")) || 0,
      isActive: flag(form, "isActive"),
    };

    if (id) {
      const previous = await prisma.paymentMethod.findUnique({
        where: { id },
        select: { logo: true },
      });
      await prisma.paymentMethod.update({ where: { id }, data });
      // Replaced artwork is deleted so uploads do not pile up.
      if (previous?.logo && previous.logo !== logo) await removeUpload(previous.logo);
    } else {
      await prisma.paymentMethod.create({ data });
    }

    refresh();
    return { ok: true, message: id ? "تم حفظ الطريقة" : "تمت إضافة الطريقة" };
  } catch (error) {
    console.error("[admin/savePaymentMethod]", error);
    return { error: "تعذّر حفظ طريقة الشحن" };
  }
}

export async function togglePaymentMethod(
  _state: WalletAdminState,
  form: FormData,
): Promise<WalletAdminState> {
  try {
    await assertAdmin();
    const id = text(form, "id");

    const method = await prisma.paymentMethod.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!method) return { error: "الطريقة غير موجودة" };

    await prisma.paymentMethod.update({
      where: { id },
      data: { isActive: !method.isActive },
    });

    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[admin/togglePaymentMethod]", error);
    return { error: "تعذّر تغيير الحالة" };
  }
}

/**
 * Deletes a rail.
 *
 * Refused while a request is still awaiting review through it: a pending claim
 * must keep the rail it was raised on, or the reviewer loses the context they
 * need to decide.
 */
export async function deletePaymentMethod(
  _state: WalletAdminState,
  form: FormData,
): Promise<WalletAdminState> {
  try {
    await assertAdmin();
    const id = text(form, "id");

    const pending = await prisma.topUpRequest.count({
      where: { methodId: id, status: "PENDING" },
    });
    if (pending > 0) {
      return { error: `لا يمكن الحذف — ${pending} طلب شحن قيد المراجعة على هذه الطريقة` };
    }

    const method = await prisma.paymentMethod.findUnique({
      where: { id },
      select: { logo: true },
    });

    // Past requests keep their `methodName` snapshot, so history stays readable.
    await prisma.paymentMethod.delete({ where: { id } });
    await removeUpload(method?.logo);

    refresh();
    return { ok: true, message: "تم حذف الطريقة" };
  } catch (error) {
    console.error("[admin/deletePaymentMethod]", error);
    return { error: "تعذّر حذف الطريقة" };
  }
}

/** Moves a rail up or down in the sheet by swapping order with its neighbour. */
export async function movePaymentMethod(
  _state: WalletAdminState,
  form: FormData,
): Promise<WalletAdminState> {
  try {
    await assertAdmin();
    const id = text(form, "id");
    const direction = text(form, "direction");

    const methods = await prisma.paymentMethod.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, sortOrder: true },
    });

    const index = methods.findIndex((method) => method.id === id);
    if (index === -1) return { error: "الطريقة غير موجودة" };

    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= methods.length) return { ok: true };

    // Rewrites the whole column so ties and duplicates settle into a clean
    // sequence rather than fighting each other on the next move.
    const reordered = [...methods];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    await prisma.$transaction(
      reordered.map((method, position) =>
        prisma.paymentMethod.update({ where: { id: method.id }, data: { sortOrder: position } }),
      ),
    );

    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[admin/movePaymentMethod]", error);
    return { error: "تعذّر تغيير الترتيب" };
  }
}

/** One-click setup of the rails PLUS CARD ships with. Skips any already added. */
export async function seedDefaultMethods(
  _state: WalletAdminState,
  _form: FormData,
): Promise<WalletAdminState> {
  try {
    await assertAdmin();

    const existing = await prisma.paymentMethod.findMany({ select: { name: true } });
    const taken = new Set(existing.map((method) => method.name));
    const missing = DEFAULT_METHODS.filter((method) => !taken.has(method.name));

    if (missing.length === 0) return { ok: true, message: "كل الطرق الافتراضية مضافة" };

    await prisma.paymentMethod.createMany({
      data: missing.map((method, index) => ({
        name: method.name,
        kind: method.kind,
        description: method.description,
        sortOrder: existing.length + index,
        // Added disabled: a rail with no payment instructions yet must not be
        // offered to customers.
        isActive: false,
      })),
    });

    refresh();
    return { ok: true, message: `أُضيفت ${missing.length} طرق — أكمل تعليماتها ثم فعّلها` };
  } catch (error) {
    console.error("[admin/seedDefaultMethods]", error);
    return { error: "تعذّرت الإضافة" };
  }
}

// ───────────────────────────── top-up review ─────────────────────────────

export async function approveTopUpRequest(
  _state: WalletAdminState,
  form: FormData,
): Promise<WalletAdminState> {
  try {
    const admin = await assertAdmin();

    const result = await approveTopUp(text(form, "id"), admin.id, text(form, "adminNote") || null);
    if (!result.ok) return { error: result.error };

    refresh();
    return { ok: true, message: "تم اعتماد الطلب وإضافة الرصيد" };
  } catch (error) {
    console.error("[admin/approveTopUpRequest]", error);
    return { error: "تعذّر اعتماد الطلب" };
  }
}

export async function rejectTopUpRequest(
  _state: WalletAdminState,
  form: FormData,
): Promise<WalletAdminState> {
  try {
    const admin = await assertAdmin();

    const result = await rejectTopUp(text(form, "id"), admin.id, text(form, "adminNote") || null);
    if (!result.ok) return { error: result.error ?? "تعذّر الرفض" };

    refresh();
    return { ok: true, message: "تم رفض الطلب" };
  } catch (error) {
    console.error("[admin/rejectTopUpRequest]", error);
    return { error: "تعذّر رفض الطلب" };
  }
}
