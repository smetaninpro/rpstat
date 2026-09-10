CREATE TABLE "MaterialAttachment" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialAttachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MaterialAttachment_storageKey_key" ON "MaterialAttachment"("storageKey");
CREATE INDEX "MaterialAttachment_materialId_idx" ON "MaterialAttachment"("materialId");
ALTER TABLE "MaterialAttachment" ADD CONSTRAINT "MaterialAttachment_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
