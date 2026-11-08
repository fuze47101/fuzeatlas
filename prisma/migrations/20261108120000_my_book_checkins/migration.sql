-- My Book / weekly check-in (Nov 2026)

ALTER TABLE "Brand" ADD COLUMN "forecastQuarter" TEXT;
ALTER TABLE "Brand" ADD COLUMN "galaLead" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Factory" ADD COLUMN "pipelineStage" "PipelineStage";
ALTER TABLE "Factory" ADD COLUMN "forecastQuarter" TEXT;
ALTER TABLE "Factory" ADD COLUMN "galaLead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Factory" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "ask" TEXT NOT NULL,
    "resolution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "ackedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AccountCheckin" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "headline" TEXT,
    "note" TEXT,
    "noteLang" TEXT,
    "noteEn" TEXT,
    "nextStep" TEXT,
    "nextStepAt" TIMESTAMP(3),
    "stageBefore" TEXT,
    "stageAfter" TEXT,
    "forecastBefore" TEXT,
    "forecastAfter" TEXT,
    "orderProduct" TEXT,
    "orderKg" DOUBLE PRECISION,
    "orderMonth" TEXT,
    "helpRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountCheckin_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HelpRequest_assigneeId_status_idx" ON "HelpRequest"("assigneeId", "status");
CREATE INDEX "HelpRequest_requesterId_status_idx" ON "HelpRequest"("requesterId", "status");
CREATE INDEX "HelpRequest_entityType_entityId_idx" ON "HelpRequest"("entityType", "entityId");
CREATE INDEX "HelpRequest_status_dueAt_idx" ON "HelpRequest"("status", "dueAt");

CREATE INDEX "AccountCheckin_entityType_entityId_createdAt_idx" ON "AccountCheckin"("entityType", "entityId", "createdAt");
CREATE INDEX "AccountCheckin_userId_weekOf_idx" ON "AccountCheckin"("userId", "weekOf");
CREATE INDEX "AccountCheckin_kind_createdAt_idx" ON "AccountCheckin"("kind", "createdAt");
CREATE INDEX "AccountCheckin_weekOf_idx" ON "AccountCheckin"("weekOf");

ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HelpRequest" ADD CONSTRAINT "HelpRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountCheckin" ADD CONSTRAINT "AccountCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountCheckin" ADD CONSTRAINT "AccountCheckin_helpRequestId_fkey" FOREIGN KEY ("helpRequestId") REFERENCES "HelpRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
