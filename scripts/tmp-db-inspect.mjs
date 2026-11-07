import fs from "node:fs";
import { Client } from "pg";

const uri = fs.readFileSync(`${process.env.TEMP}/lingo-direct-uri.txt`, "utf8").trim();
const ca = fs.readFileSync("certs/digitalocean-ca.crt");
const client = new Client({
  connectionString: (() => {
    const u = new URL(uri);
    u.searchParams.delete("sslmode");
    return u.toString();
  })(),
  ssl: { rejectUnauthorized: true, ca },
});
await client.connect();
try {
  const { rows: matches } = await client.query(
    "SELECT id, code, status, current_round_index, created_at FROM lingo_matches ORDER BY created_at DESC LIMIT 3",
  );
  for (const m of matches) {
    console.log("match", m.id, m.code, m.status, "round", m.current_round_index);
    const { rows: rounds } = await client.query(
      "SELECT round_index, host_outcome, guest_outcome, resolved_at, started_at, host_deadline_at, guest_deadline_at FROM lingo_match_rounds WHERE match_id = $1 ORDER BY round_index",
      [m.id],
    );
    for (const r of rounds) {
      console.log(
        "  round",
        r.round_index,
        r.host_outcome,
        r.guest_outcome,
        "resolved:",
        r.resolved_at,
        "start:",
        r.started_at,
      );
    }
    const { rows: subs } = await client.query(
      "SELECT player, seq, word FROM lingo_round_submissions WHERE match_id = $1 ORDER BY player, seq",
      [m.id],
    );
    console.log("  submissions:", subs);
  }
} finally {
  await client.end();
}
