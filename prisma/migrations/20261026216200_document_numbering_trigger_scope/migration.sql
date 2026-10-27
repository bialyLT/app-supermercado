-- W4 corrective: scope the one-time numbering exception to SaleReversal only.
-- 20261026216000 replaced the shared prevent_sale_reversal_mutation() with a
-- version that reads NEW."documentNumber"; that function is also attached to
-- SaleReversalLine, which has no such column, so owner UPDATE/DELETE on lines
-- raised 42703 instead of SALE_REVERSAL_APPEND_ONLY. Lines get their own pure
-- append-only function; the header table keeps the NULL-to-number one-time
-- exception for the migration backfill and the lazy repair of straggler rows.

CREATE OR REPLACE FUNCTION prevent_sale_reversal_line_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'SALE_REVERSAL_APPEND_ONLY'; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "SaleReversalLine_append_only" ON "SaleReversalLine";
CREATE TRIGGER "SaleReversalLine_append_only" BEFORE UPDATE OR DELETE ON "SaleReversalLine"
  FOR EACH ROW EXECUTE FUNCTION prevent_sale_reversal_line_mutation();
