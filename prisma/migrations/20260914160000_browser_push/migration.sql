CREATE TABLE "WebPushSubscription" (
 "id" SERIAL NOT NULL, "endpoint" TEXT NOT NULL, "role" TEXT NOT NULL, "principalId" INTEGER NOT NULL,
 "subscription" JSONB NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");
CREATE INDEX "WebPushSubscription_role_principalId_active_idx" ON "WebPushSubscription"("role", "principalId", "active");
