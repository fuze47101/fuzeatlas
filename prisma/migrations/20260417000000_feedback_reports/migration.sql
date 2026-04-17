-- Feedback / Report-A-Problem widget
-- One table + one enum. Users can submit from any page; admins triage on /admin/feedback.

CREATE TYPE "FeedbackStatus" AS ENUM (
  'NEW',
  'TRIAGED',
  'ACCEPTED',
  'IN_PROGRESS',
  'FIXED',
  'REJECTED',
  'DUPLICATE',
  'CLOSED'
);

CREATE TABLE "FeedbackReport" (
  "id" TEXT NOT NULL,

  "userId"    TEXT,
  "userEmail" TEXT,
  "userName"  TEXT,
  "userRole"  TEXT,

  "category"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL,

  "url"       TEXT,
  "portal"    TEXT,
  "userAgent" TEXT,
  "viewport"  TEXT,
  "referer"   TEXT,

  "screenshotUrl"    TEXT,
  "screenshotBucket" TEXT,
  "screenshotKey"    TEXT,

  "status"       "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "triagedById"  TEXT,
  "triagedAt"    TIMESTAMP(3),
  "triageNotes"  TEXT,

  "resolvedById"  TEXT,
  "resolvedAt"    TIMESTAMP(3),
  "resolution"    TEXT,
  "resolutionUrl" TEXT,

  "notifiedAt" TIMESTAMP(3),

  "priority" INTEGER,

  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- Foreign key to submitter (nullable; cached email/name preserve attribution if user is deleted)
ALTER TABLE "FeedbackReport"
  ADD CONSTRAINT "FeedbackReport_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes for admin list views (filter by status + category, order by createdAt)
CREATE INDEX "FeedbackReport_userId_idx"    ON "FeedbackReport"("userId");
CREATE INDEX "FeedbackReport_status_idx"    ON "FeedbackReport"("status");
CREATE INDEX "FeedbackReport_category_idx"  ON "FeedbackReport"("category");
CREATE INDEX "FeedbackReport_createdAt_idx" ON "FeedbackReport"("createdAt");
