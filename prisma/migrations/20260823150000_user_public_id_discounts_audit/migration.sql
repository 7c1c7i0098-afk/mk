-- AlterTable
ALTER TABLE "users" ADD COLUMN "publicId" TEXT;

-- CreateTable
CREATE TABLE "user_discounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "percentBps" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_discounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_discounts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admin_action_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT,
    "targetUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER,
    "balanceBefore" INTEGER,
    "balanceAfter" INTEGER,
    "discountBeforeBps" INTEGER,
    "discountAfterBps" INTEGER,
    "productId" TEXT,
    "productName" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_action_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "admin_action_logs_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_discounts_userId_idx" ON "user_discounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_discounts_userId_productId_key" ON "user_discounts"("userId", "productId");

-- CreateIndex
CREATE INDEX "admin_action_logs_targetUserId_createdAt_idx" ON "admin_action_logs"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_action_logs_createdAt_idx" ON "admin_action_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");

-- CreateIndex
CREATE INDEX "users_publicId_idx" ON "users"("publicId");
