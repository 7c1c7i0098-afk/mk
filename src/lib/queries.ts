import { prisma } from "@/lib/db";

/** Banners for the homepage slider, admin-ordered. */
export function getActiveBanners() {
  return prisma.banner.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      image: true,
      title: true,
      subtitle: true,
      ctaText: true,
      ctaLink: true,
    },
  });
}

/** Main categories shown right below the slider. */
export function getActiveCategories(limit?: number) {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: limit,
    select: { id: true, name: true, slug: true, image: true },
  });
}

/** Products for the "كل الفئات" grid: image + name only. */
export function getStorefrontProducts(options?: { categoryId?: string; limit?: number }) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      categoryId: options?.categoryId,
      category: { isActive: true },
    },
    // Grouped by category order, then by the admin's product order.
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    take: options?.limit,
    select: { id: true, name: true, slug: true, image: true },
  });
}

export type StorefrontProduct = Awaited<ReturnType<typeof getStorefrontProducts>>[number];
export type StorefrontCategory = Awaited<ReturnType<typeof getActiveCategories>>[number];
export type StorefrontBanner = Awaited<ReturnType<typeof getActiveBanners>>[number];
