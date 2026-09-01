import type { MarkupType, PriceMode } from "@/generated/prisma/enums";

/**
 * Supplier pricing — the arithmetic half.
 *
 * Pure functions with no database import, mirroring `src/lib/pricing.ts`, so
 * the Admin price preview in the browser and the sync job on the server agree
 * to the minor unit. Everything here works in minor units of the base currency
 * (0.01 د.ل), exactly like the rest of PLUS CARD.
 *
 * ── Precedence, in one place ────────────────────────────────────────────────
 *   1. Variant manual price   (variant.priceMode = MANUAL)  → sync never moves it
 *   2. Variant markup rule    (variant.markupType)
 *   3. Product markup rule    (product.markupType)
 *   4. Supplier markup rule   (supplier.markupType)
 *   5. Global default rule    (settings: pricing.default.*)
 * The first level that is set wins outright; levels do not stack.
 */

/** Everything in the database is quoted in this currency. */
export const BASE_CURRENCY = "LYD";

/** Setting keys holding the store-wide fallback rule. */
export const DEFAULT_MARKUP_TYPE_KEY = "pricing.default.markupType";
export const DEFAULT_MARKUP_VALUE_KEY = "pricing.default.markupValue";

/** A markup of +500% is almost certainly a typo, so the input is capped. */
export const MAX_MARKUP_BPS = 50_000;

export type MarkupRule = { type: MarkupType; value: number };

export const NO_MARKUP: MarkupRule = { type: "NONE", value: 0 };

/** Where the winning rule came from — shown to the admin in the preview. */
export type RuleSource = "VARIANT" | "PRODUCT" | "SUPPLIER" | "DEFAULT";

export const RULE_SOURCE_LABELS: Record<RuleSource, string> = {
  VARIANT: "قاعدة الفئة السعرية",
  PRODUCT: "قاعدة المنتج",
  SUPPLIER: "قاعدة المزوّد",
  DEFAULT: "القاعدة الافتراضية",
};

export const MARKUP_TYPE_LABELS: Record<MarkupType, string> = {
  NONE: "بدون ربح",
  PERCENT: "نسبة مئوية",
  FIXED: "مبلغ ثابت",
};

export function clampMarkupBps(bps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.min(Math.max(Math.round(bps), 0), MAX_MARKUP_BPS);
}

/** "15" -> 1500 bps. Returns null when the input is unusable. */
export function parseMarkupPercent(input: string): number | null {
  const value = Number(String(input).trim());
  if (!Number.isFinite(value) || value < 0) return null;
  const bps = Math.round(value * 100);
  return bps > MAX_MARKUP_BPS ? null : bps;
}

/** 1500 -> "15%" */
export function formatMarkupBps(bps: number): string {
  const percent = clampMarkupBps(bps) / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

/** Normalises a nullable rule pair coming out of the database. */
export function toRule(type: MarkupType | null, value: number | null): MarkupRule | null {
  if (!type) return null;
  return { type, value: value ?? 0 };
}

/**
 * Picks the rule that applies, narrowest first. Returns the source too, so the
 * preview can tell the admin *why* a price is what it is.
 */
export function resolveRule(levels: {
  variant?: MarkupRule | null;
  product?: MarkupRule | null;
  supplier?: MarkupRule | null;
  fallback?: MarkupRule | null;
}): { rule: MarkupRule; source: RuleSource } {
  if (levels.variant) return { rule: levels.variant, source: "VARIANT" };
  if (levels.product) return { rule: levels.product, source: "PRODUCT" };
  if (levels.supplier) return { rule: levels.supplier, source: "SUPPLIER" };
  return { rule: levels.fallback ?? NO_MARKUP, source: "DEFAULT" };
}

/**
 * Converts a supplier cost into base-currency minor units.
 *
 * Returns null when a conversion is needed and no rate has been configured.
 * We never invent a rate: an unpriceable item stays unpriced and the admin is
 * told, rather than the store quietly selling at a number nobody chose.
 */
export function convertToBase(
  cost: number,
  currency: string,
  rateMicros: number | null | undefined,
): number | null {
  if (currency.toUpperCase() === BASE_CURRENCY) return cost;
  if (!rateMicros || rateMicros <= 0) return null;
  return Math.round((cost * rateMicros) / 1_000_000);
}

/** Applies one rule to a base-currency cost. Never returns a negative price. */
export function applyMarkup(baseCost: number, rule: MarkupRule): number {
  switch (rule.type) {
    case "PERCENT":
      return Math.max(0, Math.round((baseCost * (10_000 + clampMarkupBps(rule.value))) / 10_000));
    case "FIXED":
      return Math.max(0, baseCost + Math.round(rule.value));
    default:
      return Math.max(0, baseCost);
  }
}

export type PriceInputs = {
  /** Supplier cost, in minor units of `supplierCurrency`. */
  supplierCost: number;
  supplierCurrency: string;
  rateMicros: number | null;
  priceMode: PriceMode;
  /** The price currently stored on the variant. */
  currentPrice: number;
  variantRule?: MarkupRule | null;
  productRule?: MarkupRule | null;
  supplierRule?: MarkupRule | null;
  defaultRule?: MarkupRule | null;
};

export type PriceQuote = {
  /** False when nothing can be computed — the reason says why. */
  ok: boolean;
  /** Cost after currency conversion, in base minor units. Null when unknown. */
  baseCost: number | null;
  rule: MarkupRule;
  source: RuleSource;
  /** Profit added on top of cost, in base minor units. */
  markupAmount: number;
  /** What the customer would pay. Falls back to the stored price when !ok. */
  finalPrice: number;
  /** True when the variant's price is admin-owned and sync must not touch it. */
  manual: boolean;
  /** Arabic explanation for the admin when ok is false. */
  reason?: string;
};

/**
 * The whole pricing decision for one variant, in one call. Used by the Admin
 * preview, the import step and every sync, so all three cannot disagree.
 */
export function quotePrice(inputs: PriceInputs): PriceQuote {
  const { rule, source } = resolveRule({
    variant: inputs.variantRule,
    product: inputs.productRule,
    supplier: inputs.supplierRule,
    fallback: inputs.defaultRule,
  });

  const baseCost = convertToBase(inputs.supplierCost, inputs.supplierCurrency, inputs.rateMicros);

  if (inputs.priceMode === "MANUAL") {
    return {
      ok: true,
      baseCost,
      rule,
      source,
      markupAmount: baseCost === null ? 0 : inputs.currentPrice - baseCost,
      finalPrice: inputs.currentPrice,
      manual: true,
    };
  }

  if (baseCost === null) {
    return {
      ok: false,
      baseCost: null,
      rule,
      source,
      markupAmount: 0,
      finalPrice: inputs.currentPrice,
      manual: false,
      reason: `لا يوجد سعر صرف مضبوط لتحويل ${inputs.supplierCurrency.toUpperCase()} إلى ${BASE_CURRENCY}`,
    };
  }

  const finalPrice = applyMarkup(baseCost, rule);

  return {
    ok: true,
    baseCost,
    rule,
    source,
    markupAmount: finalPrice - baseCost,
    finalPrice,
    manual: false,
  };
}

/** "1.35" -> 1_350_000 micros, for the admin's exchange-rate input. */
export function parseRateToMicros(input: string): number | null {
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 1_000_000);
}

/** 1_350_000 -> "1.35" */
export function formatRate(micros: number | null | undefined): string {
  if (!micros || micros <= 0) return "";
  return String(micros / 1_000_000);
}
