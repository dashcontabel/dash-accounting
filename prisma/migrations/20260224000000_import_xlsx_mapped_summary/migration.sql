-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('XLSX');

-- CreateEnum
CREATE TYPE "MappingMatchType" AS ENUM ('EXACT', 'PREFIX', 'LIST');

-- CreateEnum
CREATE TYPE "MappingValueColumn" AS ENUM ('saldo_atual', 'debito', 'credito', 'saldo_anterior');

-- CreateEnum
CREATE TYPE "MappingAggregation" AS ENUM ('SUM', 'ABS_SUM');

-- AlterEnum ImportBatchStatus (SUCCESS -> DONE and add PENDING)
CREATE TYPE "ImportBatchStatus_new" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

ALTER TABLE "ImportBatch" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ImportBatch"
ALTER COLUMN "status" TYPE "ImportBatchStatus_new"
USING (
  CASE
    WHEN "status"::text = 'SUCCESS' THEN 'DONE'
    ELSE "status"::text
  END
)::"ImportBatchStatus_new";

ALTER TYPE "ImportBatchStatus" RENAME TO "ImportBatchStatus_old";
ALTER TYPE "ImportBatchStatus_new" RENAME TO "ImportBatchStatus";
DROP TYPE "ImportBatchStatus_old";

ALTER TABLE "ImportBatch" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "ImportBatch"
ADD COLUMN "sourceType" "ImportSourceType" NOT NULL DEFAULT 'XLSX';

-- CreateTable
CREATE TABLE "AccountMapping" (
    "id" TEXT NOT NULL,
    "dashboardField" TEXT NOT NULL,
    "matchType" "MappingMatchType" NOT NULL,
    "codes" JSONB NOT NULL,
    "valueColumn" "MappingValueColumn" NOT NULL,
    "aggregation" "MappingAggregation" NOT NULL,
    "isCalculated" BOOLEAN NOT NULL DEFAULT false,
    "formula" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardMonthlySummary" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "referenceMonth" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardMonthlySummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmappedAccount" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnmappedAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountMapping_dashboardField_idx" ON "AccountMapping"("dashboardField");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardMonthlySummary_companyId_referenceMonth_key" ON "DashboardMonthlySummary"("companyId", "referenceMonth");

-- CreateIndex
CREATE INDEX "DashboardMonthlySummary_companyId_referenceMonth_idx" ON "DashboardMonthlySummary"("companyId", "referenceMonth");

-- CreateIndex
CREATE INDEX "UnmappedAccount_importBatchId_idx" ON "UnmappedAccount"("importBatchId");

-- CreateIndex
CREATE INDEX "UnmappedAccount_accountCode_idx" ON "UnmappedAccount"("accountCode");

-- AddForeignKey
ALTER TABLE "DashboardMonthlySummary" ADD CONSTRAINT "DashboardMonthlySummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmappedAccount" ADD CONSTRAINT "UnmappedAccount_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
