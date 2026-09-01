/*
  Warnings:

  - Added the required column `number` to the `transactions` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "orderId" TEXT,
    "adminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "transactions_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "transactions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("number", "adminId", "amount", "balanceAfter", "createdAt", "description", "id", "orderId", "type", "userId")
SELECT
  COALESCE(
    (SELECT o."number" FROM "orders" o WHERE o."id" = t."orderId"),
    (SELECT tu."number" FROM "top_up_requests" tu WHERE tu."transactionId" = t."id"),
    (SELECT COALESCE(MAX(v."number"), 0)
       FROM (SELECT "number" FROM "orders" UNION ALL SELECT "number" FROM "top_up_requests") v)
      + ROW_NUMBER() OVER (ORDER BY t."createdAt")
  ),
  t."adminId", t."amount", t."balanceAfter", t."createdAt", t."description", t."id",
  t."orderId", t."type", t."userId"
FROM "transactions" t;
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_userId_createdAt_idx" ON "transactions"("userId", "createdAt");
CREATE INDEX "transactions_type_createdAt_idx" ON "transactions"("type", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
