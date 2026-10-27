-- Épica 3: perfil tributario argentino por Store (razón social) con ticket interno.

-- CreateEnum
CREATE TYPE "FiscalCondition" AS ENUM ('MONOTRIBUTO', 'RESPONSABLE_INSCRIPTO');

-- CreateTable
CREATE TABLE "FiscalProfile" (
  "id" UUID NOT NULL,
  "tenantId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "country" TEXT NOT NULL,
  "condition" "FiscalCondition" NOT NULL,
  "internalTicket" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FiscalProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FiscalProfile_tenantId_storeId_key" ON "FiscalProfile"("tenantId", "storeId");
CREATE INDEX "FiscalProfile_tenantId_idx" ON "FiscalProfile"("tenantId");

-- CreateForeignKey
ALTER TABLE "FiscalProfile" ADD CONSTRAINT "FiscalProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "FiscalProfile" ADD CONSTRAINT "FiscalProfile_tenantId_storeId_fkey" FOREIGN KEY ("tenantId", "storeId") REFERENCES "Store"("tenantId", "id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "fiscalSnapshot" JSONB;

-- Runtime grants: dedicated profile table only (no broad Store UPDATE is granted).
GRANT USAGE ON TYPE "FiscalCondition" TO "supermercado_app";
GRANT SELECT, INSERT, UPDATE ON "FiscalProfile" TO "supermercado_app";

-- Row-level security tenant isolation for the new fiscal table.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['FiscalProfile'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant())', table_name);
  END LOOP;
END $$;
