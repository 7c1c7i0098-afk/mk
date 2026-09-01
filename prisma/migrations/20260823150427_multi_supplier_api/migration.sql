-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "externalProductId" TEXT;
ALTER TABLE "order_items" ADD COLUMN "externalVariantId" TEXT;
ALTER TABLE "order_items" ADD COLUMN "supplierCost" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "supplierCurrency" TEXT;
ALTER TABLE "order_items" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "order_items" ADD COLUMN "supplierName" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "markupType" TEXT;
ALTER TABLE "products" ADD COLUMN "markupValue" INTEGER;

-- CreateTable
CREATE TABLE "suppliers" (
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

-- CreateTable
CREATE TABLE "supplier_products" (
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
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "supplier_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "product_supplier_mappings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "supplierProductId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "product_supplier_mappings_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_supplier_mappings_supplierProductId_fkey" FOREIGN KEY ("supplierProductId") REFERENCES "supplier_products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "product_supplier_mappings_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "supplier_sync_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "repriced" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_sync_logs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "supplier_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_audit_logs_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_product_variants" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT,
    "price" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "usageInstructions" TEXT,
    "rechargeInstructions" TEXT,
    "redemptionInstructions" TEXT,
    "helpLink" TEXT,
    "priceMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "markupType" TEXT,
    "markupValue" INTEGER,
    CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_product_variants" ("description", "helpLink", "id", "isActive", "name", "price", "productId", "rechargeInstructions", "redemptionInstructions", "sortOrder", "stock", "usageInstructions", "value") SELECT "description", "helpLink", "id", "isActive", "name", "price", "productId", "rechargeInstructions", "redemptionInstructions", "sortOrder", "stock", "usageInstructions", "value" FROM "product_variants";
DROP TABLE "product_variants";
ALTER TABLE "new_product_variants" RENAME TO "product_variants";
CREATE INDEX "product_variants_productId_isActive_sortOrder_idx" ON "product_variants"("productId", "isActive", "sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_slug_key" ON "suppliers"("slug");

-- CreateIndex
CREATE INDEX "suppliers_status_name_idx" ON "suppliers"("status", "name");

-- CreateIndex
CREATE INDEX "supplier_products_supplierId_isSelected_idx" ON "supplier_products"("supplierId", "isSelected");

-- CreateIndex
CREATE INDEX "supplier_products_supplierId_name_idx" ON "supplier_products"("supplierId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_products_supplierId_externalProductId_externalVariantId_key" ON "supplier_products"("supplierId", "externalProductId", "externalVariantId");

-- CreateIndex
CREATE INDEX "product_supplier_mappings_supplierId_idx" ON "product_supplier_mappings"("supplierId");

-- CreateIndex
CREATE INDEX "product_supplier_mappings_variantId_isPreferred_idx" ON "product_supplier_mappings"("variantId", "isPreferred");

-- CreateIndex
CREATE UNIQUE INDEX "product_supplier_mappings_variantId_supplierProductId_key" ON "product_supplier_mappings"("variantId", "supplierProductId");

-- CreateIndex
CREATE INDEX "supplier_sync_logs_supplierId_createdAt_idx" ON "supplier_sync_logs"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_audit_logs_supplierId_createdAt_idx" ON "supplier_audit_logs"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "supplier_audit_logs_createdAt_idx" ON "supplier_audit_logs"("createdAt");
