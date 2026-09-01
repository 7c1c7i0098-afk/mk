import "server-only";

import { SupplierRequestError } from "@/lib/suppliers/http";
import type {
  CatalogResult,
  RawCatalogItem,
  SupplierAdapter,
  SupplierContext,
  TestResult,
} from "@/lib/suppliers/types";

/**
 * An offline supplier for rehearsing the whole flow — connect, test, fetch a
 * large catalog, select a handful, publish — without a real contract or a real
 * API key. It makes no network call at all.
 *
 * It also lets failure handling be exercised on purpose: put `fail` in the base
 * URL to make every call error, or `flaky` to make availability come back as an
 * unrecognised status the mapper must treat as UNKNOWN.
 */

const CATEGORIES = ["ألعاب", "بطاقات هدايا", "اشتراكات", "شحن رصيد"];
const BRANDS = [
  "PUBG",
  "Free Fire",
  "Steam",
  "iTunes",
  "Google Play",
  "Netflix",
  "Spotify",
  "Roblox",
  "Xbox",
  "PlayStation",
];
const DENOMINATIONS = [5, 10, 25, 50, 100];

/** Deterministic pseudo-random so a re-sync returns the same catalog. */
function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index++) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

function buildCatalog(context: SupplierContext): RawCatalogItem[] {
  const seed = hash(context.supplierId || context.baseUrl);
  const flaky = /flaky/i.test(context.baseUrl);
  const items: RawCatalogItem[] = [];

  for (let index = 0; index < BRANDS.length; index++) {
    const brand = BRANDS[index];
    const productId = `SB-${(seed % 900) + index + 100}`;
    const category = CATEGORIES[(seed + index) % CATEGORIES.length];

    for (const face of DENOMINATIONS) {
      const roll = (seed + index * 7 + face) % 10;
      const availability =
        flaky && roll === 3 ? "UNKNOWN" : roll === 0 ? "UNAVAILABLE" : "AVAILABLE";

      items.push({
        externalProductId: productId,
        externalVariantId: `${productId}-${face}`,
        name: `${brand} ${face}`,
        category,
        variantLabel: `${face} ${context.currency}`,
        // Cost sits a little under face value, as a wholesale price would.
        cost: face * 100 - (roll * 25 + 50),
        currency: context.currency,
        availability,
        rawAvailability:
          availability === "UNKNOWN" ? "pending_supplier_check" : availability.toLowerCase(),
      });
    }
  }

  return items;
}

export const sandboxAdapter: SupplierAdapter = {
  key: "sandbox",
  label: "مزوّد تجريبي (بدون اتصال)",
  description:
    "كتالوج وهمي للتجربة والاختبار — لا يُجري أي اتصال شبكي. أضف كلمة fail إلى الرابط لمحاكاة عطل، أو flaky لمحاكاة حالات توفّر غير معروفة.",
  catalogPathHint: "لا يُستخدم",

  async testConnection(context: SupplierContext): Promise<TestResult> {
    if (/fail/i.test(context.baseUrl)) {
      throw new SupplierRequestError("محاكاة عطل: المزوّد التجريبي مضبوط على الفشل");
    }
    return {
      ok: true,
      message: "المزوّد التجريبي جاهز",
      facts: { "عناصر": buildCatalog(context).length },
    };
  },

  async fetchCatalog(context: SupplierContext): Promise<CatalogResult> {
    if (/fail/i.test(context.baseUrl)) {
      throw new SupplierRequestError("محاكاة عطل: المزوّد التجريبي مضبوط على الفشل");
    }
    return { items: buildCatalog(context), skipped: 0 };
  },
};
