import { BannerManager } from "@/components/admin/banner-manager";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/db";

export default async function AdminBannersPage() {
  await requireAdminPage();

  const banners = await prisma.banner.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      image: true,
      title: true,
      subtitle: true,
      ctaText: true,
      ctaLink: true,
      sortOrder: true,
      isActive: true,
    },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-fg">الإعلانات</h1>
      <BannerManager banners={banners} />
    </div>
  );
}
