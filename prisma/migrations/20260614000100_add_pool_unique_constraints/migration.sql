-- Cristal Water - bloqueio de equipamentos duplicados.
-- Mantem o modelo atual com IDs inteiros e acrescenta controlo fisico/logico.

ALTER TABLE "Pool"
  ADD COLUMN IF NOT EXISTS "serialNumber" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Pool_serialNumber_key"
  ON "Pool"("serialNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "pool_physical_location_unique"
  ON "Pool"("address", "location", "type");
