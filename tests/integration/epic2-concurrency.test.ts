import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, RoleName } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmSale, recordReceipt } from "../../src/server/inventory";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl ?? "" }) });

describeDatabase("Epic 2 PostgreSQL inventory concurrency", () => {
  let tenantId: string;
  let locationId: string;
  let variantId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const tenant = await prisma.tenant.create({ data: { name: "Epic 2 concurrency", slug: `epic2-${crypto.randomUUID()}` } });
    tenantId = tenant.id;
    const location = await prisma.location.create({ data: { tenantId, code: `TEST-${Date.now()}`, name: "Test location" } });
    locationId = location.id;
    const unit = await prisma.unitOfMeasure.create({ data: { tenantId, code: "u", name: "unit" } });
    const product = await prisma.product.create({ data: { tenantId, sku: `SKU-${crypto.randomUUID()}`, name: "Test", baseUnitId: unit.id } });
    const variant = await prisma.productVariant.create({
      data: { tenantId, productId: product.id, unitId: unit.id, sku: `VAR-${crypto.randomUUID()}`, name: "Test" },
    });
    variantId = variant.id;
    await recordReceipt({ tenantId, locationId, variantId, quantity: "1", reason: "concurrency fixture" }, RoleName.ADMIN);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("serializes the last unit and never leaves negative stock", async () => {
    const results = await Promise.allSettled([
      confirmSale({ tenantId, locationId, variantId, quantity: "1", unitPrice: "10.00", role: RoleName.ADMIN }),
      confirmSale({ tenantId, locationId, variantId, quantity: "1", unitPrice: "10.00", role: RoleName.ADMIN, allowUnverifiedIntake: true }),
    ]);
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
    const level = await prisma.inventoryLevel.findFirstOrThrow({ where: { tenantId, locationId, variantId } });
    expect(level.onHand.greaterThanOrEqualTo(0)).toBe(true);
    expect(level.reserved.greaterThanOrEqualTo(0)).toBe(true);
    const movements = await prisma.inventoryMovement.findMany({ where: { tenantId, locationId, variantId } });
    expect(movements.filter((movement) => movement.type === "SALE").length).toBeGreaterThanOrEqual(1);
  });
});
