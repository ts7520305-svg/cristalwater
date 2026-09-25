CREATE TABLE "TransportGuideAttachment" (
  "id" SERIAL NOT NULL,
  "guideId" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER,
  "sha256" TEXT,
  "bytes" BYTEA,
  "legacyRecord" JSONB,
  "createdBy" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TransportGuideAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TransportGuideAttachment_kind_check" CHECK ("kind" IN ('FILE','LEGACY')),
  CONSTRAINT "TransportGuideAttachment_actor_check" CHECK ("createdBy" ~ '^ADMIN:[1-9][0-9]*$'),
  CONSTRAINT "TransportGuideAttachment_content_check" CHECK (
    ("kind"='LEGACY' AND "bytes" IS NULL AND "size" IS NULL AND "sha256" IS NULL)
    OR ("bytes" IS NOT NULL AND "size" IS NOT NULL AND "sha256" IS NOT NULL
      AND "size">0 AND "size"<=26214400 AND octet_length("bytes")="size" AND "sha256" ~ '^[a-f0-9]{64}$')
  ),
  CONSTRAINT "TransportGuideAttachment_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "TransportGuide"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TransportGuideAttachment_guideId_id_idx" ON "TransportGuideAttachment"("guideId", "id");
CREATE UNIQUE INDEX "TransportGuideAttachment_createdBy_requestId_kind_key" ON "TransportGuideAttachment"("createdBy", "requestId", "kind");
