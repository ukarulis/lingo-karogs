import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureLingoMpStore, lingoRateLimit } from "@/lib/lingo-mp/factory";
import { LingoMultiplayerService, LingoMpError } from "@/lib/lingo-mp/service";

export const runtime = "nodejs";

const Body = z.object({
  format: z.enum(["quick-duel", "five-word-battle"]),
  length: z.number().int().min(4).max(7),
  nickname: z.string().min(2).max(24),
  guestHash: z.string().min(8).max(128),
  playerToken: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = await lingoRateLimit(`lingo-mp-create:${ip}`, 10, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Pārāk daudz istabu — pamēģini vēlāk" },
      { status: 429 },
    );
  }
  const store = await ensureLingoMpStore();
  if (!store) {
    return NextResponse.json(
      { error: "Tiešsaistes spēle pašlaik nav pieejama" },
      { status: 503 },
    );
  }
  try {
    const body = Body.parse(await req.json());
    const service = new LingoMultiplayerService(store);
    const result = await service.createMatch(body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LingoMpError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
}
