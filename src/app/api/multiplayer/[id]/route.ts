import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/multiplayer/factory";
import { MultiplayerService, MultiplayerError } from "@/lib/multiplayer/service";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Trūkst identifikatora" }, { status: 400 });
  }
  const store = getStore();
  if (!store) {
    return NextResponse.json(
      { error: "Tiešsaistes spēle pašlaik nav pieejama" },
      { status: 503 },
    );
  }
  try {
    const service = new MultiplayerService(store);
    const view = await service.getView(id, token);
    return NextResponse.json(view, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof MultiplayerError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Kļūda" }, { status: 500 });
  }
}
