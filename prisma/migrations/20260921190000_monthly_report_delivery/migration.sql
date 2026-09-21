-- One durable reservation per report. Unknown results must not be sent again.
CREATE TABLE "MonthlyReportDelivery" (
  "id" SERIAL NOT NULL,
  "reportId" INTEGER NOT NULL,
  "requestId" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "requestedBy" INTEGER,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "emailLogId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyReportDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MonthlyReportDelivery_reportId_key" ON "MonthlyReportDelivery"("reportId");
CREATE UNIQUE INDEX "MonthlyReportDelivery_requestId_key" ON "MonthlyReportDelivery"("requestId");
CREATE UNIQUE INDEX "MonthlyReportDelivery_emailLogId_key" ON "MonthlyReportDelivery"("emailLogId");
CREATE INDEX "MonthlyReportDelivery_status_idx" ON "MonthlyReportDelivery"("status");
ALTER TABLE "MonthlyReportDelivery" ADD CONSTRAINT "MonthlyReportDelivery_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "MonthlyReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MonthlyReportDelivery" ADD CONSTRAINT "MonthlyReportDelivery_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "EmailLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
