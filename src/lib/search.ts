import type { PrismaClient } from "@/generated/prisma/client";

export type ProductSearchResult = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  categoryName: string;
};

/**
 * Product lookup by name, region, description or category name.
 * Shared by the header dropdown (/api/search) and the search results page.
 */
export async function searchProducts(
  db: PrismaClient,
  term: string,
  limit = 20,
): Promise<ProductSearchResult[]> {
  const products = await db.product.findMany({
    where: {
      isActive: true,
      category: { isActive: true },
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { slug: { contains: term, mode: "insensitive" } },
        { region: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { category: { name: { contains: term, mode: "insensitive" } } },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      category: { select: { name: true } },
    },
  });

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    image: product.image,
    categoryName: product.category.name,
  }));
}
