import { afterAll, describe, expect, it } from "vitest";
import { getOperationalContext } from "../../src/server/context";
import { admin, enabled, fixture, addActor } from "./fixtures";

afterAll(async () => {
  await admin.$disconnect();
});

(enabled ? describe : describe.skip)("operational context repository integration", () => {
  it("returns tenant-scoped assigned branches and active locations, omitting inactive locations", async () => {
    const f = await fixture("ADMIN");

    // Create an additional active location and an inactive location
    const activeLoc = await admin.location.create({
      data: {
        tenantId: f.tenantId,
        branchId: f.branchId,
        code: "ACTIVE-01",
        name: "Active Storage",
        active: true,
      },
    });

    const inactiveLoc = await admin.location.create({
      data: {
        tenantId: f.tenantId,
        branchId: f.branchId,
        code: "INACTIVE-01",
        name: "Old Storage",
        active: false,
      },
    });

    const context = await getOperationalContext(f.actor);

    expect(context.tenantId).toBe(f.tenantId);
    expect(context.branches.length).toBeGreaterThanOrEqual(1);

    const primaryBranch = context.branches.find((b) => b.id === f.branchId);
    expect(primaryBranch).toBeDefined();
    expect(primaryBranch?.code).toBe("gate");
    expect(primaryBranch?.name).toBe("Gate branch");

    // Inactive location must NOT be present
    const inactiveFound = context.locations.find((l) => l.id === inactiveLoc.id);
    expect(inactiveFound).toBeUndefined();

    // Active location must be present
    const activeFound = context.locations.find((l) => l.id === activeLoc.id);
    expect(activeFound).toBeDefined();
    expect(activeFound?.branchId).toBe(f.branchId);

    // Branch locations relationship
    const branchLoc = primaryBranch?.locations.find((l) => l.id === activeLoc.id);
    expect(branchLoc).toBeDefined();
  });

  it("isolates tenants completely: never leaks branches or locations from another tenant", async () => {
    const f1 = await fixture("ADMIN");
    const f2 = await fixture("ADMIN");

    const context1 = await getOperationalContext(f1.actor);
    const context2 = await getOperationalContext(f2.actor);

    const f1BranchIds = context1.branches.map((b) => b.id);
    const f2BranchIds = context2.branches.map((b) => b.id);

    expect(f1BranchIds).toContain(f1.branchId);
    expect(f1BranchIds).not.toContain(f2.branchId);
    expect(f2BranchIds).toContain(f2.branchId);
    expect(f2BranchIds).not.toContain(f1.branchId);

    const f1LocationIds = context1.locations.map((l) => l.id);
    expect(f1LocationIds).toContain(f1.locationId);
    expect(f1LocationIds).not.toContain(f2.locationId);
  });

  it("restricts STOCK_MANAGER to assigned branches only", async () => {
    const f = await fixture("ADMIN");

    // Create a second branch in the same tenant
    const branch2 = await admin.branch.create({
      data: {
        tenantId: f.tenantId,
        storeId: f.storeId,
        code: "SECOND-BRANCH",
        name: "Second Branch",
      },
    });

    const location2 = await admin.location.create({
      data: {
        tenantId: f.tenantId,
        branchId: branch2.id,
        code: "SEC-LOC",
        name: "Second Location",
        active: true,
      },
    });

    // Create a STOCK_MANAGER assigned ONLY to branch2
    const stockManager = await addActor(f.tenantId, branch2.id, "STOCK_MANAGER");

    const context = await getOperationalContext(stockManager);

    // Should only see branch2, not branch1 (f.branchId)
    const branchIds = context.branches.map((b) => b.id);
    expect(branchIds).toContain(branch2.id);
    expect(branchIds).not.toContain(f.branchId);

    // Locations must only include branch2's location
    const locationIds = context.locations.map((l) => l.id);
    expect(locationIds).toContain(location2.id);
    expect(locationIds).not.toContain(f.locationId);
  });
});
