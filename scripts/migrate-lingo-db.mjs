// Explicit Lingo multiplayer migration runner.
// Usage:
//   LINGO_MP_DIRECT_DATABASE_URL=postgresql://... node scripts/migrate-lingo-db.mjs
// Uses a DIRECT connection (never a transaction-mode pooler). TLS is always
// verified unless LINGO_MP_SSL=disable is set for local development.

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const MIGRATIONS_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "migrations-postgres",
);

const url = process.env.LINGO_MP_DIRECT_DATABASE_URL;
if (!url) {
  console.error("LINGO_MP_DIRECT_DATABASE_URL is required");
  process.exit(1);
}

const ssl =
  process.env.LINGO_MP_SSL === "disable"
    ? false
    : {
        rejectUnauthorized: true,
        ca: fs.readFileSync(
          path.resolve(
            import.meta.dirname,
            "..",
            process.env.LINGO_MP_SSL_CA_FILE ?? "certs/digitalocean-ca.crt",
          ),
        ),
      };
const parsed = new URL(url);
parsed.searchParams.delete("sslmode");
const client = new Client({ connectionString: parsed.toString(), ssl });

await client.connect();
try {
  await client.query("SET search_path = lingo, public");
  await client.query(
    "CREATE TABLE IF NOT EXISTS lingo_schema_versions (version integer primary key, applied_at timestamptz not null default now())",
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.*\.sql$/.test(f))
    .sort();
  for (const file of files) {
    const version = Number.parseInt(file.split("_")[0], 10);
    const { rows } = await client.query(
      "SELECT 1 FROM lingo_schema_versions WHERE version = $1",
      [version],
    );
    if (rows.length > 0) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(
        "INSERT INTO lingo_schema_versions (version) VALUES ($1) ON CONFLICT (version) DO NOTHING",
        [version],
      );
      await client.query("COMMIT");
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  const { rows } = await client.query(
    "SELECT MAX(version) AS v FROM lingo_schema_versions",
  );
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'lingo' ORDER BY tablename",
  );
  console.log(`schema version: ${rows[0].v}`);
  console.log(
    `lingo tables: ${tables.rows.map((r) => r.tablename).join(", ")}`,
  );
} finally {
  await client.end();
}
