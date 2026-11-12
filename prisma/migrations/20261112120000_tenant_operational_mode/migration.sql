-- Operational mode per tenant (D-031): SIMPLE is a single-branch, single-register
-- kiosco; MULTI keeps today's branch/register model. Non destructive: existing
-- tenants keep the full feature set.
CREATE TYPE "OperationalMode" AS ENUM ('SIMPLE', 'MULTI');

ALTER TABLE "Tenant" ADD COLUMN "operationalMode" "OperationalMode" NOT NULL DEFAULT 'MULTI';
