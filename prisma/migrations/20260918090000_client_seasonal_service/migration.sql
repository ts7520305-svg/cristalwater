-- Preserve visits created before seasonal service agreements.
ALTER TABLE "ServiceVisit" ADD COLUMN "contractService" JSONB;
