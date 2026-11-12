/**
 * Provision a kiosco tenant in one step.
 *
 * Tenant/Store/Branch/CashRegister creation is deliberately not granted to the
 * application role (see the hardening migration that revokes INSERT on those
 * tables), so this runs out of band with MIGRATION_DATABASE_URL.
 *
 * Usage:
 *   node scripts/provision-kiosco.mjs --name "Kiosco Don Liam" --admin-email liam@kiosco.test --admin-password 'secreto'
 *
 * Optional: --slug, --currency (default ARS), --admin-name, --store-name.
 * Idempotent: an existing slug is reported and left untouched.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const name = argument("name");
const adminEmail = argument("admin-email");
const adminPassword = argument("admin-password");
const currency = argument("currency", "ARS");
const slug = argument("slug", name ? slugify(name) : "");
const adminName = argument("admin-name", "Administrador");
const storeName = argument("store-name", name ? `${name} SRL` : "");

if (!name || !adminEmail || !adminPassword || !slug) {
  console.error("Faltan datos: --name, --admin-email y --admin-password son obligatorios.");
  process.exit(2);
}
if (!/^[A-Z]{3}$/.test(currency)) {
  console.error(`Moneda inválida: ${currency}. Usá un código ISO de 3 letras (por ejemplo ARS).`);
  process.exit(2);
}

const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) {
  console.error("Falta MIGRATION_DATABASE_URL (rol con permiso de provisión).");
  process.exit(2);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const existing = await db.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (existing) {
    console.log(`El negocio "${slug}" ya existe (${existing.id}). No se modificó nada.`);
    return;
  }

  const password = await hashPassword(adminPassword);

  const result = await db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name, slug, operationalMode: "SIMPLE" },
    });
    const store = await tx.store.create({ data: { tenantId: tenant.id, name: storeName } });
    const branch = await tx.branch.create({
      data: { tenantId: tenant.id, storeId: store.id, code: "PRINCIPAL", name: "Principal" },
    });
    const location = await tx.location.create({
      data: {
        tenantId: tenant.id, branchId: branch.id, code: "MOSTRADOR",
        name: "Mostrador", type: "STORE",
      },
    });
    const register = await tx.cashRegister.create({
      data: { tenantId: tenant.id, branchId: branch.id, locationId: location.id, name: "Caja" },
    });
    await tx.unverifiedIntakePolicy.create({
      data: {
        tenantId: tenant.id, mode: "ALLOW_WITH_CAPS", currency, maxSessionValue: "50000",
      },
    });
    await tx.unitOfMeasure.create({
      data: { tenantId: tenant.id, code: "UN", name: "Unidad", precision: 0 },
    });

    const role = await tx.role.create({ data: { tenantId: tenant.id, name: "ADMIN" } });
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id, email: adminEmail, displayName: adminName, name: adminName,
        emailVerified: true, active: true,
      },
    });
    await tx.userRole.create({ data: { tenantId: tenant.id, userId: user.id, roleId: role.id } });
    await tx.userBranch.create({ data: { tenantId: tenant.id, userId: user.id, branchId: branch.id } });
    await tx.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password },
    });

    return { tenantId: tenant.id, branchId: branch.id, locationId: location.id, registerId: register.id, userId: user.id };
  });

  console.log("Kiosco provisionado:");
  console.log(`  tenant     ${result.tenantId}`);
  console.log(`  sucursal   Principal / MOSTRADOR`);
  console.log(`  caja       Caja (asignada al mostrador)`);
  console.log(`  admin      ${adminEmail}`);
  console.log("Modo operativo: SIMPLE (1 sucursal, 1 caja).");
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => db.$disconnect());
