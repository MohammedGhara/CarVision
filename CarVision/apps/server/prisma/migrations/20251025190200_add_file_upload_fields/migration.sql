-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "fileName" TEXT,
ADD COLUMN IF NOT EXISTS "fileUrl" TEXT,
ADD COLUMN IF NOT EXISTS "fileSize" INTEGER;

-- Note: mimeType column already exists, so we don't need to add it
-- If mimeType doesn't exist, uncomment the line below:
-- ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "mimeType" TEXT;

-- AlterEnum: Add new message types
-- Note: PostgreSQL doesn't support ALTER TYPE easily, so we'll handle this in the application
-- The enum values IMAGE, VIDEO, DOCUMENT should already be added or will be added by Prisma

