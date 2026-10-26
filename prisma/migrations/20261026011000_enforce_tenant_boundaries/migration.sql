-- Every tenant-scoped relationship includes the tenant key. This prevents a
-- valid UUID from another tenant being attached through an otherwise valid FK.

CREATE UNIQUE INDEX "Store_tenantId_id_key" ON "Store"("tenantId", "id");
CREATE UNIQUE INDEX "Branch_tenantId_id_key" ON "Branch"("tenantId", "id");
CREATE UNIQUE INDEX "CashRegister_tenantId_id_key" ON "CashRegister"("tenantId", "id");
CREATE UNIQUE INDEX "User_tenantId_id_key" ON "User"("tenantId", "id");
CREATE UNIQUE INDEX "Role_tenantId_id_key" ON "Role"("tenantId", "id");

ALTER TABLE "Branch"
  ADD CONSTRAINT "Branch_tenantId_storeId_fkey"
  FOREIGN KEY ("tenantId", "storeId") REFERENCES "Store"("tenantId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashRegister"
  ADD CONSTRAINT "CashRegister_tenantId_branchId_fkey"
  FOREIGN KEY ("tenantId", "branchId") REFERENCES "Branch"("tenantId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserRole"
  ADD COLUMN "tenantId" UUID;

UPDATE "UserRole" AS ur
SET "tenantId" = u."tenantId"
FROM "User" AS u
WHERE u."id" = ur."userId";

ALTER TABLE "UserRole"
  ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "UserRole"
  DROP CONSTRAINT "UserRole_pkey",
  ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("tenantId", "userId", "roleId"),
  ADD CONSTRAINT "UserRole_tenantId_userId_fkey"
    FOREIGN KEY ("tenantId", "userId") REFERENCES "User"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "UserRole_tenantId_roleId_fkey"
    FOREIGN KEY ("tenantId", "roleId") REFERENCES "Role"("tenantId", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserRole"
  DROP CONSTRAINT "UserRole_userId_fkey",
  DROP CONSTRAINT "UserRole_roleId_fkey";

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_tenantId_actorUserId_fkey"
  FOREIGN KEY ("tenantId", "actorUserId") REFERENCES "User"("tenantId", "id")
  ON DELETE SET NULL ( "actorUserId" ) ON UPDATE CASCADE;

ALTER TABLE "Branch" DROP CONSTRAINT "Branch_storeId_fkey";
ALTER TABLE "CashRegister" DROP CONSTRAINT "CashRegister_branchId_fkey";
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorUserId_fkey";
