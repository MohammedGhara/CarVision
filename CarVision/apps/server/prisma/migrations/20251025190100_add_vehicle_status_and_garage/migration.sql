-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('PENDING', 'IN_FIXING', 'DONE');

-- AlterTable
ALTER TABLE "Vehicle" 
  ADD COLUMN "status" "VehicleStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "garageId" TEXT;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_garageId_fkey" FOREIGN KEY ("garageId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey (old relation)
ALTER TABLE "Vehicle" DROP CONSTRAINT IF EXISTS "Vehicle_ownerId_fkey";

-- AddForeignKey (new relations)
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


