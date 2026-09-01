import "server-only";

import { randomUUID } from "node:crypto";
import { toMinor } from "@/lib/money";
import { SupplierRequestError, sanitize, supplierFetch } from "@/lib/suppliers/http";
import type {
  CatalogResult,
  ParamField,
  PurchaseOutcome,
  PurchaseRequest,
  RawCatalogItem,
  StatusResult,
  SupplierAdapter,
  SupplierContext,
  TestResult,
} from "@/lib/suppliers/types";
import type { SupplierAvailability } from "@/generated/prisma/enums";

/**
 * Libya Play — https://api.libyaplay.com/portal
 *
 * Written against the published documentation at libyaplay.apidog.io, whose
 * two halves behave quite differently:
 *
 *   • **Digital** — gift-card products. `GET /digital-products/show-products`
 *     returns a *bare array*; prices are decimal strings; `available` is 0/1;
 *     `currency_code` is the Arabic sign "د.ل" rather than an ISO code. The
 *     purchase endpoint is **form-encoded**, not JSON, and answers with the
 *     goods themselves.
 *
 *   • **Social** — services bought by quantity. `GET /social/products` is a
 *     Laravel paginator nested at `data.data`; each product carries a `params`
 *     array naming the customer inputs it needs, `qty_values` bounds, and its
 *     own `currency_code` / `exchange_rate` pair. The purchase endpoint is
 *     JSON, completes asynchronously, and deduplicates on `order_uuid`.
 *
 * Statuses are the provider's four: pending, wait, accept, reject.
 */

const APP_INFO_PATH = "general/app-info";
const DIGITAL_CATALOG_PATH = "digital-products/show-products";
const DIGITAL_PAYMENT_PATH = "digital-products/payment";
const SOCIAL_CATALOG_PATH = "social/products";
const SOCIAL_PAY_PATH = "social/pay";
const SOCIAL_ORDERS_PATH = "social/orders";

/** Hard stop on paging, so a broken paginator cannot loop forever. */
const MAX_PAGES = 50;

// ─────────────────────────────── field readers ───────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
}

function asInt(value: unknown): number | null {
  const parsed = Number(asString(value));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/**
 * Money as the provider sends it: `"1.275999999999999"`, `8.29`, `"0"`.
 * Returns minor units, or null when unreadable — a cost we cannot parse must
 * never become a free product.
 */
function parseCost(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? toMinor(value) : null;
  }
  if (typeof value !== "string") return null;

  const cleaned = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return toMinor(parsed);
}

/**
 * The provider reports currency inconsistently: digital products carry the
 * Arabic sign "د.ل", social products an internal code ("NAB") alongside a
 * sign. Anything that is recognisably the Libyan dinar becomes LYD so the
 * pricing engine sees the store's own currency and needs no exchange rate.
 */
const DINAR_TOKENS = ["د.ل", "دل", "lyd", "ليبي", "دينار", "محفظة مصرف"];

function normaliseCurrency(raw: unknown, fallback: string): string {
  const value = asString(raw);
  if (!value) return fallback;

  const lowered = value.trim().toLowerCase();
  if (DINAR_TOKENS.some((token) => lowered.includes(token.toLowerCase()))) return "LYD";

  // A genuine code passes through; anything else falls back rather than
  // becoming a currency the pricing engine cannot reason about.
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : fallback;
}

/**
 * `available` is 0/1 on digital products and a boolean on social ones.
 * Anything unrecognised stays UNKNOWN, which blocks a sale.
 */
function parseAvailability(value: unknown): SupplierAvailability {
  if (value === undefined || value === null) return "UNKNOWN";
  if (typeof value === "boolean") return value ? "AVAILABLE" : "UNAVAILABLE";
  if (typeof value === "number") {
    if (value > 0) return "AVAILABLE";
    if (value === 0) return "UNAVAILABLE";
    return "UNKNOWN";
  }
  if (typeof value !== "string") return "UNKNOWN";

  const word = value.trim().toLowerCase();
  if (["1", "true", "available", "active", "yes"].includes(word)) return "AVAILABLE";
  if (["0", "false", "unavailable", "inactive", "no"].includes(word)) return "UNAVAILABLE";
  return "UNKNOWN";
}

/** Unwraps `{ status, data: [...] }`, `{ status, data: { data: [...] } }`, or a bare array. */
function extractList(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) return payload.filter(isRecord);

  if (isRecord(payload)) {
    const data = payload.data;
    if (Array.isArray(data)) return data.filter(isRecord);
    if (isRecord(data) && Array.isArray(data.data)) return data.data.filter(isRecord);
  }

  return null;
}

/** The Laravel paginator block, which sits at `data` for this provider. */
function extractPagination(payload: unknown): { currentPage: number; lastPage: number } | null {
  const source = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(source)) return null;

  const currentPage = asInt(source.current_page);
  if (currentPage === null) return null;

  return { currentPage, lastPage: asInt(source.last_page) ?? currentPage };
}

/** The provider's error text lives in `data` when the call failed. */
function readMessage(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    // On failure `data` is a string message rather than the usual object.
    const data = payload.data;
    if (typeof data === "string" && data.trim()) return sanitize(data);
    const message = asString(pick(payload, ["message", "error", "msg", "detail"]));
    if (message) return sanitize(message);
  }
  return fallback;
}

// ───────────────────────────── digital products ─────────────────────────────

/**
 * Digital products may carry `likecard_option_feilds` — the provider's own
 * spelling — describing inputs the customer must supply, e.g. a player id.
 * `likecard_option_exist` flags their presence.
 */
function readDigitalParamFields(source: Record<string, unknown>): ParamField[] {
  const raw = source.likecard_option_feilds ?? source.likecard_option_fields;
  if (!Array.isArray(raw)) return [];

  const fields: ParamField[] = [];

  for (const entry of raw) {
    if (!isRecord(entry)) continue;

    // `fieldCode` is what the purchase call expects back; fall back to the id.
    const name = asString(pick(entry, ["fieldCode", "optionalFieldID", "id"]));
    if (!name) continue;

    fields.push({
      name,
      label: asString(pick(entry, ["label", "hint"])) ?? name,
      type: asInt(entry.fieldTypeId) === 2 ? "number" : "text",
      // `required` arrives as 0/1; absent is treated as required, because
      // under-collecting fails the purchase while over-collecting costs a
      // keystroke.
      required: entry.required === undefined ? true : parseAvailability(entry.required) !== "UNAVAILABLE",
      placeholder: asString(pick(entry, ["hint", "defaultValue"])),
      minLength: null,
      maxLength: null,
    });
  }

  return fields;
}

function readDigitalItem(source: Record<string, unknown>): RawCatalogItem | null {
  const id = asString(source.id);
  const name = asString(source.name);
  const cost = parseCost(source.price);
  if (!id || !name || cost === null) return null;

  return {
    externalProductId: id,
    // Digital products are bought by product id alone.
    externalVariantId: "",
    name,
    // `pro_type` (digt / auto) is the only grouping the flat feed offers.
    category: asString(pick(source, ["pro_type", "subCategoyID"])),
    variantLabel: null,
    cost,
    currency: normaliseCurrency(source.currency_code, "LYD"),
    availability: parseAvailability(source.available),
    rawAvailability: asString(source.available),
    productType: "DIGITAL",
    paramFields: readDigitalParamFields(source),
  };
}

// ────────────────────────────── social products ──────────────────────────────

/**
 * Social products declare their required inputs as a bare array of names,
 * e.g. `["معرف_المستخدم"]`. The name is sent back verbatim inside `params`.
 */
function readSocialParamFields(source: Record<string, unknown>): ParamField[] {
  const raw = source.params;
  if (!Array.isArray(raw)) return [];

  const fields: ParamField[] = [];

  for (const entry of raw) {
    if (typeof entry === "string" && entry.trim()) {
      fields.push({
        name: entry.trim(),
        // The provider's own name is already the customer-facing label.
        label: entry.trim().replace(/_/g, " "),
        type: "text",
        required: true,
      });
      continue;
    }
    if (!isRecord(entry)) continue;

    const name = asString(pick(entry, ["name", "key", "field"]));
    if (!name) continue;
    fields.push({
      name,
      label: asString(pick(entry, ["label", "title"])) ?? name.replace(/_/g, " "),
      type: "text",
      required: true,
    });
  }

  return fields;
}

function readSocialItem(source: Record<string, unknown>): RawCatalogItem | null {
  const id = asString(source.id);
  const name = asString(source.name);
  // `final_price` is what we are actually charged; `selling_price` is the
  // pre-discount figure and only a fallback.
  const rawCost = parseCost(pick(source, ["final_price", "selling_price"]));
  if (!id || !name || rawCost === null) return null;

  const signCurrency = normaliseCurrency(source.currency_sign, "");
  const codeCurrency = normaliseCurrency(source.currency_code, "LYD");
  const rate = Number(asString(source.exchange_rate) ?? "");

  // The provider quotes social prices in an internal unit (currency_code
  // "NAB") and publishes the rate to its display currency on the same record.
  // Applying the provider's own published number is not an invented rate; it
  // is theirs, and it is what keeps these items priceable. When no rate is
  // given, the raw cost and its code are stored untouched and the pricing
  // engine will refuse to price them until an admin configures a rate.
  const converted =
    signCurrency && signCurrency !== codeCurrency && Number.isFinite(rate) && rate > 0
      ? { cost: Math.round(rawCost * rate), currency: signCurrency }
      : { cost: rawCost, currency: codeCurrency };

  const qtyValues = isRecord(source.qty_values) ? source.qty_values : {};

  return {
    externalProductId: id,
    externalVariantId: "",
    name,
    category: asString(pick(source, ["category_name", "product_type"])),
    variantLabel: null,
    cost: converted.cost,
    currency: converted.currency,
    availability: parseAvailability(source.available),
    rawAvailability: asString(source.available),
    productType: "SOCIAL",
    paramFields: readSocialParamFields(source),
    // Bounds arrive as strings inside `qty_values`.
    minQty: asInt(qtyValues.min),
    maxQty: asInt(qtyValues.max),
  };
}

// ───────────────────────────────── requests ─────────────────────────────────

/** The provider's two auth headers, read fresh from the encrypted bag. */
function authHeaders(context: SupplierContext): Record<string, string> {
  const fields = context.credentials.fields ?? {};
  const headers: Record<string, string> = {};
  if (fields.apiKey) headers["x-api-key"] = fields.apiKey;
  if (fields.email) headers["x-email"] = fields.email;
  return headers;
}

function assertConfigured(context: SupplierContext) {
  const fields = context.credentials.fields ?? {};
  if (!fields.apiKey || !fields.email) {
    throw new SupplierRequestError("أدخل x-api-key و x-email للمزوّد قبل الاتصال");
  }
}

function envToken(context: SupplierContext): string {
  return context.environment === "PRODUCTION" ? "production" : "sandbox";
}

/** Strips anything secret-shaped before a response is stored for Admin. */
function sanitizeSnapshot(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {};

  const SECRET_KEYS = ["secretnumber", "serialnumber", "code", "pin", "password", "token", "apikey"];

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SECRET_KEYS.includes(key.toLowerCase().replace(/[_-]/g, ""))) {
      output[key] = "[محجوب]";
    } else if (isRecord(value)) {
      output[key] = sanitizeSnapshot(value);
    } else if (Array.isArray(value)) {
      output[key] = `[${value.length} عنصراً]`;
    } else {
      output[key] = value;
    }
  }
  return output;
}

/**
 * The provider's four order states.
 *
 * `accept` is the only one that means delivered. `reject` is a definite
 * failure. `pending` and `wait` are still in flight — and anything else stays
 * UNKNOWN rather than being read as success.
 */
function mapSocialStatus(raw: string | null): "COMPLETED" | "PROCESSING" | "FAILED" | "UNKNOWN" {
  if (!raw) return "UNKNOWN";
  const word = raw.trim().toLowerCase();

  if (["accept", "accepted", "completed", "success", "done"].includes(word)) return "COMPLETED";
  if (["reject", "rejected", "failed", "cancelled", "canceled"].includes(word)) return "FAILED";
  if (["pending", "wait", "waiting", "processing", "in_progress"].includes(word)) return "PROCESSING";
  return "UNKNOWN";
}

// ───────────────────────────────── adapter ─────────────────────────────────

export const libyaPlayAdapter: SupplierAdapter = {
  key: "libyaplay",
  label: "Libya Play",
  description:
    "مزوّد ليبيا بلاي — كتالوجان منفصلان: المنتجات الرقمية (بطاقات وأكواد) وخدمات السوشيال التي تحتاج مدخلات من العميل.",
  defaultBaseUrl: "https://api.libyaplay.com/portal",
  catalogPathHint: "/digital-products/show-products و /social/products",
  supportsEnvironments: true,

  credentialFields: [
    {
      name: "apiKey",
      label: "x-api-key",
      secret: true,
      required: true,
      hint: "مفتاح الحساب لدى ليبيا بلاي — يُخزَّن مشفّراً ولا يُعاد إلى المتصفّح",
    },
    {
      name: "email",
      label: "x-email",
      secret: false,
      required: true,
      placeholder: "account@example.com",
      hint: "البريد المرتبط بحساب ليبيا بلاي",
    },
  ],

  catalogKinds: [
    { key: "digital", label: "المنتجات الرقمية", productType: "DIGITAL" },
    { key: "social", label: "خدمات السوشيال", productType: "SOCIAL" },
  ],

  async testConnection(context: SupplierContext): Promise<TestResult> {
    assertConfigured(context);

    // Read-only by design: verifying credentials must never spend money.
    const response = await supplierFetch(context, APP_INFO_PATH, {
      headers: authHeaders(context),
    });

    const payload = response.json;
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
    const appName = asString(data.app_name);
    const maintenance = asInt(data.maintenance);

    if (maintenance === 1) {
      return {
        ok: false,
        message: "المزوّد في وضع الصيانة حالياً",
        facts: { status: response.status },
      };
    }

    return {
      ok: true,
      message: "تم الاتصال بـ Libya Play بنجاح",
      facts: {
        status: response.status,
        "البيئة": envToken(context),
        ...(appName ? { "التطبيق": appName } : {}),
      },
    };
  },

  async fetchCatalog(context: SupplierContext, kind?: string): Promise<CatalogResult> {
    assertConfigured(context);

    if (kind === "social") return fetchSocialCatalog(context);

    // Only `digt` is fetched here. The provider also accepts `pro_type=auto`,
    // but that feed returns the *social* services in a reduced shape — the
    // same ids, without category or exchange rate — so it is a strictly worse
    // source for them than /social/products, and is deliberately not synced.
    return fetchDigitalCatalog(context, "digt");
  },

  async purchase(context: SupplierContext, request: PurchaseRequest): Promise<PurchaseOutcome> {
    assertConfigured(context);

    return request.productType === "SOCIAL"
      ? purchaseSocial(context, request)
      : purchaseDigital(context, request);
  },

  /**
   * Resolves a social order's fate.
   *
   * `GET /social/orders` takes no lookup parameter, so the order is found by
   * walking the paginator and matching the provider's own order id — which is
   * why the id from the purchase response is persisted. `order_uuid` is our
   * idempotency key, not a queryable field.
   */
  async orderStatus(context, reference): Promise<StatusResult> {
    assertConfigured(context);

    if (!reference.externalOrderId) {
      return { status: "UNKNOWN", message: "لا يوجد رقم طلب لدى المزوّد للاستعلام عنه" };
    }

    try {
      for (let page = 1; page <= MAX_PAGES; page++) {
        const response = await supplierFetch(context, SOCIAL_ORDERS_PATH, {
          headers: authHeaders(context),
          query: { page },
        });

        const list = extractList(response.json) ?? [];
        const match = list.find(
          (row) =>
            asString(row.id) === reference.externalOrderId ||
            asString(row.external_id) === reference.externalOrderId,
        );

        if (match) {
          const raw = asString(match.status);
          return {
            status: mapSocialStatus(raw),
            externalStatus: raw,
            snapshot: sanitizeSnapshot(match),
          };
        }

        const pagination = extractPagination(response.json);
        if (!pagination || page >= pagination.lastPage) break;
      }

      return { status: "UNKNOWN", message: "لم يُعثر على الطلب في قائمة طلبات المزوّد" };
    } catch (error) {
      return {
        status: "UNKNOWN",
        message:
          error instanceof SupplierRequestError ? error.adminMessage : sanitize(error, context),
      };
    }
  },
};

// ────────────────────────────── catalog fetching ──────────────────────────────

async function fetchDigitalCatalog(
  context: SupplierContext,
  proType: "digt" | "auto",
): Promise<CatalogResult> {
  const response = await supplierFetch(context, DIGITAL_CATALOG_PATH, {
    headers: authHeaders(context),
    query: { pro_type: proType },
  });

  const list = extractList(response.json);
  if (!list) throw new SupplierRequestError("لم يتم العثور على قائمة المنتجات الرقمية في الردّ");

  const items: RawCatalogItem[] = [];
  let skipped = 0;

  for (const row of list) {
    const item = readDigitalItem(row);
    if (item) items.push(item);
    else skipped++;
  }

  return { items, skipped };
}

/**
 * Walks the social paginator.
 *
 * `page` is sent explicitly rather than following `next_page_url`, so a
 * malformed absolute URL from the provider cannot redirect us off-host.
 * Paging stops at `last_page`, an empty page, or MAX_PAGES.
 */
async function fetchSocialCatalog(context: SupplierContext): Promise<CatalogResult> {
  const items: RawCatalogItem[] = [];
  let skipped = 0;
  let page = 1;
  let lastPage = 1;

  do {
    const response = await supplierFetch(context, SOCIAL_CATALOG_PATH, {
      headers: authHeaders(context),
      query: { page },
    });

    const list = extractList(response.json);
    if (!list) {
      if (page === 1) throw new SupplierRequestError("لم يتم العثور على قائمة خدمات السوشيال");
      break;
    }
    if (list.length === 0) break;

    for (const row of list) {
      const item = readSocialItem(row);
      if (item) items.push(item);
      else skipped++;
    }

    lastPage = extractPagination(response.json)?.lastPage ?? page;
    page++;
  } while (page <= lastPage && page <= MAX_PAGES);

  return { items, skipped };
}

// ───────────────────────────────── purchasing ─────────────────────────────────

/**
 * Digital purchase — `POST /digital-products/payment`, form-encoded.
 *
 * The response carries the goods, so the secret is lifted out and returned
 * separately from the snapshot that gets stored; the snapshot is redacted.
 */
async function purchaseDigital(
  context: SupplierContext,
  request: PurchaseRequest,
): Promise<PurchaseOutcome> {
  try {
    // `optionalFields` is documented as an array of strings, so declared
    // inputs are flattened to key, value, key, value.
    const optionalFields = Object.entries(request.params).flatMap(([key, value]) => [key, value]);

    const response = await supplierFetch(context, DIGITAL_PAYMENT_PATH, {
      method: "POST",
      headers: authHeaders(context),
      form: {
        productID: request.externalProductId,
        env: envToken(context),
        ...(optionalFields.length > 0 ? { "optionalFields[]": optionalFields } : {}),
      },
    });

    const payload = response.json;
    const ok = isRecord(payload) ? payload.status === true : false;
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};

    const code = asString(data.secretNumber);
    const serial = asString(data.serialNumber);
    const expiresAt = asString(data.exp_date);

    // A 200 that carries no goods is not a success. Marking an unfulfilled
    // line complete is the one mistake that cannot be undone.
    if (!ok || (!code && !serial)) {
      return {
        status: "FAILED",
        message: readMessage(payload, "ردّ المزوّد لا يحتوي على بيانات البطاقة"),
        retryable: false,
        snapshot: sanitizeSnapshot(payload),
      };
    }

    return {
      status: "COMPLETED",
      externalOrderId: null,
      externalStatus: "accept",
      secret: { code, serial, expiresAt },
      snapshot: sanitizeSnapshot(payload),
    };
  } catch (error) {
    return purchaseFailure(error, context);
  }
}

/**
 * Social purchase — `POST /social/pay`, JSON.
 *
 * `order_uuid` comes from the caller, which committed it before the first
 * attempt. Re-sending it after a timeout asks the provider to return the
 * original order instead of placing a second one; its `idempotent` flag
 * confirms that it did.
 */
async function purchaseSocial(
  context: SupplierContext,
  request: PurchaseRequest,
): Promise<PurchaseOutcome> {
  try {
    const response = await supplierFetch(context, SOCIAL_PAY_PATH, {
      method: "POST",
      headers: authHeaders(context),
      body: {
        // The provider types product ids as integers here.
        product_id: Number(request.externalProductId) || request.externalProductId,
        qty: request.quantity,
        params: request.params,
        order_uuid: request.orderUuid,
        env: envToken(context),
      },
    });

    const payload = response.json;
    const ok = isRecord(payload) ? payload.status === true : false;
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};

    if (!ok) {
      return {
        status: "FAILED",
        message: readMessage(payload, "رفض المزوّد الطلب"),
        retryable: false,
        snapshot: sanitizeSnapshot(payload),
      };
    }

    const rawStatus = asString(data.status);
    const mapped = mapSocialStatus(rawStatus);
    // The order id is what the status endpoint can be searched by later.
    const externalOrderId = asString(data.order_id) ?? asString(data.external_id);

    if (mapped === "FAILED") {
      return {
        status: "FAILED",
        externalOrderId,
        externalStatus: rawStatus,
        message: readMessage(payload, "رفض المزوّد الطلب"),
        retryable: false,
        snapshot: sanitizeSnapshot(payload),
      };
    }

    // "wait" and "pending" — and anything unrecognised — stay in flight, to be
    // resolved by a status refresh rather than assumed either way.
    return {
      status: mapped === "COMPLETED" ? "COMPLETED" : "PROCESSING",
      externalOrderId,
      externalStatus: rawStatus,
      snapshot: sanitizeSnapshot(payload),
    };
  } catch (error) {
    return purchaseFailure(error, context);
  }
}

/** Maps the documented status codes onto retry and review decisions. */
function purchaseFailure(error: unknown, context: SupplierContext): PurchaseOutcome {
  if (error instanceof SupplierRequestError) {
    // 400 is the *supplier's* wallet being short, never the customer's.
    if (error.status === 400) {
      return {
        status: "FAILED",
        message: "تعذّر الشراء من المزوّد — راجع رصيد حساب المزوّد",
        retryable: false,
        supplierBalanceShort: true,
      };
    }
    // 422 is a rejected request body: a stale mapping or a missing field.
    if (error.status === 422) {
      return {
        status: "FAILED",
        message: "بيانات الطلب مرفوضة من المزوّد — أعد المزامنة وتحقّق من الحقول المطلوبة",
        retryable: false,
      };
    }
    return {
      status: "FAILED",
      message: error.adminMessage,
      // A timeout or 5xx may have succeeded upstream, so this is reconciled
      // rather than blindly re-charged.
      retryable: error.status === null || error.status >= 500 || error.status === 429,
    };
  }

  return { status: "FAILED", message: sanitize(error, context), retryable: false };
}

/** Fresh idempotency key for a social order. */
export function newOrderUuid(): string {
  return randomUUID();
}
