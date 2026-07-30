ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SETTING_UPDATE';

CREATE TABLE "CompanySetting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanySetting_companyId_key_key" ON "CompanySetting"("companyId", "key");

CREATE INDEX "CompanySetting_companyId_idx" ON "CompanySetting"("companyId");

ALTER TABLE "CompanySetting"
ADD CONSTRAINT "CompanySetting_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
