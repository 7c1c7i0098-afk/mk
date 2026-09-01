/**
 * Links artwork dropped into public/uploads/categories/ to the matching
 * category row, by file name:
 *
 *   public/uploads/categories/telecom.png    -> الاتصالات
 *   public/uploads/categories/education.png  -> التعليم
 *   public/uploads/categories/games.png      -> الألعاب
 *   public/uploads/categories/stores.png     -> المتاجر
 *
 * Run with: npm run db:images
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "categories");
const EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".avif"];

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

async function main() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    console.error(`المجلد غير موجود: ${UPLOAD_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(UPLOAD_DIR)
    .filter((file) => EXTENSIONS.includes(path.extname(file).toLowerCase()));

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, image: true },
    orderBy: { sortOrder: "asc" },
  });

  let linked = 0;
  for (const category of categories) {
    const match = files.find(
      (file) => path.basename(file, path.extname(file)).toLowerCase() === category.slug,
    );

    if (!match) {
      console.log(`✗ ${category.name} (${category.slug}) — لا يوجد ملف مطابق`);
      continue;
    }

    const image = `/uploads/categories/${match}`;
    if (category.image === image) {
      console.log(`= ${category.name} — ${image}`);
      continue;
    }

    await prisma.category.update({ where: { id: category.id }, data: { image } });
    console.log(`✓ ${category.name} — ${image}`);
    linked += 1;
  }

  console.log(`\nتم تحديث ${linked} فئة.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
