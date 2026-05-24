-- AlterTable
ALTER TABLE "RazaoEntry" ADD COLUMN     "costCenter" TEXT;

-- CreateIndex
CREATE INDEX "RazaoEntry_companyId_referenceMonth_costCenter_idx" ON "RazaoEntry"("companyId", "referenceMonth", "costCenter");
