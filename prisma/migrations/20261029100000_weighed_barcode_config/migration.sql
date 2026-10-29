CREATE TYPE "WeighedBarcodeMode" AS ENUM ('PRICE', 'WEIGHT');

CREATE TABLE "WeighedBarcodeConfig" (
  "tenantId" UUID NOT NULL,
  "prefix" TEXT NOT NULL,
  "mode" "WeighedBarcodeMode" NOT NULL,
  "variantDigits" INTEGER NOT NULL,
  "valueDigits" INTEGER NOT NULL,
  "valueScale" INTEGER NOT NULL,
  CONSTRAINT "WeighedBarcodeConfig_pkey" PRIMARY KEY ("tenantId"),
  CONSTRAINT "WeighedBarcodeConfig_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "WeighedBarcodeConfig_prefix_digits_check" CHECK ("prefix" ~ '^[0-9]+$'),
  CONSTRAINT "WeighedBarcodeConfig_layout_check" CHECK ("variantDigits" > 0 AND "valueDigits" > 0 AND "valueScale" >= 0 AND char_length("prefix") + "variantDigits" + "valueDigits" = 12)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "WeighedBarcodeConfig" TO supermercado_app;
ALTER TABLE "WeighedBarcodeConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WeighedBarcodeConfig" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WeighedBarcodeConfig" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
