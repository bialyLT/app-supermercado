import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { enabled } from "./fixtures";

const run = promisify(execFile);
const script = "scripts/provision-kiosco.mjs";
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL ?? "" }) });

function provision(args: string[]) {
  return run(process.execPath, [script, ...args], {
    env: { ...process.env, MIGRATION_DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
  });
}

afterAll(() => admin.$disconnect());

(enabled ? describe : describe.skip)("kiosco provisioning", () => {
  it("creates a full single-branch, single-register tenant in one step", async () => {
    const slug = `kiosco-${crypto.randomUUID().slice(0, 8)}`;
    const email = `${slug}@example.test`;

    const { stdout } = await provision([
      "--name", "Kiosco Test",
      "--slug", slug,
      "--admin-email", email,
      "--admin-password", "Synthetic-gate-only-2026!",
    ]);

    expect(stdout).toContain("Modo operativo: SIMPLE");

    const tenant = await admin.tenant.findUniqueOrThrow({ where: { slug } });
    expect(tenant.operationalMode).toBe("SIMPLE");

    const branches = await admin.branch.findMany({ where: { tenantId: tenant.id } });
    expect(branches).toHaveLength(1);
    expect(branches[0]).toMatchObject({ code: "PRINCIPAL", name: "Principal" });

    const locations = await admin.location.findMany({ where: { tenantId: tenant.id } });
    expect(locations).toHaveLength(1);
    expect(locations[0].code).toBe("MOSTRADOR");
    expect(locations[0].name).toBe("Mostrador");

    const registers = await admin.cashRegister.findMany({ where: { tenantId: tenant.id } });
    expect(registers).toHaveLength(1);
    expect(registers[0].locationId).toBe(locations[0].id);

    const policy = await admin.unverifiedIntakePolicy.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    expect(policy.currency).toBe("ARS");

    const user = await admin.user.findUniqueOrThrow({ where: { email } });
    const account = await admin.account.findFirstOrThrow({ where: { userId: user.id } });
    expect(account.providerId).toBe("credential");
    expect(account.password).not.toContain("Synthetic-gate-only-2026!");
  });

  it("is idempotent by slug", async () => {
    const slug = `kiosco-${crypto.randomUUID().slice(0, 8)}`;
    const args = ["--name", "Kiosco Doble", "--slug", slug, "--admin-email", `${slug}@example.test`, "--admin-password", "Synthetic-gate-only-2026!"];

    await provision(args);
    const { stdout } = await provision(args);

    expect(stdout).toContain("ya existe");
    expect(await admin.tenant.count({ where: { slug } })).toBe(1);
  });
});
