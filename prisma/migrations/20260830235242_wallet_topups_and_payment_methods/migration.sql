-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "instructions" TEXT,
    "feeBps" INTEGER NOT NULL DEFAULT 0,
    "feeFixed" INTEGER NOT NULL DEFAULT 0,
    "minAmount" INTEGER,
    "maxAmount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "top_up_requests" (
    "id" TEXT NOT NULL PRIMARY KEY,
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

-- CreateIndex
CREATE INDEX "payment_methods_isActive_sortOrder_idx" ON "payment_methods"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "top_up_requests_userId_createdAt_idx" ON "top_up_requests"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "top_up_requests_status_createdAt_idx" ON "top_up_requests"("status", "createdAt");
