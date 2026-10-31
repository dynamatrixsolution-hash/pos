-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'LEGACY_UNVERIFIED';

-- AlterTable
ALTER TABLE "OpeningStock" ADD COLUMN     "appliedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RequestResult" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequestResult_businessId_operation_key_key" ON "RequestResult"("businessId", "operation", "key");

