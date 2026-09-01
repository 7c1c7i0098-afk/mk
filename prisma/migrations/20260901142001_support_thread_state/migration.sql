-- CreateTable
CREATE TABLE "support_threads" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "closedAt" DATETIME,
    "closedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "support_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "support_threads_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
