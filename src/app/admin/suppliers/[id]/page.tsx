import Link from "next/link";
import { notFound } from "next/navigation";
import { ListTree, PlugZap, Receipt, RefreshCw, Trash2 } from "lucide-react";
import { StatusPill, SupplierButtonForm } from "@/components/admin/supplier-ui";
import { SupplierForm } from "@/components/admin/supplier-form";
import { SupplierMappings, type MappingRow } from "@/components/admin/supplier-mappings";
import { deleteSupplier, syncSupplier, testSupplier, toggleSupplier } from "@/app/admin/suppliers/actions";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { listAdapters } from "@/lib/suppliers/adapters";
import { getDefaultRule, parseCredentials } from "@/lib/suppliers/service";
import { quoteForRow, type PricingRow } from "@/lib/suppliers/repricing";
import { MARKUP_TYPE_LABELS, formatMarkupBps } from "@/lib/suppliers/pricing";

/**
 * One supplier: connection settings, the two operational buttons (test, sync),
 * everything it currently publishes, and its logs.
 *
 * The credential bag is opened here only to prefill the two *non-secret* parts
 * an admin needs to see — the header name and the query-parameter name. The
 * token itself stays on the server; the form shows a fingerprint instead.
 */
export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      adapter: true,
      baseUrl: true,
      authType: true,
      secretCipher: true,
      secretHint: true,
      currency: true,
      rateMicros: true,
      environment: true,
      markupType: true,
      markupValue: true,
      status: true,
      notes: true,
      timeoutMs: true,
      lastTestAt: true,
      lastTestOk: true,
      lastTestMessage: true,
      lastSyncAt: true,
      lastSuccessfulSyncAt: true,
      lastSyncOutcome: true,
      lastSyncMessage: true,
      _count: { select: { products: true } },
    },
  });

  if (!supplier) notFound();

  const [mappings, defaultRule, syncLogs, auditLogs, selectedCount] = await Promise.all([
    prisma.productSupplierMapping.findMany({
      where: { supplierId: id },
      orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        isPreferred: true,
        isEnabled: true,
        supplierProduct: {
          select: {
            id: true,
            name: true,
            cost: true,
            currency: true,
            availability: true,
            missingSince: true,
            externalProductId: true,
            externalVariantId: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            currency: true,
            rateMicros: true,
            markupType: true,
            markupValue: true,
            status: true,
          },
        },
        variant: {
          select: {
            id: true,
            name: true,
            price: true,
            priceMode: true,
            markupType: true,
            markupValue: true,
            product: { select: { id: true, name: true, markupType: true, markupValue: true } },
            _count: { select: { supplierMappings: true } },
          },
        },
      },
    }),
    getDefaultRule(),
    prisma.supplierSyncLog.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.supplierAuditLog.findMany({
      where: { supplierId: id },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, action: true, detail: true, createdAt: true },
    }),
    prisma.supplierProduct.count({ where: { supplierId: id, isSelected: true } }),
  ]);

  const credentials = parseCredentials(supplier.secretCipher);
  const adapters = listAdapters();
  const definition = adapters.find((entry) => entry.key === supplier.adapter);

  // The form may prefill an adapter's non-secret credentials (an account
  // email); the secret ones are reported as "stored" and nothing more.
  const visibleFields: Record<string, string> = {};
  const storedSecretFields: string[] = [];

  for (const field of definition?.credentialFields ?? []) {
    const value = credentials.fields?.[field.name];
    if (!value) continue;
    if (field.secret) storedSecretFields.push(field.name);
    else visibleFields[field.name] = value;
  }

  const rows: MappingRow[] = mappings.map((mapping) => {
    const quote = quoteForRow(mapping as unknown as PricingRow, defaultRule);

    return {
      id: mapping.id,
      productId: mapping.variant.product.id,
      productName: mapping.variant.product.name,
      variantId: mapping.variant.id,
      variantName: mapping.variant.name,
      isPreferred: mapping.isPreferred,
      isEnabled: mapping.isEnabled,
      supplierCount: mapping.variant._count.supplierMappings,
      externalProductId: mapping.supplierProduct.externalProductId,
      externalVariantId: mapping.supplierProduct.externalVariantId,
      supplierCost: mapping.supplierProduct.cost,
      supplierCurrency: mapping.supplierProduct.currency,
      availability: mapping.supplierProduct.availability,
      missing: mapping.supplierProduct.missingSince !== null,
      baseCost: quote.baseCost,
      finalPrice: quote.finalPrice,
      storedPrice: mapping.variant.price,
      manual: quote.manual,
      ruleLabel:
        quote.rule.type === "PERCENT"
          ? formatMarkupBps(quote.rule.value)
          : quote.rule.type === "FIXED"
            ? formatMoney(quote.rule.value)
            : MARKUP_TYPE_LABELS.NONE,
      ruleSource: quote.source,
      priceIssue: quote.ok ? null : (quote.reason ?? null),
      variantMarkupType: mapping.variant.markupType,
      variantMarkupValue: mapping.variant.markupValue,
      priceMode: mapping.variant.priceMode,
    };
  });

  const dateFormat = new Intl.DateTimeFormat("ar-LY", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/suppliers" className="text-xs text-muted hover:text-fg">
          المزوّدون
        </Link>
        <span className="text-xs text-muted-2">/</span>
        <h1 className="text-lg font-bold text-fg">{supplier.name}</h1>
        <StatusPill tone={supplier.status === "ACTIVE" ? "success" : "muted"}>
          {supplier.status === "ACTIVE" ? "مفعّل" : "معطّل"}
        </StatusPill>

        <div className="ms-auto flex items-center gap-2">
          {definition?.canPurchase && (
            <Link
              href={`/admin/suppliers/${supplier.id}/orders`}
              className="tap flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-fg hover:border-brand/40"
            >
              <Receipt className="size-4" />
              طلبات المزوّد
            </Link>
          )}

          <Link
            href={`/admin/suppliers/${supplier.id}/catalog`}
            className="tap flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <ListTree className="size-4" />
            الكتالوج ({supplier._count.products})
          </Link>
        </div>
      </div>

      {/* ── operations ─────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SupplierButtonForm
          action={testSupplier}
          fields={{ id: supplier.id }}
          pendingLabel="جارٍ الاختبار…"
          label={
            <>
              <PlugZap className="size-4" />
              اختبار الاتصال
            </>
          }
        />

        {/* A provider with several catalogs gets a button per catalog: syncing
            one half must never be able to disturb the other. */}
        {definition && definition.catalogKinds.length > 0 ? (
          definition.catalogKinds.map((kind) => (
            <SupplierButtonForm
              key={kind.key}
              action={syncSupplier}
              fields={{ id: supplier.id, kind: kind.key }}
              variant="primary"
              pendingLabel="جارٍ المزامنة…"
              label={
                <>
                  <RefreshCw className="size-4" />
                  {kind.label}
                </>
              }
            />
          ))
        ) : (
          <SupplierButtonForm
            action={syncSupplier}
            fields={{ id: supplier.id }}
            variant="primary"
            pendingLabel="جارٍ المزامنة…"
            label={
              <>
                <RefreshCw className="size-4" />
                مزامنة المنتجات
              </>
            }
          />
        )}

        <SupplierButtonForm
          action={toggleSupplier}
          fields={{ id: supplier.id }}
          label={supplier.status === "ACTIVE" ? "تعطيل المزوّد" : "تفعيل المزوّد"}
          confirm={
            supplier.status === "ACTIVE"
              ? "تعطيل المزوّد يمنع بيع عناصره ويوقف مزامنته. متابعة؟"
              : "تفعيل المزوّد؟"
          }
        />

        <SupplierButtonForm
          action={deleteSupplier}
          fields={{ id: supplier.id }}
          variant="danger"
          confirm={`حذف "${supplier.name}" وكتالوجه وكل روابطه؟ المنتجات المحلية وأسعارها تبقى كما هي.`}
          label={
            <>
              <Trash2 className="size-4" />
              حذف المزوّد
            </>
          }
        />
      </section>

      {/* ── status ─────────────────────────────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold text-fg">آخر اختبار اتصال</p>
          {supplier.lastTestAt ? (
            <>
              <p className="text-[11px] text-muted">{dateFormat.format(supplier.lastTestAt)}</p>
              <p
                className={`text-xs ${supplier.lastTestOk ? "text-success" : "text-danger"}`}
              >
                {supplier.lastTestMessage ?? "—"}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">لم يُجرَ اختبار بعد</p>
          )}
        </div>

        <div className="space-y-1 rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-bold text-fg">آخر مزامنة</p>
          {supplier.lastSyncAt ? (
            <>
              <p className="text-[11px] text-muted">{dateFormat.format(supplier.lastSyncAt)}</p>
              <p
                className={`text-xs ${
                  supplier.lastSyncOutcome === "FAILED"
                    ? "text-danger"
                    : supplier.lastSyncOutcome === "PARTIAL"
                      ? "text-warn"
                      : "text-success"
                }`}
              >
                {supplier.lastSyncMessage ?? "—"}
              </p>
              <p className="text-[11px] text-muted-2">
                {selectedCount} عنصراً محدَّداً · {rows.length} منشوراً
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">لم تُجرَ مزامنة بعد</p>
          )}
        </div>
      </section>

      {/* ── settings ───────────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-sm font-bold text-fg">إعدادات المزوّد</h2>
        <SupplierForm
          adapters={adapters}
          supplier={{
            id: supplier.id,
            name: supplier.name,
            adapter: supplier.adapter,
            baseUrl: supplier.baseUrl,
            authType: supplier.authType,
            secretHint: supplier.secretHint,
            hasSecret: supplier.secretCipher !== null,
            headerName: credentials.headerName ?? "",
            queryParam: credentials.queryParam ?? "",
            fields: visibleFields,
            storedSecretFields,
            currency: supplier.currency,
            rateMicros: supplier.rateMicros,
            environment: supplier.environment,
            markupType: supplier.markupType,
            markupValue: supplier.markupValue,
            timeoutMs: supplier.timeoutMs,
            notes: supplier.notes,
            isActive: supplier.status === "ACTIVE",
          }}
        />
      </section>

      {/* ── published items ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-fg">العناصر المرتبطة بالمتجر</h2>
        <SupplierMappings rows={rows} />
      </section>

      {/* ── logs ───────────────────────────────────────────────────────── */}
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-fg">
            سجل المزامنة
          </h2>
          {syncLogs.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted">لا توجد سجلات</p>
          ) : (
            <ul className="divide-y divide-line">
              {syncLogs.map((log) => (
                <li key={log.id} className="space-y-1 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <StatusPill
                      tone={
                        log.outcome === "SUCCESS"
                          ? "success"
                          : log.outcome === "PARTIAL"
                            ? "warn"
                            : "danger"
                      }
                    >
                      {log.outcome}
                    </StatusPill>
                    <span className="num text-[11px] text-muted-2">
                      {dateFormat.format(log.createdAt)} · {log.durationMs}ms
                    </span>
                  </div>
                  <p className="text-xs text-fg">{log.message ?? "—"}</p>
                  <p className="num text-[11px] text-muted-2">
                    معالَج {log.processed} · جديد {log.created} · محدّث {log.updated} · فشل{" "}
                    {log.failed} · تسعير {log.repriced}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-fg">
            سجل الإجراءات
          </h2>
          {auditLogs.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted">لا توجد سجلات</p>
          ) : (
            <ul className="divide-y divide-line">
              {auditLogs.map((log) => (
                <li key={log.id} className="space-y-0.5 px-4 py-3">
                  <p className="text-xs font-semibold text-fg">{log.action}</p>
                  {log.detail && <p className="text-[11px] text-muted">{log.detail}</p>}
                  <p className="num text-[10px] text-muted-2">
                    {dateFormat.format(log.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
