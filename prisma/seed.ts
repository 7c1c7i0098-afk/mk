/**
 * Seed: baseline data so the storefront is browsable on a fresh clone.
 *
 * Images are intentionally left empty — category and product artwork is
 * uploaded by the administrator from the Admin Dashboard.
 * Prices are integers in minor units (100 = 1.00 د.ل).
 */
import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { requireDatabaseUrl } from "../src/lib/database-url";

const adapter = new PrismaPg({
  connectionString: requireDatabaseUrl(),
});
const prisma = new PrismaClient({ adapter });

type VariantSeed = { name: string; value: string; price: number; stock?: number };
type ProductSeed = {
  name: string;
  slug: string;
  region?: string;
  description?: string;
  variants: VariantSeed[];
};
type CategorySeed = {
  name: string;
  slug: string;
  products: ProductSeed[];
};

const CATEGORIES: CategorySeed[] = [
  {
    name: "الاتصالات",
    slug: "telecom",
    products: [
      {
        name: "ليبيانا",
        slug: "libyana",
        description: "بطاقة شحن رصيد ليبيانا، تصلك فوراً بعد إتمام الطلب.",
        variants: [
          { name: "بطاقة 5 دينار", value: "5 د.ل", price: 550 },
          { name: "بطاقة 10 دينار", value: "10 د.ل", price: 1050 },
          { name: "بطاقة 20 دينار", value: "20 د.ل", price: 2050 },
          { name: "بطاقة 50 دينار", value: "50 د.ل", price: 5050 },
        ],
      },
      {
        name: "المدار الجديد",
        slug: "almadar",
        description: "بطاقة شحن رصيد المدار الجديد لجميع الخطوط.",
        variants: [
          { name: "بطاقة 5 دينار", value: "5 د.ل", price: 550 },
          { name: "بطاقة 10 دينار", value: "10 د.ل", price: 1050 },
          { name: "بطاقة 20 دينار", value: "20 د.ل", price: 2050 },
          { name: "بطاقة 50 دينار", value: "50 د.ل", price: 5050 },
        ],
      },
      {
        name: "ليبيا للاتصالات",
        slug: "ltt",
        description: "بطاقات إنترنت وخدمات ليبيا للاتصالات والتقنية.",
        variants: [
          { name: "بطاقة 10 دينار", value: "10 د.ل", price: 1050 },
          { name: "بطاقة 25 دينار", value: "25 د.ل", price: 2550 },
          { name: "بطاقة 50 دينار", value: "50 د.ل", price: 5100 },
        ],
      },
    ],
  },
  {
    name: "التعليم",
    slug: "education",
    products: [
      {
        name: "Coursera",
        slug: "coursera",
        description: "اشتراك كورسيرا للوصول إلى آلاف الدورات التدريبية.",
        variants: [
          { name: "اشتراك شهر", value: "1 Month", price: 25000 },
          { name: "اشتراك 3 أشهر", value: "3 Months", price: 68000 },
        ],
      },
      {
        name: "Udemy",
        slug: "udemy",
        description: "بطاقة يوديمي لشراء الدورات التدريبية.",
        variants: [
          { name: "بطاقة 25 دولار", value: "$25", price: 14000 },
          { name: "بطاقة 50 دولار", value: "$50", price: 27500 },
        ],
      },
      {
        name: "Duolingo",
        slug: "duolingo",
        description: "اشتراك Super Duolingo لتعلم اللغات بدون إعلانات.",
        variants: [
          { name: "اشتراك شهر", value: "1 Month", price: 6500 },
          { name: "اشتراك سنة", value: "12 Months", price: 52000 },
        ],
      },
    ],
  },
  {
    name: "الألعاب",
    slug: "games",
    products: [
      {
        name: "PUBG Mobile",
        slug: "pubg-mobile",
        description: "شدات ببجي موبايل — تُشحن مباشرة عبر ID اللاعب.",
        variants: [
          { name: "60 UC", value: "60 UC", price: 5500 },
          { name: "325 UC", value: "325 UC", price: 26000 },
          { name: "660 UC", value: "660 UC", price: 51000 },
          { name: "1800 UC", value: "1800 UC", price: 132000 },
          { name: "3850 UC", value: "3850 UC", price: 275000 },
          { name: "8100 UC", value: "8100 UC", price: 550000 },
        ],
      },
      {
        name: "PlayStation",
        slug: "playstation-usa",
        region: "USA",
        description: "بطاقات PlayStation Store الأمريكية.",
        variants: [
          { name: "بطاقة 10 دولار", value: "$10", price: 6000 },
          { name: "بطاقة 25 دولار", value: "$25", price: 14500 },
          { name: "بطاقة 50 دولار", value: "$50", price: 28500 },
          { name: "بطاقة 100 دولار", value: "$100", price: 56000 },
        ],
      },
      {
        name: "Xbox",
        slug: "xbox-usa",
        region: "USA",
        description: "بطاقات Xbox Live الأمريكية.",
        variants: [
          { name: "بطاقة 10 دولار", value: "$10", price: 6000 },
          { name: "بطاقة 25 دولار", value: "$25", price: 14500 },
          { name: "بطاقة 50 دولار", value: "$50", price: 28500 },
        ],
      },
      {
        name: "Steam USA",
        slug: "steam-usa",
        region: "USA",
        description: "بطاقات محفظة ستيم الأمريكية.",
        variants: [
          { name: "بطاقة 10 دولار", value: "$10", price: 6200 },
          { name: "بطاقة 20 دولار", value: "$20", price: 12000 },
          { name: "بطاقة 50 دولار", value: "$50", price: 29500 },
        ],
      },
      {
        name: "Steam Turkey",
        slug: "steam-turkey",
        region: "Turkey",
        description: "بطاقات محفظة ستيم التركية بالليرة.",
        variants: [
          { name: "بطاقة 100 ليرة", value: "₺100", price: 2200 },
          { name: "بطاقة 250 ليرة", value: "₺250", price: 5200 },
          { name: "بطاقة 500 ليرة", value: "₺500", price: 10200 },
        ],
      },
    ],
  },
  {
    name: "المتاجر",
    slug: "stores",
    products: [
      {
        name: "iTunes USA",
        slug: "itunes-usa",
        region: "USA",
        description: "بطاقات آيتونز أمريكية للاستخدام على App Store و iTunes.",
        variants: [
          { name: "بطاقة 10 دولار", value: "$10", price: 6200 },
          { name: "بطاقة 25 دولار", value: "$25", price: 15000 },
          { name: "بطاقة 50 دولار", value: "$50", price: 29500 },
          { name: "بطاقة 100 دولار", value: "$100", price: 58000 },
        ],
      },
      {
        name: "iTunes Turkey",
        slug: "itunes-turkey",
        region: "Turkey",
        description: "بطاقات آيتونز تركية بالليرة التركية.",
        variants: [
          { name: "بطاقة 100 ليرة", value: "₺100", price: 2300 },
          { name: "بطاقة 250 ليرة", value: "₺250", price: 5400 },
        ],
      },
      {
        name: "Google Play",
        slug: "google-play",
        region: "USA",
        description: "بطاقات جوجل بلاي للتطبيقات والألعاب.",
        variants: [
          { name: "بطاقة 10 دولار", value: "$10", price: 6100 },
          { name: "بطاقة 25 دولار", value: "$25", price: 14800 },
          { name: "بطاقة 50 دولار", value: "$50", price: 29000 },
        ],
      },
      {
        name: "Netflix",
        slug: "netflix",
        region: "USA",
        description: "بطاقات اشتراك نتفليكس.",
        variants: [
          { name: "بطاقة 25 دولار", value: "$25", price: 15500 },
          { name: "بطاقة 50 دولار", value: "$50", price: 30500 },
        ],
      },
      {
        name: "Shahid VIP",
        slug: "shahid-vip",
        description: "اشتراك شاهد VIP لمشاهدة المسلسلات والأفلام العربية.",
        variants: [
          { name: "اشتراك شهر", value: "1 Month", price: 4800 },
          { name: "اشتراك 3 أشهر", value: "3 Months", price: 13000 },
          { name: "اشتراك سنة", value: "12 Months", price: 46000 },
        ],
      },
    ],
  },
];

const BANNERS = [
  {
    title: "خصومات حصرية",
    subtitle: "على أشهر البطاقات الرقمية",
    ctaText: "تسوق الآن",
    ctaLink: "/category/games",
    sortOrder: 1,
  },
  {
    title: "اشحن رصيدك فوراً",
    subtitle: "بطاقات ليبيانا والمدار متوفرة دائماً",
    ctaText: "تسوق الآن",
    ctaLink: "/category/telecom",
    sortOrder: 2,
  },
  {
    title: "بطاقات الألعاب",
    subtitle: "PUBG · PlayStation · Steam بأفضل الأسعار",
    ctaText: "تسوق الآن",
    ctaLink: "/category/games",
    sortOrder: 3,
  },
];

async function main() {
  // ---------- settings ----------
  const settings: Record<string, string> = {
    site_name: "PLUS CARD",
    currency: "LYD",
    support_phone: "",
    support_email: "support@pluscard.ly",
    maintenance_mode: "false",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // ---------- users ----------
  const admin = await prisma.user.upsert({
    where: { email: "admin@pluscard.ly" },
    update: { role: "ADMIN", emailVerifiedAt: new Date() },
    create: {
      name: "مدير النظام",
      email: "admin@pluscard.ly",
      passwordHash: await hash("Admin@12345", 10),
      emailVerifiedAt: new Date(),
      role: "ADMIN",
      balance: 0,
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: "user@pluscard.ly" },
    update: { emailVerifiedAt: new Date() },
    create: {
      name: "مستخدم تجريبي",
      email: "user@pluscard.ly",
      passwordHash: await hash("User@12345", 10),
      emailVerifiedAt: new Date(),
      balance: 25_000, // 250.00 د.ل
    },
  });

  const hasOpeningDeposit = await prisma.transaction.findFirst({
    where: { userId: demo.id, type: "DEPOSIT" },
  });
  if (!hasOpeningDeposit) {
    // Drawn from the deposit series inside the same transaction, exactly as a
    // real credit would be — the seed must not create a movement the app could
    // not have created itself.
    await prisma.$transaction(async (tx) => {
      const counter = await tx.sequence.upsert({
        where: { key: "deposit" },
        create: { key: "deposit", value: 1 },
        update: { value: { increment: 1 } },
        select: { value: true },
      });

      await tx.transaction.create({
        data: {
          number: counter.value,
          userId: demo.id,
          type: "DEPOSIT",
          amount: 25_000,
          balanceAfter: 25_000,
          description: "رصيد افتتاحي",
          adminId: admin.id,
        },
      });
    });
  }

  // ---------- categories · products · variants ----------
  for (const [categoryIndex, category] of CATEGORIES.entries()) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: categoryIndex + 1 },
      create: {
        name: category.name,
        slug: category.slug,
        sortOrder: categoryIndex + 1,
      },
    });

    for (const [productIndex, product] of category.products.entries()) {
      const savedProduct = await prisma.product.upsert({
        where: { slug: product.slug },
        update: {
          name: product.name,
          categoryId: savedCategory.id,
          description: product.description,
          region: product.region,
          sortOrder: productIndex + 1,
        },
        create: {
          name: product.name,
          slug: product.slug,
          categoryId: savedCategory.id,
          description: product.description,
          region: product.region,
          sortOrder: productIndex + 1,
        },
      });

      for (const [variantIndex, variant] of product.variants.entries()) {
        const existing = await prisma.productVariant.findFirst({
          where: { productId: savedProduct.id, name: variant.name },
        });
        if (existing) {
          await prisma.productVariant.update({
            where: { id: existing.id },
            data: {
              value: variant.value,
              price: variant.price,
              sortOrder: variantIndex + 1,
            },
          });
        } else {
          await prisma.productVariant.create({
            data: {
              productId: savedProduct.id,
              name: variant.name,
              value: variant.value,
              price: variant.price,
              stock: variant.stock ?? 100,
              sortOrder: variantIndex + 1,
            },
          });
        }
      }
    }
  }

  // ---------- banners ----------
  const bannerCount = await prisma.banner.count();
  if (bannerCount === 0) {
    await prisma.banner.createMany({ data: BANNERS });
  }

  const [categories, products, variants] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
  ]);
  console.log(
    `Seed complete — ${categories} categories, ${products} products, ${variants} variants, ${await prisma.banner.count()} banners.`,
  );
  console.log("Admin: admin@pluscard.ly / Admin@12345");
  console.log("User:  user@pluscard.ly  / User@12345");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
