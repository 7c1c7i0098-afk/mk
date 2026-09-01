"use client";

import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { deleteProduct, toggleProduct } from "@/app/admin/actions";
import { ConfirmForm } from "@/components/admin/ui";
import { Thumb } from "@/components/ui/thumb";

type Product = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  isActive: boolean;
  sortOrder: number;
  category: { name: string };
  _count: { variants: number };
};

export function ProductList({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
        لا توجد منتجات مطابقة
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {products.map((product) => (
        <li
          key={product.id}
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3"
        >
          <Thumb
            src={product.image}
            alt={product.name}
            sizes="56px"
            rounded="rounded-xl"
            className="size-14 shrink-0"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{product.name}</p>
            <p className="truncate text-xs text-muted">{product.category.name}</p>
            <p className="num text-[11px] text-muted-2">
              {product._count.variants} فئة سعرية · ترتيب {product.sortOrder}
            </p>
          </div>

          <ConfirmForm
            action={toggleProduct}
            id={product.id}
            message={product.isActive ? "إخفاء هذا المنتج من المتجر؟" : "إظهار هذا المنتج؟"}
          >
            <button
              type="submit"
              className={`tap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                product.isActive
                  ? "border border-success/40 bg-success/10 text-success"
                  : "border border-line bg-surface-2 text-muted"
              }`}
            >
              {product.isActive ? "مفعّل" : "معطّل"}
            </button>
          </ConfirmForm>

          <Link
            href={`/admin/products/${product.id}`}
            aria-label={`تعديل ${product.name}`}
            className="tap grid size-9 place-items-center rounded-lg border border-line text-muted hover:text-fg"
          >
            <Pencil className="size-4" />
          </Link>

          <ConfirmForm
            action={deleteProduct}
            id={product.id}
            message={`حذف المنتج "${product.name}" وكل فئاته السعرية؟`}
          >
            <button
              type="submit"
              aria-label={`حذف ${product.name}`}
              className="tap grid size-9 place-items-center rounded-lg border border-line text-muted hover:border-danger/40 hover:text-danger"
            >
              <Trash2 className="size-4" />
            </button>
          </ConfirmForm>
        </li>
      ))}
    </ul>
  );
}
