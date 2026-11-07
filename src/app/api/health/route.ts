import { NextResponse } from "next/server";
import { getStore, storeMode } from "@/lib/multiplayer/factory";

export const runtime = "nodejs";

export async function GET() {
  const mode = storeMode();
  const store = getStore();
  return NextResponse.json(
    {
      status: "ok",
      multiplayer: {
        mode,
        available: store !== null,
      },
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
