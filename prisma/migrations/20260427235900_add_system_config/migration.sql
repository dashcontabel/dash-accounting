-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- Seed default: audit enabled
INSERT INTO "SystemConfig" ("key", "value", "updatedAt")
VALUES ('audit_enabled', 'true', NOW())
ON CONFLICT ("key") DO NOTHING;
