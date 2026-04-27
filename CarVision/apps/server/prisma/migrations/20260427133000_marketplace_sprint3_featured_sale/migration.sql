-- AlterTable
ALTER TABLE "MarketplaceListing"
ADD COLUMN "compareAtPriceCents" INTEGER,
ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
