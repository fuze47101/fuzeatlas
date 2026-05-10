-- NotificationSubscription (Phase 5D — ROADMAP_v2)
--
-- One row per user; preferences JSON keyed by category. Default
-- empty JSON object — every category defaults to ON when missing.

CREATE TABLE "NotificationSubscription" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationSubscription_userId_key"
  ON "NotificationSubscription"("userId");

ALTER TABLE "NotificationSubscription"
  ADD CONSTRAINT "NotificationSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
