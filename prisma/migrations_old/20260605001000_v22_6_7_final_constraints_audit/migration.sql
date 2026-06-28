-- Cristal Water V22.6.7 Final Enterprise Constraint Audit
-- Incremental: reforça soft-delete e remove cascades perigosos remanescentes.

-- Relações de cliente que devem preservar histórico/acessos/configurações.
DO $$ BEGIN
  ALTER TABLE "ClientAccess" DROP CONSTRAINT IF EXISTS "ClientAccess_clientId_fkey";
  ALTER TABLE "ClientAccess" ADD CONSTRAINT "ClientAccess_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClientMessage" DROP CONSTRAINT IF EXISTS "ClientMessage_clientId_fkey";
  ALTER TABLE "ClientMessage" ADD CONSTRAINT "ClientMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClientReportSetting" DROP CONSTRAINT IF EXISTS "ClientReportSetting_clientId_fkey";
  ALTER TABLE "ClientReportSetting" ADD CONSTRAINT "ClientReportSetting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "MonthlyReport" DROP CONSTRAINT IF EXISTS "MonthlyReport_clientId_fkey";
  ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_clientId_fkey";
  ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Histórico de atribuição de viaturas não pode desaparecer se técnico/viatura forem removidos fisicamente por engano.
DO $$ BEGIN
  ALTER TABLE "TechnicianVehicleLog" DROP CONSTRAINT IF EXISTS "TechnicianVehicleLog_technicianId_fkey";
  ALTER TABLE "TechnicianVehicleLog" ADD CONSTRAINT "TechnicianVehicleLog_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TechnicianVehicleLog" DROP CONSTRAINT IF EXISTS "TechnicianVehicleLog_vehicleId_fkey";
  ALTER TABLE "TechnicianVehicleLog" ADD CONSTRAINT "TechnicianVehicleLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Rondas/GPS: preservar técnicos, logs e tracking histórico.
DO $$ BEGIN
  ALTER TABLE "RoundTechnician" DROP CONSTRAINT IF EXISTS "RoundTechnician_technicianId_fkey";
  ALTER TABLE "RoundTechnician" ADD CONSTRAINT "RoundTechnician_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TechnicianLocation" DROP CONSTRAINT IF EXISTS "TechnicianLocation_userId_fkey";
  ALTER TABLE "TechnicianLocation" ADD CONSTRAINT "TechnicianLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TechnicianLocation" DROP CONSTRAINT IF EXISTS "TechnicianLocation_technicianId_fkey";
  ALTER TABLE "TechnicianLocation" ADD CONSTRAINT "TechnicianLocation_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TechnicianTrack" DROP CONSTRAINT IF EXISTS "TechnicianTrack_userId_fkey";
  ALTER TABLE "TechnicianTrack" ADD CONSTRAINT "TechnicianTrack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TechnicianTrack" DROP CONSTRAINT IF EXISTS "TechnicianTrack_technicianId_fkey";
  ALTER TABLE "TechnicianTrack" ADD CONSTRAINT "TechnicianTrack_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
