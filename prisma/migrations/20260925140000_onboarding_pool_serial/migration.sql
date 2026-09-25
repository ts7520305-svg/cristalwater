-- Align the current Prisma model with the optional pool identifier introduced
-- by the legacy 20260614000100 migration. Existing values are preserved.
ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Pool_serialNumber_key" ON "Pool"("serialNumber");
