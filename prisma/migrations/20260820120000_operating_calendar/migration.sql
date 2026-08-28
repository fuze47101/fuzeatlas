-- Operating Calendar board.
-- Additive only: one new table, no ALTER on any existing table.

CREATE TABLE "OperatingCalendarEvent" (
    "id" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "lane" TEXT NOT NULL DEFAULT 'fuze',
    "account" TEXT,
    "status" TEXT NOT NULL DEFAULT 'tentative',
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "isShow" BOOLEAN NOT NULL DEFAULT false,
    "holds" BOOLEAN NOT NULL DEFAULT true,
    "detail" TEXT,
    "sortHint" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatingCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperatingCalendarEvent_ownerEmail_startDate_idx"
    ON "OperatingCalendarEvent"("ownerEmail", "startDate");
