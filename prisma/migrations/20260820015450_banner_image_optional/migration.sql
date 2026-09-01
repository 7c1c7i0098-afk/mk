-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_banners" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "image" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "ctaText" TEXT,
    "ctaLink" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_banners" ("createdAt", "ctaLink", "ctaText", "id", "image", "isActive", "sortOrder", "subtitle", "title", "updatedAt") SELECT "createdAt", "ctaLink", "ctaText", "id", "image", "isActive", "sortOrder", "subtitle", "title", "updatedAt" FROM "banners";
DROP TABLE "banners";
ALTER TABLE "new_banners" RENAME TO "banners";
CREATE INDEX "banners_isActive_sortOrder_idx" ON "banners"("isActive", "sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
