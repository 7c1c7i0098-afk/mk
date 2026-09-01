-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "description" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "helpLink" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "rechargeInstructions" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "redemptionInstructions" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "usageInstructions" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN "helpLink" TEXT;
ALTER TABLE "products" ADD COLUMN "rechargeInstructions" TEXT;
ALTER TABLE "products" ADD COLUMN "redemptionInstructions" TEXT;
ALTER TABLE "products" ADD COLUMN "usageInstructions" TEXT;
