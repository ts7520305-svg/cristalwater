CREATE TABLE "ClientRatePlan" (
 "id" SERIAL NOT NULL, "clientId" INTEGER NOT NULL, "version" INTEGER NOT NULL,
 "snapshot" JSONB NOT NULL, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ClientRatePlan_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ClientRatePlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ClientRatePlan_clientId_version_key" ON "ClientRatePlan"("clientId", "version");
