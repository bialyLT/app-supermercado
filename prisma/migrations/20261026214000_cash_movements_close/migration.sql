ALTER TABLE "Payment" ADD COLUMN "registerSessionId" UUID;
ALTER TABLE "CashRegisterSession"
  ADD COLUMN "declaredCash" DECIMAL(22,4),
  ADD COLUMN "expectedCash" DECIMAL(22,4),
  ADD COLUMN "difference" DECIMAL(22,4),
  ADD CONSTRAINT "CashRegisterSession_closure_values_check" CHECK (
    ("declaredCash" IS NULL AND "expectedCash" IS NULL AND "difference" IS NULL)
    OR ("declaredCash" IS NOT NULL AND "expectedCash" IS NOT NULL AND "difference" IS NOT NULL)
  );
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_registerSessionId_fkey"
  FOREIGN KEY ("tenantId", "registerSessionId") REFERENCES "CashRegisterSession"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "Payment_tenantId_registerSessionId_idx" ON "Payment"("tenantId", "registerSessionId");

CREATE TYPE "CashMovementType" AS ENUM ('OPENING', 'CASH_IN', 'CASH_OUT', 'CLOSING_COUNT');
CREATE TABLE "CashMovement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL,
  "registerSessionId" UUID NOT NULL,
  "type" "CashMovementType" NOT NULL,
  "amount" DECIMAL(22,4) NOT NULL,
  "currency" TEXT NOT NULL,
  "actorUserId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "referenceId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashMovement_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "CashMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "CashMovement_tenantId_registerSessionId_fkey" FOREIGN KEY ("tenantId", "registerSessionId") REFERENCES "CashRegisterSession"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "CashMovement_tenantId_actorUserId_fkey" FOREIGN KEY ("tenantId", "actorUserId") REFERENCES "User"("tenantId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE UNIQUE INDEX "CashMovement_tenantId_id_key" ON "CashMovement"("tenantId", "id");
CREATE INDEX "CashMovement_tenantId_registerSessionId_createdAt_idx" ON "CashMovement"("tenantId", "registerSessionId", "createdAt");

CREATE OR REPLACE FUNCTION prevent_cash_movement_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'CASH_MOVEMENT_APPEND_ONLY';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "CashMovement_append_only" BEFORE UPDATE OR DELETE ON "CashMovement" FOR EACH ROW EXECUTE FUNCTION prevent_cash_movement_mutation();

GRANT USAGE ON TYPE "CashMovementType" TO supermercado_app;
GRANT SELECT, INSERT ON "CashMovement" TO supermercado_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "CashMovement" FROM supermercado_app;
ALTER TABLE "CashMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CashMovement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CashMovement" TO supermercado_app
  USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant());

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON "Payment" TO supermercado_app;
