-- AlterTable: optional location fields on User (used for role GARAGE; nullable for backward compatibility)
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION;

-- When coordinates are set, keep them within valid WGS-84 ranges
ALTER TABLE "User" ADD CONSTRAINT "User_latitude_range" CHECK ("latitude" IS NULL OR ("latitude" >= -90::double precision AND "latitude" <= 90::double precision));

ALTER TABLE "User" ADD CONSTRAINT "User_longitude_range" CHECK ("longitude" IS NULL OR ("longitude" >= -180::double precision AND "longitude" <= 180::double precision));
