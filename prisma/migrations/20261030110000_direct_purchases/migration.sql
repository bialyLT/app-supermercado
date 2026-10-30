-- Épica 6: recepción directa de compras con proveedor, impuestos, ledger y auditoría

-- CreateTable Supplier
CREATE TABLE "Supplier" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "taxId" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "Supplier_code_check" CHECK (char_length(trim("code")) > 0),
  CONSTRAINT "Supplier_name_check" CHECK (char_length(trim("name")) > 0)
);

CREATE UNIQUE INDEX "Supplier_tenantId_id_key" ON "Supplier"("tenantId", "id");
CREATE UNIQUE INDEX "Supplier_tenantId_code_key" ON "Supplier"("tenantId", "code");
CREATE INDEX "Supplier_tenantId_name_idx" ON "Supplier"("tenantId", "name");
CREATE INDEX "Supplier_tenantId_active_idx" ON "Supplier"("tenantId", "active");

GRANT SELECT, INSERT, UPDATE, DELETE ON "Supplier" TO supermercado_app;

ALTER TABLE "Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Supplier" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Supplier" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

-- CreateTable PurchaseReceipt
CREATE TABLE "PurchaseReceipt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "locationId" UUID NOT NULL,
  "supplierId" UUID NOT NULL,
  "receiptNumber" TEXT,
  "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currency" TEXT NOT NULL,
  "subtotal" DECIMAL(22, 4) NOT NULL,
  "taxTotal" DECIMAL(22, 4) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(22, 4) NOT NULL DEFAULT 0,
  "total" DECIMAL(22, 4) NOT NULL,
  "notes" TEXT,
  "actorUserId" UUID,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceipt_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceipt_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "Location"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceipt_tenantId_supplierId_fkey" FOREIGN KEY ("tenantId", "supplierId") REFERENCES "Supplier"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceipt_tenantId_actorUserId_fkey" FOREIGN KEY ("tenantId", "actorUserId") REFERENCES "User"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceipt_subtotal_check" CHECK ("subtotal" >= 0),
  CONSTRAINT "PurchaseReceipt_taxTotal_check" CHECK ("taxTotal" >= 0),
  CONSTRAINT "PurchaseReceipt_discountTotal_check" CHECK ("discountTotal" >= 0),
  CONSTRAINT "PurchaseReceipt_total_check" CHECK ("total" >= 0)
);

CREATE UNIQUE INDEX "PurchaseReceipt_tenantId_id_key" ON "PurchaseReceipt"("tenantId", "id");
CREATE UNIQUE INDEX "PurchaseReceipt_tenantId_idempotencyKey_key" ON "PurchaseReceipt"("tenantId", "idempotencyKey");
CREATE INDEX "PurchaseReceipt_tenantId_branchId_receivedAt_idx" ON "PurchaseReceipt"("tenantId", "branchId", "receivedAt");
CREATE INDEX "PurchaseReceipt_tenantId_supplierId_idx" ON "PurchaseReceipt"("tenantId", "supplierId");

GRANT SELECT, INSERT, UPDATE, DELETE ON "PurchaseReceipt" TO supermercado_app;

ALTER TABLE "PurchaseReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseReceipt" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PurchaseReceipt" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

-- CreateTable PurchaseReceiptLine
CREATE TABLE "PurchaseReceiptLine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "receiptId" UUID NOT NULL,
  "variantId" UUID NOT NULL,
  "lotId" UUID,
  "quantity" DECIMAL(18, 6) NOT NULL,
  "unitCost" DECIMAL(22, 4) NOT NULL,
  "subtotal" DECIMAL(22, 4) NOT NULL,
  "taxRate" DECIMAL(8, 4),
  "taxAmount" DECIMAL(22, 4) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(22, 4) NOT NULL DEFAULT 0,
  "total" DECIMAL(22, 4) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseReceiptLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseReceiptLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceiptLine_tenantId_receiptId_fkey" FOREIGN KEY ("tenantId", "receiptId") REFERENCES "PurchaseReceipt"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceiptLine_tenantId_variantId_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "ProductVariant"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceiptLine_tenantId_lotId_fkey" FOREIGN KEY ("tenantId", "lotId") REFERENCES "Lot"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "PurchaseReceiptLine_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "PurchaseReceiptLine_unitCost_check" CHECK ("unitCost" >= 0),
  CONSTRAINT "PurchaseReceiptLine_subtotal_check" CHECK ("subtotal" >= 0),
  CONSTRAINT "PurchaseReceiptLine_total_check" CHECK ("total" >= 0)
);

CREATE UNIQUE INDEX "PurchaseReceiptLine_tenantId_id_key" ON "PurchaseReceiptLine"("tenantId", "id");
CREATE INDEX "PurchaseReceiptLine_tenantId_receiptId_idx" ON "PurchaseReceiptLine"("tenantId", "receiptId");
CREATE INDEX "PurchaseReceiptLine_tenantId_variantId_idx" ON "PurchaseReceiptLine"("tenantId", "variantId");

GRANT SELECT, INSERT, UPDATE, DELETE ON "PurchaseReceiptLine" TO supermercado_app;

ALTER TABLE "PurchaseReceiptLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseReceiptLine" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PurchaseReceiptLine" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
