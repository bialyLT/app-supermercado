-- Épica 5: modelo persistente de categorías y promociones automáticas N×M por categoría

-- CreateTable ProductCategory
CREATE TABLE "ProductCategory" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "ProductCategory_code_check" CHECK (char_length(trim("code")) > 0),
  CONSTRAINT "ProductCategory_name_check" CHECK (char_length(trim("name")) > 0)
);

CREATE UNIQUE INDEX "ProductCategory_tenantId_id_key" ON "ProductCategory"("tenantId", "id");
CREATE UNIQUE INDEX "ProductCategory_tenantId_code_key" ON "ProductCategory"("tenantId", "code");
CREATE INDEX "ProductCategory_tenantId_name_idx" ON "ProductCategory"("tenantId", "name");
CREATE INDEX "ProductCategory_tenantId_active_idx" ON "ProductCategory"("tenantId", "active");

GRANT SELECT, INSERT, UPDATE, DELETE ON "ProductCategory" TO supermercado_app;

ALTER TABLE "ProductCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProductCategory" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

-- Add additive category reference to Product
ALTER TABLE "Product" ADD COLUMN "categoryId" UUID;
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_categoryId_fkey"
  FOREIGN KEY ("tenantId", "categoryId") REFERENCES "ProductCategory"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "Product_tenantId_categoryId_idx" ON "Product"("tenantId", "categoryId");

-- CreateTable Promotion
CREATE TABLE "Promotion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "branchId" UUID,
  "categoryId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "n" INTEGER NOT NULL,
  "m" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMPTZ(3),
  "validTo" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Promotion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "Promotion_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "Promotion_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "ProductCategory"("tenantId", "id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "Promotion_nxm_check" CHECK ("n" > "m" AND "m" >= 1),
  CONSTRAINT "Promotion_validity_check" CHECK ("validTo" IS NULL OR "validFrom" IS NULL OR "validTo" >= "validFrom"),
  CONSTRAINT "Promotion_name_check" CHECK (char_length(trim("name")) > 0)
);

CREATE UNIQUE INDEX "Promotion_tenantId_id_key" ON "Promotion"("tenantId", "id");
CREATE INDEX "Promotion_tenantId_categoryId_active_idx" ON "Promotion"("tenantId", "categoryId", "active");
CREATE INDEX "Promotion_tenantId_branchId_idx" ON "Promotion"("tenantId", "branchId");

GRANT SELECT, INSERT, UPDATE, DELETE ON "Promotion" TO supermercado_app;

ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promotion" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Promotion" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
