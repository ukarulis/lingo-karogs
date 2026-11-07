import { NextResponse } from "next/server";
import { getLingoMpStore } from "@/lib/lingo-mp/factory";

export const runtime = "nodejs";

export async function GET() {
  const store = getLingoMpStore();
  return NextResponse.json(
    { available: store !== null },
    { headers: { "cache-control": "no-store" } },
  );
}
