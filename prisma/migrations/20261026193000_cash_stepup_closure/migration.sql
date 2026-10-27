-- Additive context for legacy records; no historical cashier/session is invented.
ALTER TABLE "InventoryDiscrepancy" ADD COLUMN "registerSessionId" UUID;
ALTER TABLE "InventoryMovement" ADD COLUMN "registerSessionId" UUID;
ALTER TABLE "Price" ADD COLUMN "currency" TEXT, ALTER COLUMN "amount" TYPE DECIMAL(22,4);
ALTER TABLE "Sale" ADD COLUMN "currency" TEXT, ADD COLUMN "registerSessionId" UUID, ALTER COLUMN "total" TYPE DECIMAL(22,4);
ALTER TABLE "SaleLine" ALTER COLUMN "unitPrice" TYPE DECIMAL(22,4);
ALTER TABLE "UnverifiedIntakePolicy" ADD COLUMN "currency" TEXT,
  ADD COLUMN "maxSessionValue" DECIMAL(22,4), ADD COLUMN "reviewAfterDays" INTEGER NOT NULL DEFAULT 7,
  ADD CONSTRAINT "IntakePolicy_money_check" CHECK (("currency" IS NULL AND "maxSessionValue" IS NULL)
    OR ("currency" ~ '^[A-Z]{3}$' AND "maxSessionValue" > 0)),
  ADD CONSTRAINT "IntakePolicy_review_days_check" CHECK ("reviewAfterDays" BETWEEN 1 AND 365);
ALTER TABLE "UnverifiedIntakeReview" ADD COLUMN "currency" TEXT,
  ADD COLUMN "intakeValue" DECIMAL(22,4), ADD COLUMN "registerSessionId" UUID;

CREATE TABLE "CashRegisterSession" (
  "id" UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "registerId" UUID NOT NULL,
  "branchId" UUID NOT NULL, "userId" UUID NOT NULL, "currency" TEXT NOT NULL,
  "openedAt" TIMESTAMPTZ(3) NOT NULL, "closedAt" TIMESTAMPTZ(3), "closedBy" UUID,
  CONSTRAINT "CashRegisterSession_time_check" CHECK (("closedAt" IS NULL AND "closedBy" IS NULL)
    OR ("closedAt" >= "openedAt" AND "closedBy" IS NOT NULL))
);
CREATE UNIQUE INDEX "CashRegisterSession_tenantId_id_key" ON "CashRegisterSession"("tenantId", "id");
CREATE UNIQUE INDEX "CashRegisterSession_open_register_key" ON "CashRegisterSession"("tenantId", "registerId") WHERE "closedAt" IS NULL;
CREATE UNIQUE INDEX "CashRegisterSession_open_user_key" ON "CashRegisterSession"("tenantId", "userId") WHERE "closedAt" IS NULL;

CREATE TABLE "SupervisorCredential" (
  "tenantId" UUID NOT NULL, "userId" UUID NOT NULL, "pinHash" TEXT NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0, "lockedUntil" TIMESTAMPTZ(3),
  CONSTRAINT "SupervisorCredential_pkey" PRIMARY KEY ("tenantId", "userId"),
  CONSTRAINT "SupervisorCredential_attempts_check" CHECK ("failedAttempts" BETWEEN 0 AND 5)
);
CREATE TABLE "SupervisorApproval" (
  "id" UUID PRIMARY KEY, "tenantId" UUID NOT NULL, "registerSessionId" UUID NOT NULL,
  "requesterId" UUID NOT NULL, "approverId" UUID NOT NULL,
  "commandHash" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  CONSTRAINT "SupervisorApproval_distinct_actors_check" CHECK ("requesterId" <> "approverId"),
  CONSTRAINT "SupervisorApproval_ttl_check" CHECK ("expiresAt" BETWEEN "createdAt" + INTERVAL '60 seconds' AND "createdAt" + INTERVAL '120 seconds')
);
CREATE UNIQUE INDEX "SupervisorApproval_tenantId_tokenHash_key" ON "SupervisorApproval"("tenantId", "tokenHash");

ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_tenantId_registerSessionId_fkey" FOREIGN KEY ("tenantId", "registerSessionId") REFERENCES "CashRegisterSession"("tenantId", "id");
ALTER TABLE "UnverifiedIntakeReview" ADD CONSTRAINT "UnverifiedIntakeReview_tenantId_registerSessionId_fkey" FOREIGN KEY ("tenantId", "registerSessionId") REFERENCES "CashRegisterSession"("tenantId", "id");
ALTER TABLE "InventoryDiscrepancy" ADD CONSTRAINT "InventoryDiscrepancy_tenantId_registerSessionId_fkey" FOREIGN KEY ("tenantId", "registerSessionId") REFERENCES "CashRegisterSession"("tenantId", "id");
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_registerSessionId_fkey" FOREIGN KEY ("tenantId", "registerSessionId") REFERENCES "CashRegisterSession"("tenantId", "id");
ALTER TABLE "CashRegisterSession"
  ADD CONSTRAINT "CashRegisterSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"),
  ADD CONSTRAINT "CashRegisterSession_tenantId_registerId_fkey" FOREIGN KEY ("tenantId", "registerId") REFERENCES "CashRegister"("tenantId", "id"),
  ADD CONSTRAINT "CashRegisterSession_tenantId_branchId_fkey" FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id"),
  ADD CONSTRAINT "CashRegisterSession_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id"),
  ADD CONSTRAINT "CashRegisterSession_tenantId_closedBy_fkey" FOREIGN KEY ("tenantId", "closedBy") REFERENCES "User"("tenantId", "id");
ALTER TABLE "SupervisorCredential"
  ADD CONSTRAINT "SupervisorCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"),
  ADD CONSTRAINT "SupervisorCredential_tenantId_userId_fkey" FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id");
ALTER TABLE "SupervisorApproval"
  ADD CONSTRAINT "SupervisorApproval_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id"),
  ADD CONSTRAINT "SupervisorApproval_tenantId_registerSessionId_fkey" FOREIGN KEY ("tenantId", "registerSessionId") REFERENCES "CashRegisterSession"("tenantId", "id"),
  ADD CONSTRAINT "SupervisorApproval_tenantId_requesterId_fkey" FOREIGN KEY ("tenantId", "requesterId") REFERENCES "User"("tenantId", "id"),
  ADD CONSTRAINT "SupervisorApproval_tenantId_approverId_fkey" FOREIGN KEY ("tenantId", "approverId") REFERENCES "User"("tenantId", "id");

CREATE FUNCTION protect_register_session() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."closedAt" IS NOT NULL THEN RAISE EXCEPTION 'REGISTER_SESSION_IMMUTABLE'; END IF;
  IF NEW."closedAt" IS NULL OR ROW(NEW."id", NEW."tenantId", NEW."registerId", NEW."branchId", NEW."userId", NEW."currency", NEW."openedAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."tenantId", OLD."registerId", OLD."branchId", OLD."userId", OLD."currency", OLD."openedAt") THEN
    RAISE EXCEPTION 'REGISTER_SESSION_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "CashRegisterSession_immutable" BEFORE UPDATE OR DELETE ON "CashRegisterSession" FOR EACH ROW EXECUTE FUNCTION protect_register_session();

CREATE FUNCTION protect_supervisor_approval() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD."consumedAt" IS NOT NULL OR NEW."consumedAt" IS NULL
    OR (to_jsonb(NEW) - 'consumedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'consumedAt') THEN
    RAISE EXCEPTION 'SUPERVISOR_APPROVAL_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "SupervisorApproval_immutable" BEFORE UPDATE OR DELETE ON "SupervisorApproval" FOR EACH ROW EXECUTE FUNCTION protect_supervisor_approval();

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['CashRegisterSession','SupervisorCredential','SupervisorApproval'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING ("tenantId" = app_tenant()) WITH CHECK ("tenantId" = app_tenant())', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO supermercado_app', table_name);
  END LOOP;
END $$;
