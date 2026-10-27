CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'WALLET');

CREATE TABLE "Payment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "amount" DECIMAL(22,4) NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "currency" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorUserId" UUID NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Payment_tenantId_id_key" ON "Payment"("tenantId", "id");
CREATE INDEX "Payment_tenantId_saleId_idx" ON "Payment"("tenantId", "saleId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_saleId_fkey" FOREIGN KEY ("tenantId", "saleId") REFERENCES "Sale"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_actorUserId_fkey" FOREIGN KEY ("tenantId", "actorUserId") REFERENCES "User"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE OR REPLACE FUNCTION prevent_payment_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PAYMENT_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Payment_append_only" BEFORE UPDATE OR DELETE ON "Payment" FOR EACH ROW EXECUTE FUNCTION prevent_payment_mutation();

GRANT USAGE ON TYPE "PaymentMethod" TO supermercado_app;
GRANT SELECT, INSERT ON "Payment" TO supermercado_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "Payment" FROM supermercado_app;

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Payment" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());
