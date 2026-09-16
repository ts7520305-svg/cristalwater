-- Additive only: the source JSON and all existing message tables stay intact.
CREATE TABLE "InternalChatMessage" (
  "id" SERIAL NOT NULL,
  "messageId" TEXT NOT NULL,
  "actorKey" TEXT,
  "actorId" INTEGER,
  "actorType" TEXT,
  "technicianId" INTEGER,
  "author" TEXT,
  "requestId" TEXT,
  "text" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "legacyPayload" JSONB,
  CONSTRAINT "InternalChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InternalChatMessage_messageId_key" ON "InternalChatMessage"("messageId");
CREATE UNIQUE INDEX "InternalChatMessage_actorKey_requestId_key" ON "InternalChatMessage"("actorKey", "requestId");

CREATE TABLE "InternalChatImport" (
  "sourceHash" TEXT NOT NULL,
  "sourceText" TEXT NOT NULL,
  "messageCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InternalChatImport_pkey" PRIMARY KEY ("sourceHash")
);
