"use client";

import { useState } from "react";
import { AdminField, AdminToggle, inputClass, textareaClass } from "@/components/admin/ui";
import { PendingButton, SupplierActionForm } from "@/components/admin/supplier-ui";
import { saveSupplier } from "@/app/admin/suppliers/actions";
import { fromMinor } from "@/lib/money";
import { BASE_CURRENCY, MARKUP_TYPE_LABELS, formatRate } from "@/lib/suppliers/pricing";
import { AUTH_TYPE_LABELS, ENVIRONMENT_LABELS } from "@/lib/suppliers/types";
import type {
  MarkupType,
  SupplierAuthType,
  SupplierEnvironment,
} from "@/generated/prisma/enums";

/**
 * Supplier connection settings.
 *
 * The one rule that shapes this form: a stored secret is never rendered. The
 * server sends a hint ("••••3f9a") and nothing else, and an empty credential
 * field on save means "keep what you have" — so an API key exists in the
 * browser exactly once, on the request that first sets it.
 *
 * Providers with a bespoke scheme (Libya Play's `x-api-key` + `x-email`) render
 * their own inputs, declared by the adapter. The generic auth dropdown is then
 * hidden entirely rather than shown alongside and ignored.
 */

export type SupplierFormValues = {
  id: string;
  name: string;
  adapter: string;
  baseUrl: string;
  authType: SupplierAuthType;
  /** Fingerprint only — never the secret itself. */
  secretHint: string | null;
  hasSecret: boolean;
  /** Non-secret parts of the credential bag, safe to prefill. */
  headerName: string;
  queryParam: string;
  /**
   * Adapter credentials that are *not* secret (an account email, a merchant
   * id). Secret ones are absent by construction: they never leave the server.
   */
  fields: Record<string, string>;
  /** Which adapter-declared secrets currently hold a value. */
  storedSecretFields: string[];
  currency: string;
  rateMicros: number | null;
  environment: SupplierEnvironment;
  markupType: MarkupType;
  markupValue: number;
  timeoutMs: number;
  notes: string | null;
  isActive: boolean;
};

export type AdapterOption = {
  key: string;
  label: string;
  description: string;
  catalogPathHint: string | null;
  defaultBaseUrl: string | null;
  credentialFields: {
    name: string;
    label: string;
    secret: boolean;
    required?: boolean;
    placeholder?: string;
    hint?: string;
  }[];
  supportsEnvironments: boolean;
  catalogKinds: { key: string; label: string }[];
  canPurchase: boolean;
};

const AUTH_TYPES: SupplierAuthType[] = [
  "NONE",
  "API_KEY_HEADER",
  "BEARER_TOKEN",
  "BASIC_AUTH",
  "QUERY_PARAM",
];

const MARKUP_TYPES: MarkupType[] = ["PERCENT", "FIXED", "NONE"];

export function SupplierForm({
  adapters,
  supplier,
  onDone,
}: {
  adapters: AdapterOption[];
  supplier?: SupplierFormValues | null;
  onDone?: () => void;
}) {
  const [adapter, setAdapter] = useState(supplier?.adapter ?? adapters[0]?.key ?? "");
  const [authType, setAuthType] = useState<SupplierAuthType>(supplier?.authType ?? "NONE");
  const [markupType, setMarkupType] = useState<MarkupType>(supplier?.markupType ?? "PERCENT");
  const [currency, setCurrency] = useState(supplier?.currency ?? BASE_CURRENCY);
  const [baseUrl, setBaseUrl] = useState(supplier?.baseUrl ?? adapters[0]?.defaultBaseUrl ?? "");

  const selectedAdapter = adapters.find((option) => option.key === adapter);
  const adapterFields = selectedAdapter?.credentialFields ?? [];
  const usesAdapterCredentials = adapterFields.length > 0;

  const needsToken =
    !usesAdapterCredentials &&
    (authType === "API_KEY_HEADER" || authType === "BEARER_TOKEN" || authType === "QUERY_PARAM");
  const needsBasic = !usesAdapterCredentials && authType === "BASIC_AUTH";
  const foreignCurrency = currency.toUpperCase() !== BASE_CURRENCY;

  /** Switching provider offers its documented base URL, without clobbering an edit. */
  function chooseAdapter(key: string) {
    setAdapter(key);
    const next = adapters.find((option) => option.key === key);
    if (next?.defaultBaseUrl && !supplier) setBaseUrl(next.defaultBaseUrl);
  }

  const secretPlaceholder = supplier?.hasSecret
    ? `محفوظ (${supplier.secretHint ?? "••••"}) — اتركه فارغاً للإبقاء عليه`
    : "";

  return (
    <SupplierActionForm action={saveSupplier} className="space-y-4" onDone={onDone}>
      {supplier?.id && <input type="hidden" name="id" value={supplier.id} />}

      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="اسم المزوّد">
          <input
            name="name"
            defaultValue={supplier?.name ?? ""}
            required
            placeholder="شركة البطاقات العالمية"
            className={inputClass}
          />
        </AdminField>

        <AdminField label="نوع الربط" hint={selectedAdapter?.description}>
          <select
            name="adapter"
            value={adapter}
            onChange={(event) => chooseAdapter(event.target.value)}
            className={inputClass}
          >
            {adapters.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </AdminField>
      </div>

      <AdminField
        label="رابط الـ API الأساسي"
        hint={
          selectedAdapter?.catalogPathHint
            ? `المسارات المستخدمة: ${selectedAdapter.catalogPathHint}`
            : undefined
        }
      >
        <input
          name="baseUrl"
          dir="ltr"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          required
          placeholder="https://api.supplier.com/v1"
          className={`${inputClass} text-start`}
        />
      </AdminField>

      {/* ── credentials ───────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-xl border border-line bg-ink p-3">
        <h3 className="text-xs font-bold text-fg">
          بيانات الاعتماد
          <span className="ms-2 font-medium text-muted-2">
            تُخزَّن مشفّرة ولا تُرسل إلى المتصفّح أبداً
          </span>
        </h3>

        {usesAdapterCredentials ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {adapterFields.map((field) => {
              const stored = supplier?.storedSecretFields.includes(field.name);

              return (
                <AdminField
                  key={field.name}
                  label={field.label}
                  hint={
                    field.secret && stored
                      ? `${field.hint ?? ""} — محفوظ، اتركه فارغاً للإبقاء عليه`.trim()
                      : field.hint
                  }
                >
                  <input
                    name={`cred_${field.name}`}
                    // Secret fields are write-only: no value, no defaultValue.
                    type={field.secret ? "password" : "text"}
                    dir="ltr"
                    autoComplete="off"
                    defaultValue={field.secret ? "" : (supplier?.fields[field.name] ?? "")}
                    placeholder={
                      field.secret && stored
                        ? (secretPlaceholder ?? "")
                        : (field.placeholder ?? "")
                    }
                    required={field.required && !stored && !supplier}
                    className={`${inputClass} text-start`}
                  />
                </AdminField>
              );
            })}
          </div>
        ) : (
          <>
            <AdminField label="نوع المصادقة">
              <select
                name="authType"
                value={authType}
                onChange={(event) => setAuthType(event.target.value as SupplierAuthType)}
                className={inputClass}
              >
                {AUTH_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {AUTH_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </AdminField>

            {needsToken && (
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="المفتاح / التوكن">
                  <input
                    name="token"
                    type="password"
                    dir="ltr"
                    autoComplete="off"
                    placeholder={secretPlaceholder}
                    className={`${inputClass} text-start`}
                  />
                </AdminField>

                {authType === "API_KEY_HEADER" && (
                  <AdminField label="اسم الترويسة" hint="افتراضياً X-API-Key">
                    <input
                      name="headerName"
                      dir="ltr"
                      defaultValue={supplier?.headerName ?? ""}
                      placeholder="X-API-Key"
                      className={`${inputClass} text-start`}
                    />
                  </AdminField>
                )}

                {authType === "QUERY_PARAM" && (
                  <AdminField label="اسم المعامل" hint="افتراضياً api_key">
                    <input
                      name="queryParam"
                      dir="ltr"
                      defaultValue={supplier?.queryParam ?? ""}
                      placeholder="api_key"
                      className={`${inputClass} text-start`}
                    />
                  </AdminField>
                )}
              </div>
            )}

            {needsBasic && (
              <div className="grid gap-3 sm:grid-cols-2">
                <AdminField label="اسم المستخدم">
                  <input
                    name="username"
                    dir="ltr"
                    autoComplete="off"
                    className={`${inputClass} text-start`}
                  />
                </AdminField>
                <AdminField label="كلمة المرور">
                  <input
                    name="password"
                    type="password"
                    dir="ltr"
                    autoComplete="off"
                    placeholder={secretPlaceholder}
                    className={`${inputClass} text-start`}
                  />
                </AdminField>
              </div>
            )}

            <AdminField
              label="ترويسات إضافية"
              hint="سطر لكل ترويسة بالشكل Name: value — تُعامل كبيانات سرّية"
            >
              <textarea
                name="customHeaders"
                dir="ltr"
                rows={2}
                placeholder="X-Client-Id: 12345"
                className={`${textareaClass} text-start`}
              />
            </AdminField>
          </>
        )}

        {supplier?.hasSecret && (
          <AdminToggle name="clearSecret" label="حذف بيانات الاعتماد المحفوظة" />
        )}
      </section>

      {/* ── environment ───────────────────────────────────────────────── */}
      {selectedAdapter?.supportsEnvironments && (
        <AdminField
          label="البيئة"
          hint="استخدم sandbox أثناء التطوير — لا ترسل عمليات شراء حقيقية في الاختبارات"
        >
          <select
            name="environment"
            defaultValue={supplier?.environment ?? "SANDBOX"}
            className={inputClass}
          >
            {(["SANDBOX", "PRODUCTION"] as SupplierEnvironment[]).map((value) => (
              <option key={value} value={value}>
                {ENVIRONMENT_LABELS[value]}
              </option>
            ))}
          </select>
        </AdminField>
      )}

      {/* ── currency & pricing ────────────────────────────────────────── */}
      <section className="space-y-3 rounded-xl border border-line bg-ink p-3">
        <h3 className="text-xs font-bold text-fg">العملة والتسعير</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="عملة المزوّد" hint="رمز من 3 أحرف، مثل USD">
            <input
              name="currency"
              dir="ltr"
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              maxLength={3}
              className={`${inputClass} text-start`}
            />
          </AdminField>

          {foreignCurrency && (
            <AdminField
              label={`سعر صرف 1 ${currency.toUpperCase()} بالدينار`}
              hint="مطلوب — لا يُحتسب أي سعر تلقائي بدونه"
            >
              <input
                name="rate"
                type="number"
                step="0.000001"
                min="0"
                dir="ltr"
                defaultValue={formatRate(supplier?.rateMicros)}
                className={`${inputClass} text-start`}
              />
            </AdminField>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <AdminField label="ربح المزوّد" hint="يُطبَّق ما لم توجد قاعدة أخصّ للمنتج أو الفئة">
            <select
              name="markupType"
              value={markupType}
              onChange={(event) => setMarkupType(event.target.value as MarkupType)}
              className={inputClass}
            >
              {MARKUP_TYPES.map((type) => (
                <option key={type} value={type}>
                  {MARKUP_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </AdminField>

          {markupType !== "NONE" && (
            <AdminField label={markupType === "PERCENT" ? "النسبة %" : "المبلغ (د.ل)"}>
              <input
                name="markupValue"
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                defaultValue={
                  supplier
                    ? supplier.markupType === "PERCENT"
                      ? supplier.markupValue / 100
                      : fromMinor(supplier.markupValue)
                    : ""
                }
                className={`${inputClass} text-start`}
              />
            </AdminField>
          )}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <AdminField label="مهلة الطلب (مللي ثانية)" hint="بين 2000 و 60000">
          <input
            name="timeoutMs"
            type="number"
            min="2000"
            max="60000"
            step="500"
            dir="ltr"
            defaultValue={supplier?.timeoutMs ?? 15000}
            className={`${inputClass} text-start`}
          />
        </AdminField>

        <div className="flex items-end pb-2">
          <AdminToggle name="isActive" label="مفعّل" defaultChecked={supplier?.isActive ?? true} />
        </div>
      </div>

      <AdminField label="ملاحظات">
        <textarea
          name="notes"
          rows={2}
          defaultValue={supplier?.notes ?? ""}
          className={textareaClass}
        />
      </AdminField>

      <PendingButton pendingLabel="جارٍ الحفظ…" className="sm:w-auto sm:px-8">
        {supplier ? "حفظ التعديلات" : "إضافة المزوّد"}
      </PendingButton>
    </SupplierActionForm>
  );
}
