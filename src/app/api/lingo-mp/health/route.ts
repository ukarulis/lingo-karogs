// Operator-only diagnostic endpoint. Protected by a secret header value;
// never exposes database credentials, hostnames or internal secrets.

import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getLingoMpStore, lingoMpStoreMode } from "@/lib/lingo-mp/factory";

export const runtime = "nodejs";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const expected = process.env.OPERATOR_HEALTH_KEY;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { ok: false, error: "OPERATOR_HEALTH_KEY nav konfigurēta" },
      { status: 503 },
    );
  }
  const provided = req.headers.get("x-operator-key") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: "Nav atļauts" }, { status: 403 });
  }
  const mode = lingoMpStoreMode();
  const store = getLingoMpStore();
  const started = Date.now();
  const pingOk = store ? await store.ping().catch(() => false) : false;
  const latencyMs = Date.now() - started;
  const schemaVersion = store ? await store.schemaVersion().catch(() => 0) : 0;
  return NextResponse.json({
    ok: pingOk,
    mode,
    db: { reachable: pingOk, latencyMs, schemaVersion },
    config: {
      PLAYER_TOKEN_SALT: !!process.env.PLAYER_TOKEN_SALT,
      LINGO_MP_DATABASE_URL: !!process.env.LINGO_MP_DATABASE_URL,
      OPERATOR_HEALTH_KEY: true,
      NEXT_PUBLIC_E2E: !!process.env.NEXT_PUBLIC_E2E,
    },
  });
}
