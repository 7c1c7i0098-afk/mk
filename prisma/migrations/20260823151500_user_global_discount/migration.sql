-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_discounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_discounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_discounts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_discounts" ("createdAt", "id", "percentBps", "productId", "updatedAt", "userId") SELECT "createdAt", "id", "percentBps", "productId", "updatedAt", "userId" FROM "user_discounts";
DROP TABLE "user_discounts";
ALTER TABLE "new_user_discounts" RENAME TO "user_discounts";
CREATE INDEX "user_discounts_userId_idx" ON "user_discounts"("userId");
CREATE UNIQUE INDEX "user_discounts_userId_productId_key" ON "user_discounts"("userId", "productId");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "emailVerifiedAt" DATETIME,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "discountBps" INTEGER NOT NULL DEFAULT 0,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("balance", "createdAt", "email", "emailVerifiedAt", "id", "image", "name", "passwordHash", "phone", "publicId", "role", "sessionVersion", "status", "updatedAt") SELECT "balance", "createdAt", "email", "emailVerifiedAt", "id", "image", "name", "passwordHash", "phone", "publicId", "role", "sessionVersion", "status", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_publicId_key" ON "users"("publicId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_publicId_idx" ON "users"("publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

