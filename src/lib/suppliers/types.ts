import type {
  SupplierAuthType,
  SupplierAvailability,
  SupplierEnvironment,
  SupplierProductType,
} from "@/generated/prisma/enums";

/**
 * The contract every supplier integration implements.
 *
 * Different companies expose wildly different APIs, so nothing above this file
 * knows about endpoints or JSON shapes: Admin, sync and pricing all speak in
 * `RawCatalogItem`. Adding a supplier that nobody anticipated means writing one
 * adapter and registering it — no schema change, no UI change.
 */

/** The secret bag, as stored (encrypted) in `Supplier.secretCipher`. */
export type SupplierCredentials = {
  /** API key / bearer token / query-parameter value. */
  token?: string;
  username?: string;
  password?: string;
  /** Header name for API_KEY_HEADER, e.g. "X-API-Key". */
  headerName?: string;
  /** Query parameter name for QUERY_PARAM, e.g. "api_key". */
  queryParam?: string;
  /** Extra headers a supplier requires; treated as secret because they often carry one. */
  headers?: Record<string, string>;
  /**
   * Adapter-specific credentials, keyed by `CredentialField.name`.
   * Libya Play keeps its `x-api-key` and `x-email` here.
   */
  fields?: Record<string, string>;
};

/**
 * A credential input an adapter needs and the generic form cannot guess.
 *
 * Declaring them here rather than adding columns keeps a bespoke provider —
 * two custom headers, an account email, a merchant id — from leaking its shape
 * into the schema and the shared Admin form.
 */
export type CredentialField = {
  /** Key inside `SupplierCredentials.fields`. */
  name: string;
  label: string;
  /** Secret fields are write-only: masked after saving, never sent to the browser. */
  secret: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: string;
};

/** A separately syncable slice of one supplier's catalog. */
export type CatalogKind = {
  /** Passed back to `fetchCatalog`; also stored on each row it produces. */
  key: string;
  label: string;
  productType: SupplierProductType;
};

/** Everything an adapter needs for one call. Assembled server-side only. */
export type SupplierContext = {
  supplierId: string;
  supplierName: string;
  adapter: string;
  baseUrl: string;
  authType: SupplierAuthType;
  credentials: SupplierCredentials;
  currency: string;
  timeoutMs: number;
  environment: SupplierEnvironment;
};

/**
 * One catalog line as the adapter understood it.
 *
 * `cost` is in minor units of `currency` — the adapter is responsible for
 * turning whatever the supplier sent ("9.99", 999, "9,99 USD") into an integer.
 */
export type RawCatalogItem = {
  externalProductId: string;
  /** "" when the supplier has no variant concept below the product. */
  externalVariantId: string;
  name: string;
  category?: string | null;
  variantLabel?: string | null;
  cost: number;
  currency: string;
  availability: SupplierAvailability;
  /** The supplier's own status text, kept for diagnosis. */
  rawAvailability?: string | null;
  productType?: SupplierProductType;
  /** Customer inputs this item needs at purchase time (Social products). */
  paramFields?: ParamField[];
  minQty?: number | null;
  maxQty?: number | null;
};

/**
 * A field the customer must fill for this specific supplier product — a PUBG
 * player id, a page link, a phone number. Stored per catalog row because two
 * products from the same supplier rarely need the same inputs.
 */
export type ParamField = {
  name: string;
  label: string;
  type: "text" | "number" | "email" | "url" | "tel";
  required: boolean;
  placeholder?: string | null;
  /** Server-side length guards; a supplier that states them is honoured. */
  minLength?: number | null;
  maxLength?: number | null;
};

export type TestResult = {
  ok: boolean;
  /** Arabic, admin-facing, and always sanitized. */
  message: string;
  /** Optional extra facts, e.g. { items: 512, status: 200 } — never a secret. */
  facts?: Record<string, string | number>;
};

export type CatalogResult = {
  items: RawCatalogItem[];
  /** Rows the adapter had to drop; counted as failures in the sync log. */
  skipped: number;
};

/** What the fulfilment layer hands an adapter to buy one line. */
export type PurchaseRequest = {
  externalProductId: string;
  externalVariantId: string;
  quantity: number;
  /** Validated customer inputs, keyed by `ParamField.name`. */
  params: Record<string, string>;
  /**
   * Stable id generated and persisted *before* the first attempt, reused on
   * every retry of the same line. This is what makes a retry safe.
   */
  orderUuid: string;
  productType: SupplierProductType;
};

export type PurchaseOutcome =
  /** The supplier delivered; `credentials` holds what the customer receives. */
  | {
      status: "COMPLETED";
      externalOrderId?: string | null;
      externalStatus?: string | null;
      /** Gift-card secret, serial and expiry. Never logged. */
      secret?: { code?: string | null; serial?: string | null; expiresAt?: string | null };
      /** Sanitized snapshot for the admin record. */
      snapshot?: Record<string, unknown>;
    }
  /** Accepted but not finished — Social orders usually land here first. */
  | {
      status: "PROCESSING";
      externalOrderId?: string | null;
      externalStatus?: string | null;
      snapshot?: Record<string, unknown>;
    }
  /** The supplier refused. `retryable` decides whether a retry is sane. */
  | {
      status: "FAILED";
      externalOrderId?: string | null;
      externalStatus?: string | null;
      /** Arabic, sanitized, admin-facing. */
      message: string;
      retryable: boolean;
      /** True when the supplier's own wallet is short — an admin problem. */
      supplierBalanceShort?: boolean;
      snapshot?: Record<string, unknown>;
    };

export type StatusResult = {
  status: "COMPLETED" | "PROCESSING" | "FAILED" | "UNKNOWN";
  externalStatus?: string | null;
  message?: string;
  snapshot?: Record<string, unknown>;
};

export type SupplierAdapter = {
  /** Stored in `Supplier.adapter`. Stable — renaming one orphans suppliers. */
  key: string;
  /** Shown in the Admin dropdown. */
  label: string;
  /** One line of guidance under the dropdown. */
  description: string;
  /** Path appended to the base URL by default, shown as a hint in Admin. */
  catalogPathHint?: string;
  /** Default base URL offered in Admin for a known provider. */
  defaultBaseUrl?: string;
  /** Adapter-specific credential inputs, rendered by the supplier form. */
  credentialFields?: CredentialField[];
  /** True when the provider distinguishes sandbox from production. */
  supportsEnvironments?: boolean;
  /** Separately syncable catalog slices; omitted means one unnamed catalog. */
  catalogKinds?: CatalogKind[];

  testConnection(context: SupplierContext): Promise<TestResult>;
  /** `kind` is one of `catalogKinds[].key`, or undefined for single-catalog adapters. */
  fetchCatalog(context: SupplierContext, kind?: string): Promise<CatalogResult>;

  /** Present only on adapters that can actually buy. */
  purchase?(context: SupplierContext, request: PurchaseRequest): Promise<PurchaseOutcome>;
  /** Present only on adapters that can report on a placed order. */
  orderStatus?(
    context: SupplierContext,
    reference: { externalOrderId?: string | null; orderUuid: string },
  ): Promise<StatusResult>;
};

export const AUTH_TYPE_LABELS: Record<SupplierAuthType, string> = {
  NONE: "بدون مصادقة",
  API_KEY_HEADER: "مفتاح في ترويسة مخصّصة",
  BEARER_TOKEN: "Bearer Token",
  BASIC_AUTH: "اسم مستخدم وكلمة مرور",
  QUERY_PARAM: "مفتاح في رابط الطلب",
  ADAPTER: "تحدّده حقول المزوّد",
};

export const AVAILABILITY_LABELS: Record<SupplierAvailability, string> = {
  AVAILABLE: "متوفر",
  UNAVAILABLE: "غير متوفر",
  UNKNOWN: "غير معروف",
};

export const PRODUCT_TYPE_LABELS: Record<SupplierProductType, string> = {
  GENERIC: "عام",
  DIGITAL: "رقمي",
  SOCIAL: "خدمات",
};

export const ENVIRONMENT_LABELS: Record<SupplierEnvironment, string> = {
  SANDBOX: "تجريبي (sandbox)",
  PRODUCTION: "إنتاج (production)",
};
