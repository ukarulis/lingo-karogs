import { NextResponse } from "next/server";
import { getLingoMpStore, lingoMpStoreMode } from "@/lib/lingo-mp/factory";

export const runtime = "nodejs";

export async function GET() {
  const store = getLingoMpStore();
  const mode = lingoMpStoreMode();
  let pingOk = false;
  if (store) {
    try {
      pingOk = await store.ping();
    } catch {
      pingOk = false;
    }
  }
  return NextResponse.json(
    { available: store !== null && pingOk, mode },
    { headers: { "cache-control": "no-store" } },
  );
}
