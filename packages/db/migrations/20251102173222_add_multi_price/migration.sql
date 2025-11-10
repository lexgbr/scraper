-- AlterTable
ALTER TABLE "PriceSnapshot" ADD COLUMN "packPrice" REAL;
ALTER TABLE "PriceSnapshot" ADD COLUMN "packSize" INTEGER;
ALTER TABLE "PriceSnapshot" ADD COLUMN "unitPrice" REAL;

-- AlterTable
ALTER TABLE "ProductLink" ADD COLUMN "lastPricePack" REAL;
ALTER TABLE "ProductLink" ADD COLUMN "lastPriceUnit" REAL;
ALTER TABLE "ProductLink" ADD COLUMN "packLabel" TEXT;
ALTER TABLE "ProductLink" ADD COLUMN "packSize" INTEGER;
ALTER TABLE "ProductLink" ADD COLUMN "unitLabel" TEXT;
