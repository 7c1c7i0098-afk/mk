-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "deliveredExpiry" TEXT;
ALTER TABLE "order_items" ADD COLUMN "deliveredSerial" TEXT;

-- CreateTable
CREATE TABLE "supplier_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "orderId" TEXT,
    "userId" TEXT,
    "productType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "orderUuid" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "externalVariantId" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "externalOrderId" TEXT,
    "externalStatus" TEXT,
    "paramsJson" TEXT,
    "responseJson" TEXT,
    "cost" INTEGER,
    "currency" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "lastError" TEXT,
    "refundedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "supplier_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "supplier_orders_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_supplier_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "externalVariantId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "category" TEXT,
    "variantLabel" TEXT,
    "cost" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "rawAvailability" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'GENERIC',
    "paramFieldsJson" TEXT,
    "minQty" INTEGER,
    "maxQty" INTEGER,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "supplier_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_supplier_products" ("availability", "category", "cost", "currency", "externalProductId", "externalVariantId", "firstSeenAt", "id", "isSelected", "lastSeenAt", "missingSince", "name", "rawAvailability", "supplierId", "updatedAt", "variantLabel") SELECT "availability", "category", "cost", "currency", "externalProductId", "externalVariantId", "firstSeenAt", "id", "isSelected", "lastSeenAt", "missingSince", "name", "rawAvailability", "supplierId", "updatedAt", "variantLabel" FROM "supplier_products";
DROP TABLE "supplier_products";
ALTER TABLE "new_supplier_products" RENAME TO "supplier_products";
CREATE INDEX "supplier_products_supplierId_isSelected_idx" ON "supplier_products"("supplierId", "isSelected");
CREATE INDEX "supplier_products_supplierId_name_idx" ON "supplier_products"("supplierId", "name");
CREATE UNIQUE INDEX "supplier_products_supplierId_externalProductId_externalVariantId_key" ON "supplier_products"("supplierId", "externalProductId", "externalVariantId");
CREATE TABLE "new_suppliers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'NONE',
    "secretCipher" TEXT,
    "secretHint" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'LYD',
    "rateMicros" INTEGER,
    "markupType" TEXT NOT NULL DEFAULT 'PERCENT',
    "markupValue" INTEGER NOT NULL DEFAULT 0,
    "environment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "lastTestAt" DATETIME,
    "lastTestOk" BOOLEAN,
    "lastTestMessage" TEXT,
    "lastSyncAt" DATETIME,
    "lastSuccessfulSyncAt" DATETIME,
    "lastSyncOutcome" TEXT,
    "lastSyncMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_suppliers" ("adapter", "authType", "baseUrl", "createdAt", "currency", "id", "lastSuccessfulSyncAt", "lastSyncAt", "lastSyncMessage", "lastSyncOutcome", "lastTestAt", "lastTestMessage", "lastTestOk", "markupType", "markupValue", "name", "notes", "rateMicros", "secretCipher", "secretHint", "slug", "status", "timeoutMs", "updatedAt") SELECT "adapter", "authType", "baseUrl", "createdAt", "currency", "id", "lastSuccessfulSyncAt", "lastSyncAt", "lastSyncMessage", "lastSyncOutcome", "lastTestAt", "lastTestMessage", "lastTestOk", "markupType", "markupValue", "name", "notes", "rateMicros", "secretCipher", "secretHint", "slug", "status", "timeoutMs", "updatedAt" FROM "suppliers";
DROP TABLE "suppliers";
ALTER TABLE "new_suppliers" RENAME TO "suppliers";
CREATE UNIQUE INDEX "suppliers_slug_key" ON "suppliers"("slug");
CREATE INDEX "suppliers_status_name_idx" ON "suppliers"("status", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "supplier_orders_orderItemId_key" ON "supplier_orders"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_orders_orderUuid_key" ON "supplier_orders"("orderUuid");

-- CreateIndex
CREATE INDEX "supplier_orders_supplierId_status_createdAt_idx" ON "supplier_orders"("supplierId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_orders_status_createdAt_idx" ON "supplier_orders"("status", "createdAt");
