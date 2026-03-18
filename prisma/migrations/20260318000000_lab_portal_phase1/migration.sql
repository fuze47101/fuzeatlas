-- Lab Portal Phase 1: Add LAB_USER role and labId to User model
ALTER TYPE "UserRole" ADD VALUE 'LAB_USER';

-- Add labId foreign key to User table
ALTER TABLE "User" ADD COLUMN "labId" TEXT;

-- Create index for lab users
CREATE INDEX "User_labId_idx" ON "User"("labId");

-- Add foreign key constraint
ALTER TABLE "User" ADD CONSTRAINT "User_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
