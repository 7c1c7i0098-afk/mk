import type { PaymentMethodKind } from "@/generated/prisma/enums";

/**
 * Top-up fee arithmetic.
 *
 * Pure functions with no database import, mirroring `src/lib/pricing.ts`, so the
 * figure the sheet shows a customer and the figure the server freezes onto the
 * request are produced by the same code. Everything is in minor units.
 */

/** A fee of more than 50% is a typo, not a policy. */
export const MAX_FEE_BPS = 5_000;

export type FeeRule = {
  /** Percentage of the amount, in basis points (250 = 2.5%). */
  feeBps: number;
  /** Flat amount added on top, in minor units. */
  feeFixed: number;
};

export type TopUpQuote = {
  /** What the customer pays through the rail. */
  amount: number;
  /** What the rail takes. */
  fee: number;
  /** What reaches the wallet. Never negative. */
  credited: number;
};

export function clampFeeBps(bps: number): number {
  if (!Number.isFinite(bps)) return 0;
  return Math.min(Math.max(Math.round(bps), 0), MAX_FEE_BPS);
}

/**
 * Splits a paid amount into fee and credit.
 *
 * The fee is rounded *down* so rounding never quietly costs the customer a
 * dirham, and the credit can never go below zero however the rule is set.
 */
export function quoteTopUp(amount: number, rule: FeeRule): TopUpQuote {
  const paid = Math.max(0, Math.round(amount));
  const percentPart = Math.floor((paid * clampFeeBps(rule.feeBps)) / 10_000);
  const fee = Math.min(paid, percentPart + Math.max(0, Math.round(rule.feeFixed)));

  return { amount: paid, fee, credited: paid - fee };
}

/** "2.5" -> 250 bps. Null when the input is unusable. */
export function parseFeePercent(input: string): number | null {
  const value = Number(String(input).trim() || "0");
  if (!Number.isFinite(value) || value < 0) return null;
  const bps = Math.round(value * 100);
  return bps > MAX_FEE_BPS ? null : bps;
}

/** 250 -> "2.5%" */
export function formatFeeBps(bps: number): string {
  const percent = clampFeeBps(bps) / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKind, string> = {
  BANK_CARD: "بطاقة مصرفية",
  EDFALI: "إدفع لي",
  MASARIF_PAY: "مصرفي باي",
  YUSR_PAY: "يسر باي",
  BANK_TRANSFER: "تحويل مصرفي",
  CRYPTO: "عملات رقمية",
  OTHER: "أخرى",
};

/** The rails PLUS CARD ships with, offered as one-click setup in Admin. */
export const DEFAULT_METHODS: {
  name: string;
  kind: PaymentMethodKind;
  description: string;
}[] = [
  { name: "بطاقة مصرفية", kind: "BANK_CARD", description: "الدفع ببطاقة محلية" },
  { name: "إدفع لي", kind: "EDFALI", description: "تحويل عبر تطبيق إدفع لي" },
  { name: "مصرفي باي", kind: "MASARIF_PAY", description: "تحويل عبر مصرفي باي" },
  { name: "يسر باي", kind: "YUSR_PAY", description: "تحويل عبر يسر باي" },
  { name: "تحويل مصرفي", kind: "BANK_TRANSFER", description: "حوالة إلى الحساب البنكي" },
  { name: "WPay Crypto", kind: "CRYPTO", description: "الدفع بالعملات الرقمية" },
];

/**
 * Crypto rails quote in their own unit, so the rate that converts it into
 * dinars is shown beside the name — "WPay (Crypto) — الصرف (8.1)". Stored as
 * micros for the same reason every other rate in PLUS CARD is: integers do not
 * drift.
 */
export function parseExchangeRate(input: string): number | null {
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 1_000_000);
}

/** 8_100_000 -> "8.1" */
export function formatExchangeRate(micros: number | null | undefined): string {
  if (!micros || micros <= 0) return "";
  return String(Number((micros / 1_000_000).toFixed(6)));
}
