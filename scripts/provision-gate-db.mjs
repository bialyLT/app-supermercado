import pg from "pg";

const url = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://localhost/unconfigured");
if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_gate")) {
  throw new Error("Gate provisioning requires a local disposable database ending in _gate");
}
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supermercado_gate_runtime') THEN
      CREATE ROLE supermercado_gate_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
  END $$`);
  await client.query("GRANT supermercado_app TO supermercado_gate_runtime");
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supermercado_gate_auth') THEN
      CREATE ROLE supermercado_gate_auth LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
  END $$`);
  await client.query("GRANT supermercado_auth TO supermercado_gate_auth");
  const roles = await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('supermercado_gate_runtime', 'supermercado_gate_auth') AND NOT (rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)");
  if (roles.rows.length !== 2) throw new Error("Unsafe preexisting gate roles");
  console.log("Gate runtime roles: 2 provisioned, 0 superuser/BYPASSRLS/CREATEDB/CREATEROLE privileges");
} finally {
  await client.end();
}
