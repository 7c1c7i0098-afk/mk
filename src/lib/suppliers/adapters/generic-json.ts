import "server-only";

import { toMinor } from "@/lib/money";
import { SupplierRequestError, supplierFetch } from "@/lib/suppliers/http";
import type {
  CatalogResult,
  RawCatalogItem,
  SupplierAdapter,
  SupplierContext,
  TestResult,
} from "@/lib/suppliers/types";
import type { SupplierAvailability } from "@/generated/prisma/enums";

/**
 * The default adapter: a tolerant reader for the "list of products, each with
 * denominations" JSON that most gift-card wholesalers expose.
 *
 * It is deliberately forgiving about field names — `id`/`product_id`/`sku`,
 * `price`/`cost`/`wholesale_price`, and so on — because that covers the
 * majority of suppliers without any code. A supplier whose shape it cannot
 * read gets its own adapter file instead of another special case in here.
 */

const CATALOG_PATH = "products";

/** Reads the first present key, ignoring blanks. */
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

/**
 * Money as sent by a supplier: `9.99`, `"9.99"`, `"9,99"`, `"$9.99"`.
 * Returns minor units, or null when the value cannot be trusted — a cost we
 * cannot read must never silently become zero and then a free product.
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

const AVAILABLE_WORDS = ["available", "in_stock", "instock", "active", "enabled", "yes", "1", "on"];
const UNAVAILABLE_WORDS = [
  "unavailable",
  "out_of_stock",
  "outofstock",
  "sold_out",
  "soldout",
  "inactive",
  "disabled",
  "no",
  "0",
  "off",
];

/**
 * Maps a supplier's status to our three-valued availability.
 *
 * Anything unrecognised becomes UNKNOWN, never AVAILABLE. Guessing "probably
 * fine" here is what sells a card the supplier cannot deliver.
 */
function parseAvailability(value: unknown): SupplierAvailability {
  if (typeof value === "boolean") return value ? "AVAILABLE" : "UNAVAILABLE";
  if (typeof value === "number") {
    if (value > 0) return "AVAILABLE";
    if (value === 0) return "UNAVAILABLE";
    return "UNKNOWN";
  }
  if (typeof value !== "string") return "UNKNOWN";

  const word = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (AVAILABLE_WORDS.includes(word)) return "AVAILABLE";
  if (UNAVAILABLE_WORDS.includes(word)) return "UNAVAILABLE";
  return "UNKNOWN";
}

/** Finds the product array wherever the supplier decided to put it. */
function extractList(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) return payload.filter(isRecord);

  if (isRecord(payload)) {
    for (const key of ["data", "products", "items", "result", "results", "catalog"]) {
      const candidate = payload[key];
      if (Array.isArray(candidate)) return candidate.filter(isRecord);
      // One level of nesting, e.g. { data: { products: [...] } }
      if (isRecord(candidate)) {
        for (const inner of ["products", "items", "data", "list"]) {
          const nested = candidate[inner];
          if (Array.isArray(nested)) return nested.filter(isRecord);
        }
      }
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readVariants(product: Record<string, unknown>): Record<string, unknown>[] {
  for (const key of ["variants", "denominations", "options", "items", "values", "packages"]) {
    const candidate = product[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return [];
}

/** Turns one supplier product (with or without variants) into catalog lines. */
function toItems(
  product: Record<string, unknown>,
  fallbackCurrency: string,
): { items: RawCatalogItem[]; skipped: number } {
  const productId = asString(pick(product, ["id", "product_id", "productId", "sku", "code"]));
  const name = asString(pick(product, ["name", "title", "product_name", "productName", "label"]));
  if (!productId || !name) return { items: [], skipped: 1 };

  const category = asString(pick(product, ["category", "category_name", "group", "type"]));
  const productAvailability = pick(product, [
    "availability",
    "status",
    "available",
    "in_stock",
    "inStock",
    "stock_status",
  ]);
  const currency =
    asString(pick(product, ["currency", "currency_code", "currencyCode"]))?.toUpperCase() ??
    fallbackCurrency;

  const variants = readVariants(product);

  // No variant array: the product itself is the sellable line.
  if (variants.length === 0) {
    const cost = parseCost(
      pick(product, ["cost", "price", "wholesale_price", "wholesalePrice", "amount", "net_price"]),
    );
    if (cost === null) return { items: [], skipped: 1 };

    return {
      items: [
        {
          externalProductId: productId,
          externalVariantId: "",
          name,
          category,
          variantLabel: asString(pick(product, ["value", "denomination", "face_value"])),
          cost,
          currency,
          availability: parseAvailability(productAvailability),
          rawAvailability: asString(productAvailability),
        },
      ],
      skipped: 0,
    };
  }

  const items: RawCatalogItem[] = [];
  let skipped = 0;

  for (const variant of variants) {
    const variantId = asString(
      pick(variant, ["id", "variant_id", "variantId", "sku", "code", "denomination"]),
    );
    const cost = parseCost(
      pick(variant, ["cost", "price", "wholesale_price", "wholesalePrice", "amount", "net_price"]),
    );
    if (!variantId || cost === null) {
      skipped++;
      continue;
    }

    const label =
      asString(pick(variant, ["value", "denomination", "face_value", "faceValue", "label"])) ??
      asString(pick(variant, ["name", "title"]));

    const rawStatus = pick(variant, [
      "availability",
      "status",
      "available",
      "in_stock",
      "inStock",
      "stock_status",
    ]);

    items.push({
      externalProductId: productId,
      externalVariantId: variantId,
      name: asString(pick(variant, ["name", "title"])) ?? (label ? `${name} — ${label}` : name),
      category,
      variantLabel: label,
      cost,
      currency:
        asString(pick(variant, ["currency", "currency_code"]))?.toUpperCase() ?? currency,
      // A variant with no status of its own inherits the product's.
      availability: parseAvailability(rawStatus ?? productAvailability),
      rawAvailability: asString(rawStatus ?? productAvailability),
    });
  }

  return { items, skipped };
}

export const genericJsonAdapter: SupplierAdapter = {
  key: "generic-json",
  label: "JSON عام (REST)",
  description:
    "يقرأ قائمة منتجات JSON من المسار /products ويتعرّف تلقائياً على الحقول الشائعة (id، name، price، variants، status).",
  catalogPathHint: "/products",

  async testConnection(context: SupplierContext): Promise<TestResult> {
    const response = await supplierFetch(context, CATALOG_PATH);
    const list = extractList(response.json);

    if (!list) {
      return {
        ok: false,
        message: "تم الاتصال، لكن لم يتم العثور على قائمة منتجات في ردّ المزوّد",
        facts: { status: response.status },
      };
    }

    return {
      ok: true,
      message: "تم الاتصال بالمزوّد بنجاح",
      // Deliberately counts only — no product data is echoed into the log.
      facts: { status: response.status, "عناصر": list.length },
    };
  },

  async fetchCatalog(context: SupplierContext): Promise<CatalogResult> {
    const response = await supplierFetch(context, CATALOG_PATH);
    const list = extractList(response.json);
    if (!list) throw new SupplierRequestError("لم يتم العثور على قائمة منتجات في ردّ المزوّد");

    const items: RawCatalogItem[] = [];
    let skipped = 0;

    for (const product of list) {
      const result = toItems(product, context.currency);
      items.push(...result.items);
      skipped += result.skipped;
    }

    return { items, skipped };
  },
};
