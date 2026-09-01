"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/db";
import { toMinor } from "@/lib/money";
import { slugify } from "@/lib/utils";
import { getAdapter } from "@/lib/suppliers/adapters";
import { encryptSecret, secretHint } from "@/lib/suppliers/crypto";
import {
  fulfilOrderItem,
  refreshSupplierOrderStatus,
  refundOrderItem,
} from "@/lib/suppliers/fulfilment";
import {
  importSupplierProducts,
  linkToExistingVariant,
  removeMapping,
  setPreferredMapping,
  setSelection,
} from "@/lib/suppliers/mapping";
import {
  DEFAULT_MARKUP_TYPE_KEY,
  DEFAULT_MARKUP_VALUE_KEY,
  clampMarkupBps,
  parseMarkupPercent,
  parseRateToMicros,
} from "@/lib/suppliers/pricing";
import { repriceVariants } from "@/lib/suppliers/repricing";
import { logSupplierAction, parseCredentials, testSupplierConnection } from "@/lib/suppliers/service";
import { syncSupplierCatalog } from "@/lib/suppliers/sync";
import type { SupplierCredentials } from "@/lib/suppliers/types";
import type {
  MarkupType,
  PriceMode,
  SupplierAuthType,
  SupplierEnvironment,
} from "@/generated/prisma/enums";

/**
 * Supplier administration.
 *
 * Every action starts with `assertAdmin()`. That is not belt-and-braces: server
 * actions are POST endpoints with public identifiers, so a customer session can
 * call one directly no matter what the UI renders. The check here — not the
 * navigation — is what makes supplier credentials unreachable.
 */

export type SupplierActionState = {
  ok?: boolean;
  error?: string;
  /** Success detail worth showing, e.g. a sync summary. */
  message?: string;
};

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function flag(form: FormData, key: string) {
  return form.get(key) === "on" || form.get(key) === "true";
}

function list(form: FormData, key: string): string[] {
  return form
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function refresh(supplierId?: string) {
  revalidatePath("/admin/suppliers");
  if (supplierId) {
    revalidatePath(`/admin/suppliers/${supplierId}`);
    revalidatePath(`/admin/suppliers/${supplierId}/catalog`);
  }
  // Prices and availability feed the storefront.
  revalidatePath("/", "layout");
}

/**
 * Reads a markup pair from a form. PERCENT is typed as a percentage and stored
 * as basis points; FIXED is typed in د.ل and stored in minor units — so the
 * database only ever holds integers.
 */
function readMarkup(
  form: FormData,
  prefix: string,
): { type: MarkupType | null; value: number } | { error: string } {
  const raw = text(form, `${prefix}Type`);
  if (!raw || raw === "INHERIT") return { type: null, value: 0 };
  if (raw !== "NONE" && raw !== "PERCENT" && raw !== "FIXED") return { error: "نوع الربح غير صالح" };

  if (raw === "NONE") return { type: "NONE", value: 0 };

  const input = text(form, `${prefix}Value`);
  if (raw === "PERCENT") {
    const bps = parseMarkupPercent(input || "0");
    if (bps === null) return { error: "نسبة الربح غير صالحة" };
    return { type: "PERCENT", value: clampMarkupBps(bps) };
  }

  const minor = toMinor(input || "0");
  if (!Number.isFinite(minor) || minor < 0) return { error: "مبلغ الربح غير صالح" };
  return { type: "FIXED", value: minor };
}

/** Ensures a unique supplier slug. */
async function uniqueSupplierSlug(desired: string, currentId?: string): Promise<string> {
  const base = slugify(desired) || "supplier";
  let candidate = base;
  let counter = 2;

  for (;;) {
    const existing = await prisma.supplier.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === currentId) return candidate;
    candidate = `${base}-${counter++}`;
  }
}

/** Custom headers, entered one `Name: value` per line. */
function parseHeaderLines(input: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of input.split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const name = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (name && value) headers[name] = value;
  }
  return headers;
}

// ──────────────────────────────── suppliers ────────────────────────────────

export async function saveSupplier(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();

    const id = text(form, "id");
    const name = text(form, "name");
    const adapter = text(form, "adapter");
    const baseUrl = text(form, "baseUrl");

    if (!name) return { error: "اسم المزوّد مطلوب" };
    if (!getAdapter(adapter)) return { error: "نوع الربط غير معروف" };
    if (!/^https?:\/\//i.test(baseUrl)) return { error: "رابط الـ API يجب أن يبدأ بـ http(s)://" };

    const definition = getAdapter(adapter)!;
    const adapterFields = definition.credentialFields ?? [];

    // An adapter that declares its own credentials owns authentication
    // entirely; the generic scheme dropdown is not shown for it and not read.
    const authTypeRaw = adapterFields.length > 0 ? "ADAPTER" : text(form, "authType") || "NONE";
    const authTypes: SupplierAuthType[] = [
      "NONE",
      "API_KEY_HEADER",
      "BEARER_TOKEN",
      "BASIC_AUTH",
      "QUERY_PARAM",
      "ADAPTER",
    ];
    if (!authTypes.includes(authTypeRaw as SupplierAuthType)) {
      return { error: "نوع المصادقة غير صالح" };
    }
    const authType = authTypeRaw as SupplierAuthType;

    const environment: SupplierEnvironment =
      text(form, "environment") === "PRODUCTION" ? "PRODUCTION" : "SANDBOX";

    const currency = (text(form, "currency") || "LYD").toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return { error: "رمز العملة يجب أن يكون 3 أحرف، مثل USD" };

    const rateInput = text(form, "rate");
    const rateMicros = rateInput ? parseRateToMicros(rateInput) : null;
    if (rateInput && rateMicros === null) return { error: "سعر الصرف غير صالح" };
    if (currency !== "LYD" && rateMicros === null) {
      // Refused rather than guessed — an invented rate silently mis-prices a
      // whole catalog.
      return { error: `أدخل سعر صرف ${currency} مقابل الدينار الليبي` };
    }

    const markup = readMarkup(form, "markup");
    if ("error" in markup) return { error: markup.error };

    const timeoutMs = Math.min(60_000, Math.max(2_000, Number(text(form, "timeoutMs")) || 15_000));

    // ── credentials ───────────────────────────────────────────────────────
    // Left blank on an edit means "keep what is stored": the browser is never
    // sent the current secret, so it cannot echo it back.
    const existing = id
      ? await prisma.supplier.findUnique({
          where: { id },
          select: { secretCipher: true, name: true },
        })
      : null;

    const credentials: SupplierCredentials = existing
      ? parseCredentials(existing.secretCipher)
      : {};

    const token = text(form, "token");
    const username = text(form, "username");
    const password = text(form, "password");
    const headerName = text(form, "headerName");
    const queryParam = text(form, "queryParam");
    const headerLines = text(form, "customHeaders");

    if (flag(form, "clearSecret")) {
      for (const key of Object.keys(credentials)) {
        delete credentials[key as keyof SupplierCredentials];
      }
    }

    if (token) credentials.token = token;
    if (username) credentials.username = username;
    if (password) credentials.password = password;
    credentials.headerName = headerName || credentials.headerName;
    credentials.queryParam = queryParam || credentials.queryParam;
    if (headerLines) credentials.headers = parseHeaderLines(headerLines);

    // Adapter-declared credentials, e.g. Libya Play's x-api-key / x-email.
    // A blank secret field means "keep the stored one", exactly as above.
    if (adapterFields.length > 0) {
      const fields = { ...(credentials.fields ?? {}) };

      for (const field of adapterFields) {
        const value = text(form, `cred_${field.name}`);
        if (value) fields[field.name] = value;
        else if (!field.secret) delete fields[field.name];
      }

      for (const field of adapterFields) {
        if (field.required && !fields[field.name]) {
          return { error: `الحقل "${field.label}" مطلوب لهذا المزوّد` };
        }
      }

      credentials.fields = fields;
    }

    const hasSecret = Boolean(
      credentials.token ||
        credentials.username ||
        credentials.password ||
        (credentials.headers && Object.keys(credentials.headers).length > 0) ||
        (credentials.fields && Object.keys(credentials.fields).length > 0),
    );

    const secretCipher = hasSecret ? encryptSecret(JSON.stringify(credentials)) : null;
    const primarySecret =
      credentials.token ??
      credentials.password ??
      adapterFields.find((field) => field.secret && credentials.fields?.[field.name])?.name;

    const hint = primarySecret
      ? secretHint(
          credentials.token ??
            credentials.password ??
            credentials.fields?.[primarySecret] ??
            "",
        )
      : null;

    if (authType !== "NONE" && !hasSecret) {
      return { error: "أدخل بيانات الاعتماد المطلوبة لنوع المصادقة المختار" };
    }

    const data = {
      name,
      slug: await uniqueSupplierSlug(text(form, "slug") || name, id || undefined),
      adapter,
      baseUrl,
      authType,
      secretCipher,
      secretHint: hint,
      currency,
      rateMicros,
      environment,
      markupType: (markup.type ?? "PERCENT") as MarkupType,
      markupValue: markup.value,
      status: flag(form, "isActive") ? ("ACTIVE" as const) : ("DISABLED" as const),
      notes: text(form, "notes") || null,
      timeoutMs,
    };

    let supplierId = id;

    if (id) {
      await prisma.supplier.update({ where: { id }, data });
      // A changed markup or rate must reach existing automatic prices at once.
      await repriceVariants({ supplierId: id });
    } else {
      const created = await prisma.supplier.create({ data, select: { id: true } });
      supplierId = created.id;
    }

    await logSupplierAction({
      adminId: admin.id,
      supplierId,
      supplierName: name,
      action: id ? "SUPPLIER_UPDATE" : "SUPPLIER_CREATE",
      detail: `${name} · ${adapter} · ${currency}`,
    });

    refresh(supplierId);
    return { ok: true, message: id ? "تم حفظ المزوّد" : "تم إنشاء المزوّد" };
  } catch (error) {
    console.error("[admin/saveSupplier]", error);
    return { error: "تعذّر حفظ المزوّد" };
  }
}

export async function toggleSupplier(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: { status: true, name: true },
    });
    if (!supplier) return { error: "المزوّد غير موجود" };

    const next = supplier.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await prisma.supplier.update({ where: { id }, data: { status: next } });

    await logSupplierAction({
      adminId: admin.id,
      supplierId: id,
      supplierName: supplier.name,
      action: next === "ACTIVE" ? "SUPPLIER_ENABLE" : "SUPPLIER_DISABLE",
    });

    refresh(id);
    return { ok: true };
  } catch (error) {
    console.error("[admin/toggleSupplier]", error);
    return { error: "تعذّر تغيير حالة المزوّد" };
  }
}

/**
 * Deletes a supplier, its mirrored catalog and its mappings.
 *
 * Local products and variants survive: they simply stop being supplier-backed
 * and keep the price they had. Deleting a supplier must not delete a shelf.
 */
export async function deleteSupplier(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      select: { name: true },
    });
    if (!supplier) return { error: "المزوّد غير موجود" };

    await prisma.supplier.delete({ where: { id } });

    await logSupplierAction({
      adminId: admin.id,
      supplierId: null,
      supplierName: supplier.name,
      action: "SUPPLIER_DELETE",
      detail: supplier.name,
    });

    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[admin/deleteSupplier]", error);
    return { error: "تعذّر حذف المزوّد" };
  }
}

export async function testSupplier(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");

    const result = await testSupplierConnection(id, admin.id);
    refresh(id);

    return result.ok
      ? { ok: true, message: describeFacts(result.message, result.facts) }
      : { error: result.message };
  } catch (error) {
    console.error("[admin/testSupplier]", error);
    return { error: "تعذّر اختبار الاتصال" };
  }
}

function describeFacts(message: string, facts?: Record<string, string | number>): string {
  if (!facts || Object.keys(facts).length === 0) return message;
  const parts = Object.entries(facts).map(([key, value]) => `${key}: ${value}`);
  return `${message} — ${parts.join(" · ")}`;
}

export async function syncSupplier(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");
    // Empty for single-catalog adapters; Libya Play passes "digital" or "social".
    const kind = text(form, "kind") || undefined;

    const result = await syncSupplierCatalog(id, admin.id, kind);
    refresh(id);

    return result.outcome === "FAILED"
      ? { error: result.message }
      : { ok: true, message: result.message };
  } catch (error) {
    console.error("[admin/syncSupplier]", error);
    return { error: "تعذّرت المزامنة" };
  }
}

// ───────────────────────────── catalog selection ─────────────────────────────

export async function updateSelection(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const supplierId = text(form, "supplierId");
    const ids = list(form, "ids");
    const selected = text(form, "selected") === "true";

    if (ids.length === 0) return { error: "لم يتم اختيار أي عنصر" };

    const count = await setSelection({
      supplierId,
      supplierProductIds: ids,
      selected,
      adminId: admin.id,
    });

    refresh(supplierId);
    return { ok: true, message: `${selected ? "تم تحديد" : "تم إلغاء تحديد"} ${count} عنصراً` };
  } catch (error) {
    console.error("[admin/updateSelection]", error);
    return { error: "تعذّر تحديث التحديد" };
  }
}

export async function importSelection(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const supplierId = text(form, "supplierId");
    const ids = list(form, "ids");
    if (ids.length === 0) return { error: "لم يتم اختيار أي عنصر" };

    const priceModeRaw = text(form, "priceMode") || "AUTO";
    const priceMode: PriceMode = priceModeRaw === "MANUAL" ? "MANUAL" : "AUTO";

    // The batch may carry its own profit rule, so one selection can be imported
    // at a percentage and the next at a flat amount.
    const markup = readMarkup(form, "markup");
    if ("error" in markup) return { error: markup.error };

    const result = await importSupplierProducts({
      supplierId,
      supplierProductIds: ids,
      adminId: admin.id,
      targetProductId: text(form, "targetProductId") || null,
      categoryId: text(form, "categoryId") || null,
      priceMode,
      markupType: markup.type,
      markupValue: markup.value,
      activate: flag(form, "activate"),
    });

    refresh(supplierId);

    const parts = [`${result.createdVariants} فئة سعرية`];
    if (result.createdProducts > 0) parts.push(`${result.createdProducts} منتج جديد`);
    if (result.skipped > 0) parts.push(`${result.skipped} مرتبط مسبقاً`);
    if (result.unpriced > 0) parts.push(`${result.unpriced} بلا سعر`);

    if (result.createdVariants === 0 && result.errors.length > 0) {
      return { error: result.errors[0] };
    }

    return {
      ok: true,
      message: `تم الاستيراد: ${parts.join(" · ")}${
        result.errors.length > 0 ? ` — ${result.errors[0]}` : ""
      }`,
    };
  } catch (error) {
    console.error("[admin/importSelection]", error);
    return { error: "تعذّر الاستيراد" };
  }
}

export async function linkExistingVariant(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();

    const result = await linkToExistingVariant({
      supplierProductId: text(form, "supplierProductId"),
      variantId: text(form, "variantId"),
      adminId: admin.id,
      makePreferred: flag(form, "makePreferred"),
    });

    if (!result.ok) return { error: result.error ?? "تعذّر الربط" };

    await repriceVariants({ variantIds: [text(form, "variantId")] });
    refresh(text(form, "supplierId"));
    return { ok: true, message: "تم الربط" };
  } catch (error) {
    console.error("[admin/linkExistingVariant]", error);
    return { error: "تعذّر الربط" };
  }
}

// ──────────────────────────────── mappings ────────────────────────────────

export async function makePreferred(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");

    const result = await setPreferredMapping(id, admin.id);
    if (!result.ok) return { error: result.error ?? "تعذّر التغيير" };

    const mapping = await prisma.productSupplierMapping.findUnique({
      where: { id },
      select: { variantId: true, supplierId: true },
    });
    if (mapping) await repriceVariants({ variantIds: [mapping.variantId] });

    refresh(mapping?.supplierId);
    return { ok: true };
  } catch (error) {
    console.error("[admin/makePreferred]", error);
    return { error: "تعذّر تغيير المزوّد المعتمد" };
  }
}

export async function toggleMapping(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    await assertAdmin();
    const id = text(form, "id");

    const mapping = await prisma.productSupplierMapping.findUnique({
      where: { id },
      select: { isEnabled: true, supplierId: true },
    });
    if (!mapping) return { error: "الربط غير موجود" };

    await prisma.productSupplierMapping.update({
      where: { id },
      data: { isEnabled: !mapping.isEnabled },
    });

    refresh(mapping.supplierId);
    return { ok: true };
  } catch (error) {
    console.error("[admin/toggleMapping]", error);
    return { error: "تعذّر تغيير الحالة" };
  }
}

export async function unlinkMapping(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");

    const mapping = await prisma.productSupplierMapping.findUnique({
      where: { id },
      select: { supplierId: true },
    });

    const result = await removeMapping(id, admin.id);
    if (!result.ok) return { error: result.error ?? "تعذّر إلغاء الربط" };

    refresh(mapping?.supplierId);
    return { ok: true };
  } catch (error) {
    console.error("[admin/unlinkMapping]", error);
    return { error: "تعذّر إلغاء الربط" };
  }
}

// ───────────────────────────────── pricing ─────────────────────────────────

/** The store-wide fallback rule, used when nothing narrower is set. */
export async function saveDefaultMarkup(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();

    const markup = readMarkup(form, "markup");
    if ("error" in markup) return { error: markup.error };

    const type = markup.type ?? "NONE";

    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: DEFAULT_MARKUP_TYPE_KEY },
        create: { key: DEFAULT_MARKUP_TYPE_KEY, value: type },
        update: { value: type },
      }),
      prisma.setting.upsert({
        where: { key: DEFAULT_MARKUP_VALUE_KEY },
        create: { key: DEFAULT_MARKUP_VALUE_KEY, value: String(markup.value) },
        update: { value: String(markup.value) },
      }),
    ]);

    // Every AUTO variant that was falling back to the default now moves.
    const outcome = await repriceVariants({});

    await logSupplierAction({
      adminId: admin.id,
      action: "PRICING_CHANGE",
      detail: `القاعدة الافتراضية: ${type} ${markup.value} · ${outcome.repriced} سعر`,
    });

    refresh();
    return { ok: true, message: `تم الحفظ — أُعيد احتساب ${outcome.repriced} سعراً` };
  } catch (error) {
    console.error("[admin/saveDefaultMarkup]", error);
    return { error: "تعذّر حفظ القاعدة الافتراضية" };
  }
}

/** Product-level rule: applies to every AUTO variant under one product. */
export async function saveProductMarkup(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const productId = text(form, "productId");

    const markup = readMarkup(form, "markup");
    if ("error" in markup) return { error: markup.error };

    const product = await prisma.product.update({
      where: { id: productId },
      data: { markupType: markup.type, markupValue: markup.type ? markup.value : null },
      select: { name: true, variants: { select: { id: true } } },
    });

    const outcome = await repriceVariants({
      variantIds: product.variants.map((variant) => variant.id),
    });

    await logSupplierAction({
      adminId: admin.id,
      action: "PRICING_CHANGE",
      detail: `قاعدة المنتج "${product.name}": ${markup.type ?? "وراثة"} · ${outcome.repriced} سعر`,
    });

    revalidatePath(`/admin/products/${productId}`);
    refresh();
    return { ok: true, message: `تم الحفظ — أُعيد احتساب ${outcome.repriced} سعراً` };
  } catch (error) {
    console.error("[admin/saveProductMarkup]", error);
    return { error: "تعذّر حفظ قاعدة المنتج" };
  }
}

/**
 * Variant-level pricing: the narrowest control, and the one that decides
 * whether sync may touch this price at all.
 */
export async function saveVariantPricing(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const variantId = text(form, "variantId");

    const markup = readMarkup(form, "markup");
    if ("error" in markup) return { error: markup.error };

    const priceMode: PriceMode = text(form, "priceMode") === "MANUAL" ? "MANUAL" : "AUTO";

    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        priceMode,
        markupType: markup.type,
        markupValue: markup.type ? markup.value : null,
      },
      select: { id: true, name: true, productId: true },
    });

    const outcome = await repriceVariants({ variantIds: [variantId] });

    await logSupplierAction({
      adminId: admin.id,
      action: "PRICING_CHANGE",
      detail: `تسعير الفئة "${variant.name}": ${priceMode} · ${markup.type ?? "وراثة"}`,
    });

    revalidatePath(`/admin/products/${variant.productId}`);
    refresh();
    return {
      ok: true,
      message:
        priceMode === "MANUAL"
          ? "تم الحفظ — السعر يدوي ولن تغيّره المزامنة"
          : `تم الحفظ — أُعيد احتساب ${outcome.repriced} سعراً`,
    };
  } catch (error) {
    console.error("[admin/saveVariantPricing]", error);
    return { error: "تعذّر حفظ تسعير الفئة" };
  }
}

// ───────────────────────────── supplier purchasing ─────────────────────────────

/**
 * Fulfils one order line from its preferred supplier.
 *
 * The heavy lifting — the duplicate claim, the idempotency key, the refund
 * decision — lives in `fulfilment.ts`; this wrapper only checks the caller is
 * an admin and turns the outcome into a form state.
 */
export async function fulfilItem(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();

    const orderItemId = text(form, "orderItemId");
    if (!orderItemId) return { error: "بند الطلب غير محدد" };

    // Dynamic customer inputs arrive as param_<name> so they cannot collide
    // with the form's own fields.
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (key.startsWith("param_") && typeof value === "string") {
        params[key.slice("param_".length)] = value;
      }
    }

    const quantityRaw = Number(text(form, "quantity"));
    const result = await fulfilOrderItem({
      orderItemId,
      adminId: admin.id,
      params,
      quantity: Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : undefined,
    });

    refresh(text(form, "supplierId") || undefined);
    revalidatePath("/admin/orders");

    return result.status === "COMPLETED" || result.status === "PROCESSING"
      ? { ok: true, message: result.message }
      : { error: result.message };
  } catch (error) {
    console.error("[admin/fulfilItem]", error);
    return { error: "تعذّر تنفيذ البند" };
  }
}

/** Pulls the current status of a placed supplier order. Admin-triggered only. */
export async function refreshOrderStatus(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");

    const result = await refreshSupplierOrderStatus(id, admin.id);
    refresh(text(form, "supplierId") || undefined);

    return { ok: true, message: result.message };
  } catch (error) {
    console.error("[admin/refreshOrderStatus]", error);
    return { error: "تعذّر تحديث الحالة" };
  }
}

/** Reverses the customer's wallet debit for a line the supplier could not fill. */
export async function refundItem(
  _state: SupplierActionState,
  form: FormData,
): Promise<SupplierActionState> {
  try {
    const admin = await assertAdmin();
    const id = text(form, "id");

    const result = await refundOrderItem(id, admin.id);
    refresh(text(form, "supplierId") || undefined);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/users");

    return result.ok ? { ok: true, message: result.message } : { error: result.message };
  } catch (error) {
    console.error("[admin/refundItem]", error);
    return { error: "تعذّر تنفيذ الاسترجاع" };
  }
}
