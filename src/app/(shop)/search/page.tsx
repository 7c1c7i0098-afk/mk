import type { Metadata } from "next";
import { BackButton } from "@/components/shop/back-button";
import { EmptySearch } from "@/components/shop/empty-search";
import { ProductGrid } from "@/components/shop/product-grid";
import { prisma } from "@/lib/db";
import { searchProducts } from "@/lib/search";

export const metadata: Metadata = { title: "نتائج البحث" };

type PageProps = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const term = q?.trim() ?? "";
  const results = term.length >= 2 ? await searchProducts(prisma, term, 60) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="truncate pb-0.5 text-lg font-bold leading-[1.6] text-fg">
          نتائج البحث عن: <span className="text-brand">{term || "—"}</span>
        </h1>
      </div>

      {term.length < 2 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
          اكتب حرفين على الأقل للبحث
        </p>
      ) : results.length === 0 ? (
        <EmptySearch term={term} />
      ) : (
        <>
          <p className="num text-xs text-muted">{results.length} نتيجة</p>
          <ProductGrid products={results} />
        </>
      )}
    </div>
  );
}
