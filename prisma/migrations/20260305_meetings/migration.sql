-- CreateTable: Meeting
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingType" TEXT NOT NULL DEFAULT 'INTERNAL',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Taipei',
    "location" TEXT,
    "teamsLink" TEXT,
    "calendarUrl" TEXT,
    "brandId" TEXT,
    "projectId" TEXT,
    "pipelineStage" TEXT,
    "autoScheduled" BOOLEAN NOT NULL DEFAULT false,
    "organizerId" TEXT,
    "attendees" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Meeting_startTime_idx" ON "Meeting"("startTime");
CREATE INDEX "Meeting_brandId_idx" ON "Meeting"("brandId");
CREATE INDEX "Meeting_projectId_idx" ON "Meeting"("projectId");
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");
CREATE INDEX "Meeting_meetingType_idx" ON "Meeting"("meetingType");

-- Foreign Keys
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
