ALTER TABLE "InventoryMovement" ADD COLUMN "caseId" UUID;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "Movement_tenant_case_fkey"
  FOREIGN KEY ("tenantId", "caseId") REFERENCES "UnverifiedIntakeReview"("tenantId", "id");

-- Preserve the behavior of existing weighed variants without reducing stored precision.
UPDATE "ProductVariant" AS variant SET "quantityPrecision" = 3
FROM "Product" AS product
WHERE product."id" = variant."productId" AND product."tenantId" = variant."tenantId"
  AND product."kind" IN ('WEIGHT', 'VOLUME', 'LENGTH');
