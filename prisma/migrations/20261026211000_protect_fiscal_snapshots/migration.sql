-- Corrección acotada T2: protección de snapshot fiscal y condición interna-only.

ALTER TABLE "FiscalProfile" ADD CONSTRAINT "FiscalProfile_country_internal_check" CHECK ("country" = 'AR' AND "internalTicket" = true);

CREATE OR REPLACE FUNCTION protect_fiscal_snapshot() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."fiscalSnapshot" IS DISTINCT FROM NEW."fiscalSnapshot" THEN
      RAISE EXCEPTION 'FISCAL_SNAPSHOT_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "Sale_fiscal_snapshot_immutable" BEFORE UPDATE ON "Sale" FOR EACH ROW EXECUTE FUNCTION protect_fiscal_snapshot();

CREATE OR REPLACE FUNCTION prevent_fiscal_sale_deletion() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."fiscalSnapshot" IS NOT NULL THEN
      RAISE EXCEPTION 'FISCAL_SNAPSHOT_PROTECTED';
    END IF;
  END IF;
  RETURN OLD;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "Sale_fiscal_snapshot_deletion_protected" BEFORE DELETE ON "Sale" FOR EACH ROW EXECUTE FUNCTION prevent_fiscal_sale_deletion();
