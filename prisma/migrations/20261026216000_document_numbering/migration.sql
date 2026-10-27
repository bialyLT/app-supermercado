-- W4 document numbering: atomic per-branch sequences plus documental closure.
-- Backfill policy (migration-time, creation order): every pre-numbering Sale
-- and SaleReversal receives its branch+type number ordered by (createdAt, id),
-- starting at 1 per partition. Numbers are internal and sequential; they carry
-- no fiscal meaning and never rewrite totals, payments, or movements (D-009).
-- Straggler rows created outside the service keep NULL and are repaired lazily
-- by the allocator on the next new document of the same branch+type.

CREATE TYPE "DocumentType" AS ENUM ('SALE', 'ANNULMENT', 'RETURN');

ALTER TABLE "Sale" ADD COLUMN "branchId" UUID;
ALTER TABLE "Sale" ADD COLUMN "documentNumber" INTEGER;

UPDATE "Sale" s SET "branchId" = l."branchId"
FROM "Location" l
WHERE l."id" = s."locationId" AND l."tenantId" = s."tenantId";

WITH ranked AS (
  SELECT s."id" AS "id",
    ROW_NUMBER() OVER (
      PARTITION BY s."tenantId", COALESCE(s."branchId", '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY s."createdAt" ASC, s."id" ASC
    ) AS n
  FROM "Sale" s
)
UPDATE "Sale" s SET "documentNumber" = r.n FROM ranked r WHERE r."id" = s."id";

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_branchId_fkey"
  FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE UNIQUE INDEX "Sale_tenantId_branchId_documentNumber_key" ON "Sale"("tenantId", "branchId", "documentNumber");
CREATE INDEX "Sale_tenantId_branchId_documentNumber_idx" ON "Sale"("tenantId", "branchId", "documentNumber");

ALTER TABLE "SaleReversal" ADD COLUMN "documentNumber" INTEGER;

-- One-time exception to append-only: assigning the new numbering column from
-- NULL is permitted exactly once per row; every other UPDATE or DELETE still
-- raises. This covers both this migration backfill and the lazy repair of
-- straggler rows created outside the service.
CREATE OR REPLACE FUNCTION prevent_sale_reversal_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'SALE_REVERSAL_APPEND_ONLY'; END IF;
  IF OLD."documentNumber" IS NULL AND NEW."documentNumber" IS NOT NULL
    AND NEW."id" IS NOT DISTINCT FROM OLD."id"
    AND NEW."tenantId" IS NOT DISTINCT FROM OLD."tenantId"
    AND NEW."saleId" IS NOT DISTINCT FROM OLD."saleId"
    AND NEW."branchId" IS NOT DISTINCT FROM OLD."branchId"
    AND NEW."registerSessionId" IS NOT DISTINCT FROM OLD."registerSessionId"
    AND NEW."type" IS NOT DISTINCT FROM OLD."type"
    AND NEW."status" IS NOT DISTINCT FROM OLD."status"
    AND NEW."actorUserId" IS NOT DISTINCT FROM OLD."actorUserId"
    AND NEW."reason" IS NOT DISTINCT FROM OLD."reason"
    AND NEW."idempotencyKey" IS NOT DISTINCT FROM OLD."idempotencyKey"
    AND NEW."total" IS NOT DISTINCT FROM OLD."total"
    AND NEW."currency" IS NOT DISTINCT FROM OLD."currency"
    AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'SALE_REVERSAL_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;

WITH ranked AS (
  SELECT r."id" AS "id",
    ROW_NUMBER() OVER (
      PARTITION BY r."tenantId", r."branchId", r."type"
      ORDER BY r."createdAt" ASC, r."id" ASC
    ) AS n
  FROM "SaleReversal" r
)
UPDATE "SaleReversal" r SET "documentNumber" = q.n FROM ranked q WHERE q."id" = r."id";

CREATE UNIQUE INDEX "SaleReversal_tenantId_branchId_type_documentNumber_key"
  ON "SaleReversal"("tenantId", "branchId", "type", "documentNumber");

CREATE TABLE "DocumentSequence" (
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "documentType" "DocumentType" NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("tenantId", "branchId", "documentType"),
  CONSTRAINT "DocumentSequence_lastNumber_check" CHECK ("lastNumber" >= 0),
  CONSTRAINT "DocumentSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "DocumentSequence_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "DocumentSequence_tenantId_idx" ON "DocumentSequence"("tenantId");

INSERT INTO "DocumentSequence" ("tenantId", "branchId", "documentType", "lastNumber")
SELECT "tenantId", "branchId", CAST('SALE' AS "DocumentType"), MAX("documentNumber")
FROM "Sale" WHERE "branchId" IS NOT NULL AND "documentNumber" IS NOT NULL
GROUP BY "tenantId", "branchId"
ON CONFLICT DO NOTHING;
INSERT INTO "DocumentSequence" ("tenantId", "branchId", "documentType", "lastNumber")
SELECT "tenantId", "branchId", CAST(CAST("type" AS TEXT) AS "DocumentType"), MAX("documentNumber")
FROM "SaleReversal" WHERE "documentNumber" IS NOT NULL
GROUP BY "tenantId", "branchId", "type"
ON CONFLICT DO NOTHING;

CREATE TABLE "DocumentClosure" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "actorUserId" UUID NOT NULL,
  "saleCount" INTEGER NOT NULL DEFAULT 0,
  "saleTotal" DECIMAL(22,4) NOT NULL DEFAULT 0,
  "saleMax" INTEGER NOT NULL DEFAULT 0,
  "annulmentCount" INTEGER NOT NULL DEFAULT 0,
  "annulmentTotal" DECIMAL(22,4) NOT NULL DEFAULT 0,
  "annulmentMax" INTEGER NOT NULL DEFAULT 0,
  "returnCount" INTEGER NOT NULL DEFAULT 0,
  "returnTotal" DECIMAL(22,4) NOT NULL DEFAULT 0,
  "returnMax" INTEGER NOT NULL DEFAULT 0,
  "paymentsTotal" DECIMAL(22,4) NOT NULL DEFAULT 0,
  "movementsIn" DECIMAL(22,4) NOT NULL DEFAULT 0,
  "movementsOut" DECIMAL(22,4) NOT NULL DEFAULT 0,
  "cashTotal" DECIMAL(22,4) NOT NULL DEFAULT 0,
  "netTotal" DECIMAL(22,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentClosure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentClosure_counts_check" CHECK (
    "saleCount" >= 0 AND "saleMax" >= 0 AND "annulmentCount" >= 0 AND "annulmentMax" >= 0
    AND "returnCount" >= 0 AND "returnMax" >= 0),
  CONSTRAINT "DocumentClosure_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "DocumentClosure_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "DocumentClosure_tenantId_actorUserId_fkey" FOREIGN KEY ("tenantId", "actorUserId") REFERENCES "User"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "DocumentClosure_tenantId_id_key" ON "DocumentClosure"("tenantId", "id");
CREATE UNIQUE INDEX "DocumentClosure_tenantId_idempotencyKey_key" ON "DocumentClosure"("tenantId", "idempotencyKey");
CREATE INDEX "DocumentClosure_tenantId_branchId_createdAt_idx" ON "DocumentClosure"("tenantId", "branchId", "createdAt");

-- Sequence rows advance only forward through the allocator: keys are immutable,
-- lastNumber is strictly monotonic, and rows are never deleted. Gap-freedom
-- itself comes from in-transaction allocation under a row lock (a rolled-back
-- transaction consumes nothing); the trigger keeps any direct UPDATE honest.
CREATE OR REPLACE FUNCTION protect_document_sequence() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'DOCUMENT_SEQUENCE_PROTECTED'; END IF;
  IF NEW."tenantId" IS DISTINCT FROM OLD."tenantId"
    OR NEW."branchId" IS DISTINCT FROM OLD."branchId"
    OR NEW."documentType" IS DISTINCT FROM OLD."documentType" THEN
    RAISE EXCEPTION 'DOCUMENT_SEQUENCE_PROTECTED';
  END IF;
  IF NEW."lastNumber" <= OLD."lastNumber" THEN RAISE EXCEPTION 'DOCUMENT_SEQUENCE_PROTECTED'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DocumentSequence_protect" BEFORE UPDATE OR DELETE ON "DocumentSequence"
  FOR EACH ROW EXECUTE FUNCTION protect_document_sequence();

CREATE OR REPLACE FUNCTION prevent_document_closure_mutation() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'DOCUMENT_CLOSURE_APPEND_ONLY'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DocumentClosure_append_only" BEFORE UPDATE OR DELETE ON "DocumentClosure"
  FOR EACH ROW EXECUTE FUNCTION prevent_document_closure_mutation();

GRANT USAGE ON TYPE "DocumentType" TO supermercado_app;
GRANT SELECT, INSERT, UPDATE ON "DocumentSequence" TO supermercado_app;
REVOKE DELETE, TRUNCATE ON "DocumentSequence" FROM supermercado_app;
GRANT SELECT, INSERT ON "DocumentClosure" TO supermercado_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "DocumentClosure" FROM supermercado_app;
-- Lazy repair of straggler rows touches numbering columns only; totals, lines,
-- payments, and movements stay append-only by convention and trigger.
GRANT UPDATE ("branchId", "documentNumber") ON "Sale" TO supermercado_app;
GRANT UPDATE ("documentNumber") ON "SaleReversal" TO supermercado_app;

ALTER TABLE "DocumentSequence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentSequence" FORCE ROW LEVEL SECURITY;
ALTER TABLE "DocumentClosure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentClosure" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DocumentSequence" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
CREATE POLICY tenant_isolation ON "DocumentClosure" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
