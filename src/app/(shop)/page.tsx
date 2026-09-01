import { BannerSlider } from "@/components/shop/banner-slider";
import { CategoryStrip } from "@/components/shop/category-strip";
import { HomeHeader } from "@/components/shop/home-header";
import { ProductGrid } from "@/components/shop/product-grid";
import { getActiveBanners, getActiveCategories, getStorefrontProducts } from "@/lib/queries";
import { getCurrentUser } from "@/lib/session";

export default async function HomePage() {
  const [user, banners, categories, products] = await Promise.all([
    getCurrentUser(),
    getActiveBanners(),
    getActiveCategories(),
    getStorefrontProducts(),
  ]);

  return (
    <div className="space-y-6">
      <HomeHeader balance={user?.balance ?? null} name={user?.name ?? null} />

      <BannerSlider banners={banners} />

      <CategoryStrip categories={categories} />

      <section aria-labelledby="all-categories-title">
        <h2
          id="all-categories-title"
          className="mb-3.5 flex items-center gap-2 text-base font-bold text-fg sm:text-lg"
        >
          <span className="h-4 w-1 rounded-full bg-brand" aria-hidden />
          كل الفئات
        </h2>

        {products.length > 0 ? (
          <ProductGrid products={products} compact />
        ) : (
          <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
            لا توجد منتجات متاحة حالياً
          </p>
        )}
      </section>
    </div>
  );
}
