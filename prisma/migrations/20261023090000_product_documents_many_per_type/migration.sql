-- ProductDocument: allow many documents per (docType, productLine, language).
--
-- The composite unique below forced exactly one row per slot, so the admin
-- upload route's upsert silently replaced the existing document instead of
-- adding alongside it. Dropping the constraint is additive: no rows change,
-- nothing is rewritten, and the lookup is preserved as a plain index.
DROP INDEX IF EXISTS "ProductDocument_docType_productLine_language_key";

CREATE INDEX IF NOT EXISTS "ProductDocument_docType_productLine_language_idx"
  ON "ProductDocument" ("docType", "productLine", "language");
