-- CreateEnum
CREATE TYPE "PatrimonioRowType" AS ENUM ('SECTION', 'ASSET', 'SUBTOTAL', 'TOTAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'PATRIMONIO_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'PATRIMONIO_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'PATRIMONIO_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'GROUP_UPDATE';

-- CreateTable
CREATE TABLE "PatrimonioAsset" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sublabel" TEXT,
    "rowType" "PatrimonioRowType" NOT NULL DEFAULT 'ASSET',
    "economico" DECIMAL(18,2),
    "financeiro" DECIMAL(18,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatrimonioAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatrimonioAsset_groupId_referenceMonth_idx" ON "PatrimonioAsset"("groupId", "referenceMonth");

-- CreateIndex
CREATE INDEX "PatrimonioAsset_groupId_idx" ON "PatrimonioAsset"("groupId");

-- AddForeignKey
ALTER TABLE "PatrimonioAsset" ADD CONSTRAINT "PatrimonioAsset_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
