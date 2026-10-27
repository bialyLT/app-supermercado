import pg from "pg";

if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required for the ledger gate");
const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
await client.connect();
try {
  const { rows } = await client.query(`
    WITH balances AS (
      SELECT "tenantId", "locationId", "variantId", "lotId",
        SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) AS balance
      FROM "InventoryMovement" GROUP BY "tenantId", "locationId", "variantId", "lotId"
    )
    SELECT count(*)::text AS divergences FROM balances b
    FULL JOIN "InventoryLevel" l ON b."tenantId" = l."tenantId"
      AND b."locationId" = l."locationId" AND b."variantId" = l."variantId"
      AND b."lotId" IS NOT DISTINCT FROM l."lotId"
    WHERE COALESCE(b.balance, 0) <> COALESCE(l."onHand", 0)
      OR l."onHand" < 0 OR l.reserved < 0 OR l.reserved > l."onHand"`);
  const rls = await client.query(`SELECT count(*)::text AS total,
    count(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity)::text AS protected
    FROM information_schema.columns col JOIN pg_class c ON c.relname = col.table_name
      JOIN pg_namespace n ON c.relnamespace = n.oid AND n.nspname = col.table_schema
    WHERE col.table_schema = 'public' AND col.column_name = 'tenantId'`);
  console.log(`Ledger reconciliation: ${rows[0].divergences} divergences`);
  console.log(`Tenant RLS: ${rls.rows[0].protected}/${rls.rows[0].total} tables enabled and forced`);
  if (rows[0].divergences !== "0" || rls.rows[0].protected !== rls.rows[0].total) process.exitCode = 1;
} finally {
  await client.end();
}
