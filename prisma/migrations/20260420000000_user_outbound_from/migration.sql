-- BD Wizard — per-rep outbound identity
--
-- Each rep who uses the BD wizard needs to configure the From: address
-- that their outbound emails ship from. Andrew's decision on the overhaul
-- (locked 2026-04-20) was:
--   "setup per rep of where the email is coming from. i would also suggest
--    that the rep gets a bcc on the outbound email so they know exactly
--    what went out and how it looked"
--
-- This migration just adds the config columns. The BCC-the-rep behavior
-- lives in the send pipeline — we send a separate "what went out" summary
-- email to the rep immediately after the outbound is dispatched.

ALTER TABLE "User"
  ADD COLUMN "outboundFromEmail" TEXT,
  ADD COLUMN "outboundFromName"  TEXT,
  ADD COLUMN "outboundSignature" TEXT;
