CREATE TABLE "RepairQuotePortal" (
 "id" SERIAL NOT NULL,
 "quoteId" INTEGER NOT NULL,
 "clientId" INTEGER NOT NULL,
 "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "publishedBy" TEXT NOT NULL,
 "decision" TEXT,
 "decisionAt" TIMESTAMP(3),
 "reason" TEXT,
 CONSTRAINT "RepairQuotePortal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RepairQuotePortal_quoteId_key" ON "RepairQuotePortal"("quoteId");
CREATE INDEX "RepairQuotePortal_clientId_publishedAt_idx" ON "RepairQuotePortal"("clientId", "publishedAt");
ALTER TABLE "RepairQuotePortal" ADD CONSTRAINT "RepairQuotePortal_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "RepairQuote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RepairQuotePortal" ADD CONSTRAINT "RepairQuotePortal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
