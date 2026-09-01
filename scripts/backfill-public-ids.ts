/**
 * One-off backfill: gives every pre-existing account a public id.
 * Safe to re-run — accounts that already have one are skipped.
 */
import { prisma } from "../src/lib/db";
import { generateUniquePublicId } from "../src/lib/public-id";

async function main() {
  const pending = await prisma.user.findMany({
    where: { publicId: null },
    select: { id: true, email: true },
  });

  for (const user of pending) {
    const publicId = await generateUniquePublicId();
    await prisma.user.update({ where: { id: user.id }, data: { publicId } });
    console.log(`${user.email} -> ${publicId}`);
  }

  console.log(`backfilled ${pending.length} account(s)`);
  await prisma.$disconnect();
}

main();
