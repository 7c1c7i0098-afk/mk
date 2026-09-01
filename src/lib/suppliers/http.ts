import "server-only";

import type { SupplierContext } from "@/lib/suppliers/types";

/**
 * The single outbound door to supplier APIs.
 *
 * Everything hostile about third-party HTTP is handled once, here: a hung
 * connection cannot pin a request thread, a 10 GB response cannot exhaust
 * memory, a transient 502 is retried but a 401 is not, and no error string
 * that escapes this module can contain a credential.
 */

/** Hard ceiling on a catalog response. Larger than any sane gift-card catalog. */
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
/** Retries apply only to failures that are plausibly transient. */
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;

export class SupplierRequestError extends Error {
  readonly status: number | null;
  /** Arabic, safe to show an admin. */
  readonly adminMessage: string;

  constructor(adminMessage: string, status: number | null = null) {
    super(adminMessage);
    this.name = "SupplierRequestError";
    this.status = status;
    this.adminMessage = adminMessage;
  }
}

/**
 * Strips anything secret-shaped out of a string before it reaches a log, an
 * audit row or the Admin UI. Called on every path out of this module, so a
 * supplier that helpfully echoes the API key back in its error body cannot
 * launder it into our database.
 */
export function sanitize(input: unknown, context?: SupplierContext): string {
  let text =
    input instanceof Error ? input.message : typeof input === "string" ? input : String(input ?? "");

  const secrets = [
    context?.credentials.token,
    context?.credentials.password,
    context?.credentials.username,
    ...Object.values(context?.credentials.headers ?? {}),
    ...Object.values(context?.credentials.fields ?? {}),
  ].filter((value): value is string => Boolean(value) && String(value).length >= 4);

  for (const secret of secrets) text = text.split(secret).join("[محجوب]");

  // Catch credentials we were never handed: inline basic-auth, bearer tokens
  // and key-ish query parameters that a supplier put in its own error text.
  text = text
    .replace(/\/\/[^/@\s]+:[^/@\s]+@/g, "//[محجوب]@")
    .replace(/(bearer\s+)[\w.\-]+/gi, "$1[محجوب]")
    .replace(/([?&](?:api[_-]?key|key|token|secret|password)=)[^&\s]+/gi, "$1[محجوب]");

  return text.slice(0, 400);
}

/** Builds the request URL, folding in a query-parameter credential if needed. */
export function buildUrl(context: SupplierContext, path: string): URL {
  const base = context.baseUrl.endsWith("/") ? context.baseUrl : `${context.baseUrl}/`;
  const url = new URL(path.replace(/^\//, ""), base);

  if (context.authType === "QUERY_PARAM" && context.credentials.token) {
    url.searchParams.set(context.credentials.queryParam || "api_key", context.credentials.token);
  }

  return url;
}

/** Assembles auth + custom headers. Never logged. */
export function buildHeaders(context: SupplierContext): Headers {
  const headers = new Headers({
    Accept: "application/json",
    "User-Agent": "PLUSCARD-Supplier-Sync/1.0",
  });

  for (const [key, value] of Object.entries(context.credentials.headers ?? {})) {
    if (key.trim()) headers.set(key.trim(), value);
  }

  const { token, username, password, headerName } = context.credentials;

  switch (context.authType) {
    case "API_KEY_HEADER":
      if (token) headers.set(headerName || "X-API-Key", token);
      break;
    case "BEARER_TOKEN":
      if (token) headers.set("Authorization", `Bearer ${token}`);
      break;
    case "BASIC_AUTH":
      if (username || password) {
        const encoded = Buffer.from(`${username ?? ""}:${password ?? ""}`).toString("base64");
        headers.set("Authorization", `Basic ${encoded}`);
      }
      break;
    default:
      break;
  }

  return headers;
}

function shouldRetry(status: number | null): boolean {
  // Network-level failure, rate limiting, or an upstream hiccup. Never 4xx
  // auth/validation errors: repeating those only burns the supplier's quota.
  if (status === null) return true;
  return status === 408 || status === 429 || status >= 500;
}

function describeStatus(status: number): string {
  if (status === 401 || status === 403) return "بيانات الاعتماد مرفوضة من المزوّد";
  if (status === 404) return "المسار غير موجود لدى المزوّد";
  if (status === 429) return "تم تجاوز حد الطلبات لدى المزوّد";
  if (status >= 500) return "خطأ في خادم المزوّد";
  return `المزوّد ردّ برمز ${status}`;
}

/** Reads a body with a hard byte cap, so a runaway response cannot OOM us. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new SupplierRequestError("ردّ المزوّد أكبر من الحد المسموح به");
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

export type SupplierResponse = { status: number; json: unknown; bytes: number };

/**
 * One JSON call to a supplier, with timeout, bounded retries and a size cap.
 * Throws only `SupplierRequestError`, whose message is already sanitized.
 */
export async function supplierFetch(
  context: SupplierContext,
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    /**
     * Sent as `application/x-www-form-urlencoded` instead of JSON. Some
     * providers document one content type per endpoint — Libya Play's digital
     * payment is form-encoded while its social payment is JSON — so the choice
     * belongs to the adapter, per call.
     */
    form?: Record<string, string | number | string[]>;
    /** Query parameters appended to the URL. */
    query?: Record<string, string | number | undefined | null>;
    /**
     * Extra headers from the adapter — how an ADAPTER-auth provider attaches
     * its own scheme. Assembled here so a failure message still passes through
     * the same scrubbing as everything else.
     */
    headers?: Record<string, string>;
  },
): Promise<SupplierResponse> {
  let url: URL;
  try {
    url = buildUrl(context, path);
  } catch {
    throw new SupplierRequestError("رابط المزوّد غير صالح");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SupplierRequestError("رابط المزوّد يجب أن يبدأ بـ http أو https");
  }

  for (const [key, value] of Object.entries(init?.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = buildHeaders(context);
  for (const [key, value] of Object.entries(init?.headers ?? {})) {
    if (key.trim() && value) headers.set(key.trim(), value);
  }
  let payload: string | undefined;

  if (init?.form !== undefined) {
    const encoded = new URLSearchParams();
    for (const [key, value] of Object.entries(init.form)) {
      // Repeated keys are how form encoding expresses an array.
      if (Array.isArray(value)) for (const entry of value) encoded.append(key, String(entry));
      else encoded.set(key, String(value));
    }
    payload = encoded.toString();
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  } else if (init?.body !== undefined) {
    payload = JSON.stringify(init.body);
    headers.set("Content-Type", "application/json");
  }

  let lastError: SupplierRequestError = new SupplierRequestError("تعذّر الاتصال بالمزوّد");

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, context.timeoutMs));

    try {
      const response = await fetch(url, {
        method: init?.method ?? "GET",
        headers,
        body: payload,
        signal: controller.signal,
        cache: "no-store",
        redirect: "follow",
      });

      const text = await readCapped(response);

      if (!response.ok) {
        const error = new SupplierRequestError(describeStatus(response.status), response.status);
        if (!shouldRetry(response.status) || attempt === MAX_ATTEMPTS) throw error;
        lastError = error;
      } else {
        try {
          return { status: response.status, json: JSON.parse(text), bytes: text.length };
        } catch {
          throw new SupplierRequestError("ردّ المزوّد ليس JSON صالحاً", response.status);
        }
      }
    } catch (error) {
      if (error instanceof SupplierRequestError) {
        if (!shouldRetry(error.status) || attempt === MAX_ATTEMPTS) throw error;
        lastError = error;
      } else if (error instanceof DOMException && error.name === "AbortError") {
        lastError = new SupplierRequestError(
          `انتهت مهلة الاتصال بالمزوّد (${context.timeoutMs} مللي ثانية)`,
        );
        if (attempt === MAX_ATTEMPTS) throw lastError;
      } else {
        lastError = new SupplierRequestError(
          `تعذّر الوصول إلى المزوّد: ${sanitize(error, context)}`,
        );
        if (attempt === MAX_ATTEMPTS) throw lastError;
      }
    } finally {
      clearTimeout(timer);
    }

    await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt));
  }

  throw lastError;
}
