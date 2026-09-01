/**
 * Promotes an existing account to administrator.
 *
 *   npm run db:make-admin -- someone@example.com
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("الاستخدام: npm run db:make-admin -- user@example.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) {
    console.error(`لا يوجد حساب بالبريد ${email} — أنشئ الحساب من الموقع أولاً.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN", emailVerifiedAt: new Date() },
  });

  console.log(`✓ ${user.name} (${email}) أصبح مديراً — افتح /admin`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
