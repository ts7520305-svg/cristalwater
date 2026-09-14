ALTER TABLE "OperationalReminder" ADD COLUMN "sourceKey" TEXT, ADD COLUMN "metadata" JSONB;
CREATE UNIQUE INDEX "OperationalReminder_sourceKey_key" ON "OperationalReminder"("sourceKey");
