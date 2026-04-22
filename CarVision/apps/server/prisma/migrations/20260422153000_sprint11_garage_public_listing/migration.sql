-- Sprint 11: optional public garage listing text on User (role GARAGE)
ALTER TABLE "User" ADD COLUMN     "garageDescription" TEXT,
ADD COLUMN     "workingHoursText" TEXT;
