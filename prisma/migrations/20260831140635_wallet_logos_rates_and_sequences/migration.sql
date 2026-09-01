/*
  Warnings:

  - Added the required column `number` to the `orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `number` to the `top_up_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN "exchangeRate" INTEGER;
ALTER TABLE "payment_methods" ADD COLUMN "logo" TEXT;

-- CreateTable
CREATE TABLE "sequences" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_orders" ("number", "createdAt", "discount", "id", "note", "orderNumber", "status", "subtotal", "total", "updatedAt", "userId") SELECT ROW_NUMBER() OVER (ORDER BY "createdAt" ASC), "createdAt", "discount", "id", "note", "orderNumber", "status", "subtotal", "total", "updatedAt", "userId" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "new_orders" RENAME TO "orders";
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");
CREATE TABLE "new_top_up_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "methodId" TEXT,
    "methodName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "credited" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "note" TEXT,
    "adminNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "top_up_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "top_up_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "top_up_requests_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "payment_methods" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_top_up_requests" ("number", "adminNote", "amount", "createdAt", "credited", "fee", "id", "methodId", "methodName", "note", "reference", "reviewedAt", "reviewedById", "status", "transactionId", "updatedAt", "userId") SELECT ROW_NUMBER() OVER (ORDER BY "createdAt" ASC), "adminNote", "amount", "createdAt", "credited", "fee", "id", "methodId", "methodName", "note", "reference", "reviewedAt", "reviewedById", "status", "transactionId", "updatedAt", "userId" FROM "top_up_requests";
DROP TABLE "top_up_requests";
ALTER TABLE "new_top_up_requests" RENAME TO "top_up_requests";
CREATE UNIQUE INDEX "top_up_requests_number_key" ON "top_up_requests"("number");
CREATE INDEX "top_up_requests_userId_createdAt_idx" ON "top_up_requests"("userId", "createdAt");
CREATE INDEX "top_up_requests_status_createdAt_idx" ON "top_up_requests"("status", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Seed the counters past everything that already exists.
INSERT INTO "sequences" ("key", "value") VALUES ('order', (SELECT COALESCE(MAX("number"), 0) FROM "orders"));
INSERT INTO "sequences" ("key", "value") VALUES ('deposit', (SELECT COALESCE(MAX("number"), 0) FROM "top_up_requests"));
