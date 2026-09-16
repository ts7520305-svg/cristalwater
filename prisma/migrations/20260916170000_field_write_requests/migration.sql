CREATE TABLE "FieldWriteRequest" (
  "id" SERIAL NOT NULL,
  "owner" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "resourceId" INTEGER NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldWriteRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FieldWriteRequest_owner_requestId_key" ON "FieldWriteRequest"("owner", "requestId");
CREATE INDEX "FieldWriteRequest_scope_resourceId_idx" ON "FieldWriteRequest"("scope", "resourceId");
