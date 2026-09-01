import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { prisma } from "@/lib/db";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-bold text-fg">منتج جديد</h1>
        <Link href="/admin/products" className="ms-auto text-sm text-muted hover:text-fg">
          رجوع
        </Link>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          أضف فئة واحدة على الأقل قبل إنشاء المنتجات
        </p>
      ) : (
        <ProductForm categories={categories} />
      )}
    </div>
  );
}
