import { NextRequest, NextResponse } from "next/server";
import { ensureLingoMpStore } from "@/lib/lingo-mp/factory";
import { LingoMultiplayerService, LingoMpError } from "@/lib/lingo-mp/service";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Player credentials travel in a header, never in URLs (query strings leak
  // into logs, history and tracing).
  const token = req.headers.get("x-player-token");
  if (!token) {
    return NextResponse.json({ error: "Trūkst identifikatora" }, { status: 400 });
  }
  const store = await ensureLingoMpStore();
  if (!store) {
    return NextResponse.json(
      { error: "Tiešsaistes spēle pašlaik nav pieejama" },
      { status: 503 },
    );
  }
  try {
    const service = new LingoMultiplayerService(store);
    const view = await service.getView(id, token);
    return NextResponse.json(view, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof LingoMpError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Kļūda" }, { status: 500 });
  }
}
