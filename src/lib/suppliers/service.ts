import "server-only";

import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/suppliers/crypto";
import { getAdapter } from "@/lib/suppliers/adapters";
import { SupplierRequestError, sanitize } from "@/lib/suppliers/http";
import {
  DEFAULT_MARKUP_TYPE_KEY,
  DEFAULT_MARKUP_VALUE_KEY,
  NO_MARKUP,
  type MarkupRule,
} from "@/lib/suppliers/pricing";
import type { SupplierContext, SupplierCredentials, TestResult } from "@/lib/suppliers/types";
import type { MarkupType, SupplierAuditAction } from "@/generated/prisma/enums";

/**
 * Server-side supplier services: credential handling, connection testing and
 * the audit trail.
 *
 * Nothing in this file may be imported from a client component — `server-only`
 * enforces that at build time, which is what keeps API keys off the wire.
 */

/** The columns needed to talk to a supplier. Never widen this into a page prop. */
const CONTEXT_SELECT = {
  id: true,
  name: true,
  adapter: true,
  baseUrl: true,
  authType: true,
  secretCipher: true,
  currency: true,
  timeoutMs: true,
  environment: true,
} as const;

export function parseCredentials(cipher: string | null): SupplierCredentials {
  const plaintext = decryptSecret(cipher);
  if (!plaintext) return {};
  try {
    const parsed = JSON.parse(plaintext) as SupplierCredentials;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

type ContextRow = {
  id: string;
  name: string;
  adapter: string;
  baseUrl: string;
  authType: SupplierContext["authType"];
  secretCipher: string | null;
  currency: string;
  timeoutMs: number;
  environment: SupplierContext["environment"];
};

export function toContext(supplier: ContextRow): SupplierContext {
  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
    adapter: supplier.adapter,
    baseUrl: supplier.baseUrl,
    authType: supplier.authType,
    credentials: parseCredentials(supplier.secretCipher),
    currency: supplier.currency.toUpperCase(),
    timeoutMs: supplier.timeoutMs,
    environment: supplier.environment,
  };
}

/** Loads a supplier and opens its credential envelope. Null when unknown. */
export async function loadContext(supplierId: string): Promise<SupplierContext | null> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: CONTEXT_SELECT,
  });
  return supplier ? toContext(supplier) : null;
}

/** The store-wide fallback rule, read from `settings`. */
export async function getDefaultRule(): Promise<MarkupRule> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [DEFAULT_MARKUP_TYPE_KEY, DEFAULT_MARKUP_VALUE_KEY] } },
  });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const type = byKey.get(DEFAULT_MARKUP_TYPE_KEY);
  if (type !== "PERCENT" && type !== "FIXED" && type !== "NONE") return NO_MARKUP;

  const value = Number(byKey.get(DEFAULT_MARKUP_VALUE_KEY) ?? "0");
  return { type: type as MarkupType, value: Number.isFinite(value) ? value : 0 };
}

/**
 * Records an administrative action. Deliberately best-effort: an audit write
 * that fails must not roll back the change the admin actually asked for, but
 * it is logged loudly on the server so the gap is visible.
 */
export async function logSupplierAction(entry: {
  /** Null when the action came from a customer checkout rather than an admin. */
  adminId: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  action: SupplierAuditAction;
  detail?: string | null;
}): Promise<void> {
  try {
    await prisma.supplierAuditLog.create({
      data: {
        adminId: entry.adminId,
        supplierId: entry.supplierId ?? null,
        supplierName: entry.supplierName ?? null,
        action: entry.action,
        // Sanitized again at the boundary — a caller that forgot cannot leak.
        detail: entry.detail ? sanitize(entry.detail) : null,
      },
    });
  } catch (error) {
    console.error("[suppliers/audit]", error);
  }
}

/**
 * Verifies endpoint and credentials without importing anything.
 *
 * The result is stored on the supplier row so the Admin list can show a
 * connection state, and the message is sanitized on every path — including the
 * failure path, where a supplier's own error body is the likeliest place for a
 * key to show up.
 */
export async function testSupplierConnection(
  supplierId: string,
  adminId: string,
): Promise<TestResult> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: CONTEXT_SELECT,
  });
  if (!supplier) return { ok: false, message: "المزوّد غير موجود" };

  const adapter = getAdapter(supplier.adapter);
  if (!adapter) {
    return { ok: false, message: `نوع الربط "${supplier.adapter}" غير معروف` };
  }

  const context = toContext(supplier);
  let result: TestResult;

  try {
    result = await adapter.testConnection(context);
  } catch (error) {
    result = {
      ok: false,
      message:
        error instanceof SupplierRequestError
          ? error.adminMessage
          : `فشل الاتصال: ${sanitize(error, context)}`,
    };
  }

  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      lastTestAt: new Date(),
      lastTestOk: result.ok,
      lastTestMessage: sanitize(result.message, context),
    },
  });

  await logSupplierAction({
    adminId,
    supplierId,
    supplierName: supplier.name,
    action: "CONNECTION_TEST",
    detail: `${result.ok ? "نجح" : "فشل"} — ${result.message}`,
  });

  return { ...result, message: sanitize(result.message, context) };
}
