ALTER TABLE "SaleLine" ADD COLUMN "sourceSnapshot" JSONB;

CREATE OR REPLACE FUNCTION protect_sale_line_source_snapshot() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."sourceSnapshot" IS DISTINCT FROM NEW."sourceSnapshot" THEN
      RAISE EXCEPTION 'SALE_LINE_SOURCE_SNAPSHOT_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER "SaleLine_source_snapshot_immutable"
  BEFORE UPDATE ON "SaleLine"
  FOR EACH ROW EXECUTE FUNCTION protect_sale_line_source_snapshot();
