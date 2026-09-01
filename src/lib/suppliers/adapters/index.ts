import "server-only";

import { genericJsonAdapter } from "@/lib/suppliers/adapters/generic-json";
import { libyaPlayAdapter } from "@/lib/suppliers/adapters/libyaplay";
import { sandboxAdapter } from "@/lib/suppliers/adapters/sandbox";
import type { SupplierAdapter } from "@/lib/suppliers/types";

/**
 * The adapter registry.
 *
 * Adding a supplier whose API nobody anticipated is a three-step change:
 *   1. write `src/lib/suppliers/adapters/<name>.ts` exporting a SupplierAdapter,
 *   2. add it to the array below,
 *   3. pick it from the "نوع الربط" dropdown when creating the supplier.
 *
 * Nothing else — schema, sync, pricing, Admin — needs to know it exists.
 * `key` is persisted in `Supplier.adapter`, so renaming one orphans every
 * supplier already using it; add a new key instead.
 */
const ADAPTERS: SupplierAdapter[] = [libyaPlayAdapter, genericJsonAdapter, sandboxAdapter];

const BY_KEY = new Map(ADAPTERS.map((adapter) => [adapter.key, adapter]));

export function getAdapter(key: string): SupplierAdapter | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Safe to send to the Admin UI: keys, labels and the shape of the form to
 * render — never behaviour, and never a credential.
 */
export function listAdapters() {
  return ADAPTERS.map((adapter) => ({
    key: adapter.key,
    label: adapter.label,
    description: adapter.description,
    catalogPathHint: adapter.catalogPathHint ?? null,
    defaultBaseUrl: adapter.defaultBaseUrl ?? null,
    credentialFields: adapter.credentialFields ?? [],
    supportsEnvironments: adapter.supportsEnvironments ?? false,
    catalogKinds: adapter.catalogKinds ?? [],
    canPurchase: typeof adapter.purchase === "function",
  }));
}

export type AdapterSummary = ReturnType<typeof listAdapters>[number];
