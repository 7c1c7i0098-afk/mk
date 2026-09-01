"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin/guard";
import { removeUpload } from "@/lib/admin/uploads";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { MAX_DISCOUNT_BPS, parsePercentToBps } from "@/lib/pricing";
import { nextNumber } from "@/lib/sequences";
import { slugify } from "@/lib/utils";

/**
 * Admin mutations. Every action re-checks the role server-side, so calling one
 * directly from a customer session fails regardless of what the UI shows.
 */

export type ActionState = { ok?: boolean; error?: string };

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function number(form: FormData, key: string, fallback = 0) {
  const value = Number(text(form, key));
  return Number.isFinite(value) ? value : fallback;
}

function flag(form: FormData, key: string) {
  return form.get(key) === "on" || form.get(key) === "true";
}

function refreshStorefront() {
  revalidatePath("/", "layout");
}

/** Ensures a unique slug, appending a counter when needed. */
async function uniqueSlug(
  model: "category" | "product",
  desired: string,
  currentId?: string,
): Promise<string> {
  const base = slugify(desired) || "item";
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing =
      model === "category"
        ? await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } })
        : await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });

    if (!existing || existing.id === currentId) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

// ─────────────────────────────── categories ───────────────────────────────

export async function saveCategory(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();

    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) return { error: "اسم الفئة مطلوب" };

    const image = text(form, "image") || null;
    const data = {
      name,
      slug: await uniqueSlug("category", text(form, "slug") || name, id || undefined),
      image,
      sortOrder: number(form, "sortOrder"),
      isActive: flag(form, "isActive"),
    };

    if (id) {
      const previous = await prisma.category.findUnique({
        where: { id },
        select: { image: true },
      });
      await prisma.category.update({ where: { id }, data });
      // Replaced artwork is deleted so uploads do not pile up.
      if (previous?.image && previous.image !== image) await removeUpload(previous.image);
    } else {
      await prisma.category.create({ data });
    }

    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/saveCategory]", error);
    return { error: "تعذّر حفظ الفئة" };
  }
}

export async function deleteCategory(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const id = text(form, "id");
    if (!id) return { error: "الفئة غير موجودة" };

    const category = await prisma.category.findUnique({
      where: { id },
      select: { image: true, _count: { select: { products: true } } },
    });
    if (!category) return { error: "الفئة غير موجودة" };
    if (category._count.products > 0) {
      return { error: "لا يمكن حذف فئة تحتوي على منتجات — انقل المنتجات أولاً" };
    }

    await prisma.category.delete({ where: { id } });
    await removeUpload(category.image);

    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/deleteCategory]", error);
    return { error: "تعذّر حذف الفئة" };
  }
}

export async function toggleCategory(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const id = text(form, "id");
    const category = await prisma.category.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!category) return { error: "الفئة غير موجودة" };

    await prisma.category.update({ where: { id }, data: { isActive: !category.isActive } });
    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/toggleCategory]", error);
    return { error: "تعذّر تغيير الحالة" };
  }
}

// ──────────────────────────────── products ────────────────────────────────

export async function saveProduct(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();

    const id = text(form, "id");
    const name = text(form, "name");
    const categoryId = text(form, "categoryId");
    if (!name) return { error: "اسم المنتج مطلوب" };
    if (!categoryId) return { error: "يجب اختيار الفئة" };

    const image = text(form, "image") || null;
    const data = {
      name,
      categoryId,
      slug: await uniqueSlug("product", text(form, "slug") || name, id || undefined),
      image,
      description: text(form, "description") || null,
      usageInstructions: text(form, "usageInstructions") || null,
      rechargeInstructions: text(form, "rechargeInstructions") || null,
      redemptionInstructions: text(form, "redemptionInstructions") || null,
      helpLink: text(form, "helpLink") || null,
      region: text(form, "region") || null,
      sortOrder: number(form, "sortOrder"),
      isActive: flag(form, "isActive"),
    };

    if (id) {
      const previous = await prisma.product.findUnique({ where: { id }, select: { image: true } });
      await prisma.product.update({ where: { id }, data });
      if (previous?.image && previous.image !== image) await removeUpload(previous.image);
    } else {
      await prisma.product.create({ data });
    }

    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/saveProduct]", error);
    return { error: "تعذّر حفظ المنتج" };
  }
}

export async function deleteProduct(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const id = text(form, "id");

    const product = await prisma.product.findUnique({ where: { id }, select: { image: true } });
    if (!product) return { error: "المنتج غير موجود" };

    await prisma.product.delete({ where: { id } });
    await removeUpload(product.image);

    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/deleteProduct]", error);
    return { error: "تعذّر حذف المنتج" };
  }
}

export async function toggleProduct(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const id = text(form, "id");
    const product = await prisma.product.findUnique({ where: { id }, select: { isActive: true } });
    if (!product) return { error: "المنتج غير موجود" };

    await prisma.product.update({ where: { id }, data: { isActive: !product.isActive } });
    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/toggleProduct]", error);
    return { error: "تعذّر تغيير الحالة" };
  }
}

// ──────────────────────────────── variants ────────────────────────────────

export async function saveVariant(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();

    const id = text(form, "id");
    const productId = text(form, "productId");
    const name = text(form, "name");
    if (!productId) return { error: "المنتج غير محدد" };
    if (!name) return { error: "اسم الفئة مطلوب" };

    const price = toMinor(text(form, "price"));
    if (price <= 0) return { error: "السعر يجب أن يكون أكبر من صفر" };

    const data = {
      productId,
      name,
      value: text(form, "value") || null,
      // Left blank = inherit the product's own text, so shared instructions
      // are stored once instead of being copied onto every denomination.
      description: text(form, "description") || null,
      usageInstructions: text(form, "usageInstructions") || null,
      rechargeInstructions: text(form, "rechargeInstructions") || null,
      redemptionInstructions: text(form, "redemptionInstructions") || null,
      helpLink: text(form, "helpLink") || null,
      price,
      stock: Math.max(0, Math.trunc(number(form, "stock"))),
      sortOrder: number(form, "sortOrder"),
      isActive: flag(form, "isActive"),
    };

    if (id) {
      await prisma.productVariant.update({ where: { id }, data });
    } else {
      await prisma.productVariant.create({ data });
    }

    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/saveVariant]", error);
    return { error: "تعذّر حفظ الفئة السعرية" };
  }
}

export async function deleteVariant(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const id = text(form, "id");
    await prisma.productVariant.delete({ where: { id } });

    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/deleteVariant]", error);
    return { error: "تعذّر حذف الفئة السعرية" };
  }
}

// ──────────────────────────────── banners ────────────────────────────────

export async function saveBanner(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();

    const id = text(form, "id");
    const image = text(form, "image") || null;
    const ctaLink = text(form, "ctaLink") || null;

    // Only same-site paths or plain http(s) links — never javascript:/data:.
    if (ctaLink && !/^\/(?!\/)/.test(ctaLink) && !/^https?:\/\//i.test(ctaLink)) {
      return { error: "الرابط يجب أن يبدأ بـ / أو http(s)://" };
    }

    const data = {
      image,
      title: text(form, "title") || null,
      subtitle: text(form, "subtitle") || null,
      ctaText: text(form, "ctaText") || null,
      ctaLink,
      sortOrder: number(form, "sortOrder"),
      isActive: flag(form, "isActive"),
    };

    if (id) {
      const previous = await prisma.banner.findUnique({ where: { id }, select: { image: true } });
      await prisma.banner.update({ where: { id }, data });
      if (previous?.image && previous.image !== image) await removeUpload(previous.image);
    } else {
      await prisma.banner.create({ data });
    }

    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/saveBanner]", error);
    return { error: "تعذّر حفظ الإعلان" };
  }
}

export async function deleteBanner(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const id = text(form, "id");

    const banner = await prisma.banner.findUnique({ where: { id }, select: { image: true } });
    if (!banner) return { error: "الإعلان غير موجود" };

    await prisma.banner.delete({ where: { id } });
    await removeUpload(banner.image);

    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/deleteBanner]", error);
    return { error: "تعذّر حذف الإعلان" };
  }
}

export async function toggleBanner(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    await assertAdmin();
    const id = text(form, "id");
    const banner = await prisma.banner.findUnique({ where: { id }, select: { isActive: true } });
    if (!banner) return { error: "الإعلان غير موجود" };

    await prisma.banner.update({ where: { id }, data: { isActive: !banner.isActive } });
    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/toggleBanner]", error);
    return { error: "تعذّر تغيير الحالة" };
  }
}

// ───────────────────────── customer balance & discounts ─────────────────────────

/**
 * Credits or debits a wallet.
 *
 * The write is a single conditional UPDATE, so two admins acting at the same
 * moment cannot both read the old balance and overwrite each other: a debit
 * only succeeds while the row still holds enough, and the database — not this
 * code — decides the winner. Everything else (transaction row, audit entry)
 * happens inside the same database transaction, so a wallet can never move
 * without leaving a record.
 */
export async function adjustUserBalance(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const admin = await assertAdmin();

    const userId = text(form, "userId");
    const direction = text(form, "direction");
    const amount = toMinor(text(form, "amount"));
    const note = text(form, "note") || null;

    if (direction !== "credit" && direction !== "debit") return { error: "نوع العملية غير صالح" };
    if (!Number.isFinite(amount) || amount <= 0) return { error: "أدخل مبلغاً أكبر من صفر" };

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!target) return { error: "المستخدم غير موجود" };

    const outcome = await prisma.$transaction(async (tx) => {
      if (direction === "debit") {
        // Refuses to go negative, atomically.
        const changed = await tx.user.updateMany({
          where: { id: userId, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });
        if (changed.count !== 1) return { insufficient: true as const };
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { balance: { increment: amount } },
        });
      }

      const after = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { balance: true },
      });
      const signed = direction === "credit" ? amount : -amount;
      const before = after.balance - signed;

      await tx.transaction.create({
        data: {
          // A manual credit counts as a deposit, a manual debit as an order —
          // the customer sees one numbering rule, whoever moved the money.
          number: await nextNumber(tx, direction === "credit" ? "deposit" : "order"),
          userId,
          type: "ADJUSTMENT",
          amount: signed,
          balanceAfter: after.balance,
          description: note ?? (direction === "credit" ? "إضافة رصيد" : "خصم رصيد"),
          adminId: admin.id,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          targetUserId: userId,
          type: direction === "credit" ? "BALANCE_CREDIT" : "BALANCE_DEBIT",
          amount: signed,
          balanceBefore: before,
          balanceAfter: after.balance,
          note,
        },
      });

      return { insufficient: false as const };
    });

    if (outcome.insufficient) return { error: "رصيد المستخدم لا يكفي لهذا الخصم" };

    revalidatePath("/admin/users");
    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/adjustUserBalance]", error);
    return { error: "تعذّر تعديل الرصيد" };
  }
}

/**
 * Sets a customer's discount. An empty productId means the blanket rate, which
 * lives on the account itself; naming a product stores an override instead.
 */
export async function setUserDiscount(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin();

    const userId = text(form, "userId");
    const productId = text(form, "productId") || null;
    const percentBps = parsePercentToBps(text(form, "percent"));

    if (percentBps === null) {
      return { error: `النسبة يجب أن تكون بين 0 و ${MAX_DISCOUNT_BPS / 100}` };
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, discountBps: true },
    });
    if (!target) return { error: "المستخدم غير موجود" };

    let productName: string | null = null;
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { name: true },
      });
      if (!product) return { error: "المنتج غير موجود" };
      productName = product.name;
    }

    await prisma.$transaction(async (tx) => {
      let before: number;

      if (productId) {
        const previous = await tx.userDiscount.findUnique({
          where: { userId_productId: { userId, productId } },
          select: { percentBps: true },
        });
        before = previous?.percentBps ?? 0;

        await tx.userDiscount.upsert({
          where: { userId_productId: { userId, productId } },
          create: { userId, productId, percentBps },
          update: { percentBps },
        });
      } else {
        before = target.discountBps;
        await tx.user.update({ where: { id: userId }, data: { discountBps: percentBps } });
      }

      await tx.adminActionLog.create({
        data: {
          adminId: admin.id,
          targetUserId: userId,
          type: "DISCOUNT_SET",
          discountBeforeBps: before,
          discountAfterBps: percentBps,
          productId,
          productName,
        },
      });
    });

    revalidatePath("/admin/users");
    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/setUserDiscount]", error);
    return { error: "تعذّر حفظ الخصم" };
  }
}

/** Removes one per-product override, or resets the blanket rate to zero. */
export async function clearUserDiscount(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");

    // "global:<userId>" clears the account-level rate; otherwise it is a row id.
    if (id.startsWith("global:")) {
      const userId = id.slice("global:".length);
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { discountBps: true },
      });
      if (!target) return { error: "المستخدم غير موجود" };

      await prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: userId }, data: { discountBps: 0 } });
        await tx.adminActionLog.create({
          data: {
            adminId: admin.id,
            targetUserId: userId,
            type: "DISCOUNT_CLEAR",
            discountBeforeBps: target.discountBps,
            discountAfterBps: 0,
          },
        });
      });
    } else {
      const discount = await prisma.userDiscount.findUnique({
        where: { id },
        select: {
          userId: true,
          productId: true,
          percentBps: true,
          product: { select: { name: true } },
        },
      });
      if (!discount) return { error: "الخصم غير موجود" };

      await prisma.$transaction(async (tx) => {
        await tx.userDiscount.delete({ where: { id } });
        await tx.adminActionLog.create({
          data: {
            adminId: admin.id,
            targetUserId: discount.userId,
            type: "DISCOUNT_CLEAR",
            discountBeforeBps: discount.percentBps,
            discountAfterBps: 0,
            productId: discount.productId,
            productName: discount.product?.name ?? null,
          },
        });
      });
    }

    revalidatePath("/admin/users");
    refreshStorefront();
    return { ok: true };
  } catch (error) {
    console.error("[admin/clearUserDiscount]", error);
    return { error: "تعذّر إلغاء الخصم" };
  }
}
