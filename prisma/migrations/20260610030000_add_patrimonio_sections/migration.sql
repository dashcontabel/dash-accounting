-- Add self-referencing section relationship for patrimonio assets.
ALTER TABLE "PatrimonioAsset" ADD COLUMN "sectionId" TEXT;

CREATE INDEX "PatrimonioAsset_sectionId_idx" ON "PatrimonioAsset"("sectionId");

ALTER TABLE "PatrimonioAsset"
ADD CONSTRAINT "PatrimonioAsset_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "PatrimonioAsset"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
