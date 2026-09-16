CREATE TABLE "ClientChatLegacyRecord" (
    "recordKey" TEXT NOT NULL,
    "clientId" INTEGER,
    "payload" JSONB NOT NULL,
    "readByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "readByClient" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientChatLegacyRecord_pkey" PRIMARY KEY ("recordKey")
);
CREATE INDEX "ClientChatLegacyRecord_clientId_idx" ON "ClientChatLegacyRecord"("clientId");
CREATE TABLE "ClientChatImport" (
    "sourceHash" TEXT NOT NULL,
    "sourceBytes" BYTEA NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientChatImport_pkey" PRIMARY KEY ("sourceHash")
);
ALTER TABLE "ClientMessage" ADD COLUMN "legacyKey" TEXT,
    ADD COLUMN "isReadByClient" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "ClientMessage_legacyKey_key" ON "ClientMessage"("legacyKey");
ALTER TABLE "ClientMessage" ADD CONSTRAINT "ClientMessage_legacyKey_fkey"
    FOREIGN KEY ("legacyKey") REFERENCES "ClientChatLegacyRecord"("recordKey") ON DELETE SET NULL ON UPDATE CASCADE;
