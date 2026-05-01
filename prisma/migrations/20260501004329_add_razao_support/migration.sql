-- AlterEnum
ALTER TYPE "ImportSourceType" ADD VALUE 'RAZAO';

-- CreateTable
CREATE TABLE "RazaoEntry" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "lot" TEXT,
    "counterpartCode" TEXT,
    "counterpartName" TEXT,
    "description" TEXT,
    "debit" DECIMAL(18,2) NOT NULL,
    "credit" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RazaoEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RazaoEntry_companyId_referenceMonth_idx" ON "RazaoEntry"("companyId", "referenceMonth");

-- CreateIndex
CREATE INDEX "RazaoEntry_companyId_referenceMonth_accountCode_idx" ON "RazaoEntry"("companyId", "referenceMonth", "accountCode");

-- CreateIndex
CREATE INDEX "RazaoEntry_importBatchId_idx" ON "RazaoEntry"("importBatchId");

-- AddForeignKey
ALTER TABLE "RazaoEntry" ADD CONSTRAINT "RazaoEntry_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RazaoEntry" ADD CONSTRAINT "RazaoEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
