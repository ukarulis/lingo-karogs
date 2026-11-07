import { NextResponse } from "next/server";
import { getStore } from "@/lib/multiplayer/factory";

export const runtime = "nodejs";

export async function GET() {
  const store = getStore();
  if (!store) {
    return NextResponse.json({ rows: [], available: false });
  }
  try {
    const rows = await store.leaderboard(50);
    return NextResponse.json(
      { rows, available: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ rows: [], available: false });
  }
}
