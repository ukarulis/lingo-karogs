import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/multiplayer/factory";
import { MultiplayerService, MultiplayerError } from "@/lib/multiplayer/service";
import { rateLimit } from "@/lib/multiplayer/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  nickname: z.string().min(2).max(24),
  guestHash: z.string().min(8).max(128),
  playerToken: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = rateLimit(`mp-create:${ip}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Pārāk daudz istabu — pamēģini vēlāk" },
      { status: 429 },
    );
  }
  const store = getStore();
  if (!store) {
    return NextResponse.json(
      { error: "Tiešsaistes spēle pašlaik nav pieejama" },
      { status: 503 },
    );
  }
  try {
    const body = Body.parse(await req.json());
    const service = new MultiplayerService(store);
    const result = await service.createRoom(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof MultiplayerError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
}
