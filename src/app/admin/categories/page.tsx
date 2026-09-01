import { CategoryManager } from "@/components/admin/category-manager";
import { prisma } from "@/lib/db";

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { products: true } },
    },
  });

  return <CategoryManager categories={categories} />;
}
