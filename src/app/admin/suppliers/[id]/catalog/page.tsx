import Link from "next/link";
import { notFound } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { SupplierButtonForm } from "@/components/admin/supplier-ui";
import { SupplierCatalog, type CatalogRow } from "@/components/admin/supplier-catalog";
import { syncSupplier } from "@/app/admin/suppliers/actions";
import { prisma } from "@/lib/db";
import { getDefaultRule } from "@/lib/suppliers/service";
import { listAdapters } from "@/lib/suppliers/adapters";
import { PRODUCT_TYPE_LABELS } from "@/lib/suppliers/types";
import { quotePrice } from "@/lib/suppliers/pricing";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The supplier catalog: everything the API offered, none of it for sale.
 *
 * Filters and paging happen in SQL rather than in the browser, so a supplier
 * with tens of thousands of lines stays as responsive as one with twenty.
 */

const PAGE_SIZE = 60;

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    state?: string;
    availability?: string;
    type?: string;
    page?: string;
  }>;
};

const STATE_FILTERS = [
  { value: "", label: "الكل" },
  { value: "unmapped", label: "غير منشور" },
  { value: "mapped", label: "منشور" },
  { value: "selected", label: "المختار" },
] as const;

const AVAILABILITY_FILTERS = [
  { value: "", label: "كل الحالات" },
  { value: "AVAILABLE", label: "متوفر" },
  { value: "UNAVAILABLE", label: "غير متوفر" },
  { value: "UNKNOWN", label: "غير معروف" },
] as const;

/** Libya Play's two halves are browsed separately, exactly as they are synced. */
const TYPE_FILTERS = [
  { value: "", label: "كل الأنواع" },
  { value: "DIGITAL", label: PRODUCT_TYPE_LABELS.DIGITAL },
  { value: "SOCIAL", label: PRODUCT_TYPE_LABELS.SOCIAL },
  { value: "GENERIC", label: PRODUCT_TYPE_LABELS.GENERIC },
] as const;

/** How many inputs a Social product asks the customer for, for the row badge. */
function countParamFields(json: string): number {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export default async function SupplierCatalogPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = await searchParams;

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      adapter: true,
      currency: true,
      rateMicros: true,
      markupType: true,
      markupValue: true,
      status: true,
    },
  });
  if (!supplier) notFound();

  const definition = listAdapters().find((entry) => entry.key === supplier.adapter);

  const term = query.q?.trim() ?? "";
  const state = query.state ?? "";
  const availability = query.availability ?? "";
  const type = query.type ?? "";
  const page = Math.max(1, Number(query.page) || 1);

  const where: Prisma.SupplierProductWhereInput = {
    supplierId: id,
    ...(term
      ? {
          OR: [
            { name: { contains: term } },
            { category: { contains: term } },
            { externalProductId: { contains: term } },
            { variantLabel: { contains: term } },
          ],
        }
      : {}),
    ...(availability === "AVAILABLE" || availability === "UNAVAILABLE" || availability === "UNKNOWN"
      ? { availability }
      : {}),
    ...(state === "selected" ? { isSelected: true } : {}),
    ...(state === "mapped" ? { mappings: { some: {} } } : {}),
    ...(state === "unmapped" ? { mappings: { none: {} } } : {}),
    ...(type === "DIGITAL" || type === "SOCIAL" || type === "GENERIC"
      ? { productType: type }
      : {}),
  };

  const [items, total, defaultRule, categories, products, counts] = await Promise.all([
    prisma.supplierProduct.findMany({
      where,
      orderBy: [{ name: "asc" }, { cost: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        externalProductId: true,
        externalVariantId: true,
        name: true,
        category: true,
        variantLabel: true,
        cost: true,
        currency: true,
        availability: true,
        productType: true,
        paramFieldsJson: true,
        missingSince: true,
        isSelected: true,
        mappings: {
          take: 1,
          select: {
            variant: {
              select: { name: true, product: { select: { id: true, name: true } } },
            },
          },
        },
      },
    }),
    prisma.supplierProduct.count({ where }),
    getDefaultRule(),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.product.findMany({
      orderBy: { name: "asc" },
      take: 300,
      select: { id: true, name: true },
    }),
    prisma.supplierProduct.groupBy({
      by: ["isSelected"],
      where: { supplierId: id },
      _count: true,
    }),
  ]);

  const selectedTotal = counts.find((row) => row.isSelected)?._count ?? 0;

  const rows: CatalogRow[] = items.map((item) => {
    // The preview uses the supplier rule and the global default: an item that
    // has not been imported yet has no product or variant rule to inherit from.
    const quote = quotePrice({
      supplierCost: item.cost,
      supplierCurrency: item.currency || supplier.currency,
      rateMicros: supplier.rateMicros,
      priceMode: "AUTO",
      currentPrice: 0,
      supplierRule: { type: supplier.markupType, value: supplier.markupValue },
      defaultRule,
    });

    const mapping = item.mappings[0];

    return {
      id: item.id,
      externalProductId: item.externalProductId,
      externalVariantId: item.externalVariantId,
      name: item.name,
      category: item.category,
      variantLabel: item.variantLabel,
      cost: item.cost,
      currency: item.currency,
      availability: item.availability,
      productType: item.productType,
      paramFieldCount: item.paramFieldsJson ? countParamFields(item.paramFieldsJson) : 0,
      missing: item.missingSince !== null,
      isSelected: item.isSelected,
      mapped: mapping
        ? {
            productId: mapping.variant.product.id,
            productName: mapping.variant.product.name,
            variantName: mapping.variant.name,
          }
        : null,
      previewPrice: quote.ok ? quote.finalPrice : null,
    };
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (term) search.set("q", term);
    if (state) search.set("state", state);
    if (availability) search.set("availability", availability);
    if (type) search.set("type", type);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/admin/suppliers/${id}/catalog${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/suppliers" className="text-xs text-muted hover:text-fg">
          المزوّدون
        </Link>
        <span className="text-xs text-muted-2">/</span>
        <Link href={`/admin/suppliers/${id}`} className="text-xs text-muted hover:text-fg">
          {supplier.name}
        </Link>
        <span className="text-xs text-muted-2">/</span>
        <h1 className="text-lg font-bold text-fg">الكتالوج</h1>

        <div className="ms-auto flex flex-wrap items-start gap-2">
          {definition && definition.catalogKinds.length > 0 ? (
            definition.catalogKinds.map((kind) => (
              <div key={kind.key} className="w-44">
                <SupplierButtonForm
                  action={syncSupplier}
                  fields={{ id, kind: kind.key }}
                  pendingLabel="جارٍ المزامنة…"
                  label={
                    <>
                      <RefreshCw className="size-4" />
                      {kind.label}
                    </>
                  }
                />
              </div>
            ))
          ) : (
            <div className="w-40">
              <SupplierButtonForm
                action={syncSupplier}
                fields={{ id }}
                pendingLabel="جارٍ المزامنة…"
                label={
                  <>
                    <RefreshCw className="size-4" />
                    مزامنة
                  </>
                }
              />
            </div>
          )}
        </div>
      </div>

      <p className="num text-xs text-muted">
        {total} عنصراً مطابقاً · {selectedTotal} في القائمة المختارة
      </p>

      <form className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto]">
        <input
          name="q"
          defaultValue={term}
          placeholder="ابحث بالاسم أو المعرّف أو الفئة…"
          className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg outline-none focus:border-brand/60"
        />

        <select
          name="state"
          defaultValue={state}
          className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-brand/60"
        >
          {STATE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>

        <select
          name="availability"
          defaultValue={availability}
          className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-brand/60"
        >
          {AVAILABILITY_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>

        <select
          name="type"
          defaultValue={type}
          className="h-11 rounded-xl border border-line bg-surface px-3 text-sm text-fg outline-none focus:border-brand/60"
        >
          {TYPE_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="tap h-11 rounded-xl border border-line bg-surface px-5 text-sm font-semibold text-fg"
        >
          تصفية
        </button>
      </form>

      <SupplierCatalog
        supplierId={id}
        rows={rows}
        categories={categories}
        products={products}
      />

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="ترقيم الصفحات">
          {page > 1 && (
            <Link
              href={pageHref(page - 1)}
              className="tap rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg"
            >
              السابق
            </Link>
          )}
          <span className="num text-xs text-muted">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link
              href={pageHref(page + 1)}
              className="tap rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-fg"
            >
              التالي
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
