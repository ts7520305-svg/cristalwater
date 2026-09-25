-- Preserve existing credentials/history; increment only on reviewed access changes.
ALTER TABLE "Technician" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_authVersion_nonnegative" CHECK ("authVersion" >= 0);
