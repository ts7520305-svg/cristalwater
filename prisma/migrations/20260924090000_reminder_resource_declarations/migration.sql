CREATE TABLE "ReminderResourceDeclaration" (
  "id" SERIAL NOT NULL,
  "reminderId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "poolId" INTEGER NOT NULL,
  "technicianId" INTEGER NOT NULL,
  "owner" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activeKey" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidedBy" TEXT,
  "voidReason" TEXT,
  CONSTRAINT "ReminderResourceDeclaration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReminderResourceDeclaration_identity" CHECK ("reminderId">0 AND "clientId">0 AND "poolId">0 AND "technicianId">0 AND "owner" ~ '^ADMIN:[1-9][0-9]*$' AND "fingerprint" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "ReminderResourceDeclaration_interval" CHECK (("startedAt" IS NULL AND "endedAt" IS NULL) OR ("startedAt" IS NOT NULL AND "endedAt" IS NOT NULL AND "endedAt">"startedAt" AND "endedAt"<="createdAt" AND date_trunc('second',"startedAt")="startedAt" AND date_trunc('second',"endedAt")="endedAt")),
  CONSTRAINT "ReminderResourceDeclaration_active" CHECK (("voidedAt" IS NULL AND "activeKey" IS NOT NULL AND "activeKey"='REMINDER:'||"reminderId"::text AND "voidedBy" IS NULL AND "voidReason" IS NULL) OR ("voidedAt" IS NOT NULL AND "voidedAt">="createdAt" AND "activeKey" IS NULL AND "voidedBy" IS NOT NULL AND "voidReason" IS NOT NULL AND "voidedBy" ~ '^ADMIN:[1-9][0-9]*$' AND length(trim("voidReason")) BETWEEN 3 AND 500))
);
CREATE UNIQUE INDEX "ReminderResourceDeclaration_activeKey_key" ON "ReminderResourceDeclaration"("activeKey");
CREATE UNIQUE INDEX "ReminderResourceDeclaration_owner_requestId_key" ON "ReminderResourceDeclaration"("owner","requestId");
CREATE INDEX "ReminderResourceDeclaration_reminderId_createdAt_idx" ON "ReminderResourceDeclaration"("reminderId","createdAt");
CREATE INDEX "ReminderResourceDeclaration_technicianId_startedAt_endedAt_idx" ON "ReminderResourceDeclaration"("technicianId","startedAt","endedAt");
