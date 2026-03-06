-- AlterEnum add SUSPENDED to UserStatus
ALTER TYPE "UserStatus" ADD VALUE 'SUSPENDED';

-- CreateTable AvailabilityConfig
CREATE TABLE "AvailabilityConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "availableDays" JSONB NOT NULL DEFAULT '[2,4]',
    "startHour" INTEGER NOT NULL DEFAULT 9,
    "endHour" INTEGER NOT NULL DEFAULT 17,
    "slotDurationMinutes" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "blockedDates" JSONB NOT NULL DEFAULT '[]',
    "maxBookingsPerDay" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityConfig_pkey" PRIMARY KEY ("id")
);
