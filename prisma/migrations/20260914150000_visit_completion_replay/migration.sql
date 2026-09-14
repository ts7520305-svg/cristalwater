ALTER TABLE "ServiceVisit" ADD COLUMN "completionRequestId" TEXT;
CREATE UNIQUE INDEX "ServiceVisit_completionRequestId_key" ON "ServiceVisit"("completionRequestId");
