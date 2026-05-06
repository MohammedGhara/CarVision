-- AlterTable: optional garage map / listing fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "services" JSONB;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION;
