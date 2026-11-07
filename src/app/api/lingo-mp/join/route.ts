import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensureLingoMpStore, lingoRateLimit } from "@/lib/lingo-mp/factory";
import { LingoMultiplayerService, LingoMpError } from "@/lib/lingo-mp/service";

export const runtime = "nodejs";

const Body = z.object({
  code: z.string().length(6),
  nickname: z.string().min(2).max(24),
  guestHash: z.string().min(8).max(128),
  playerToken: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = await lingoRateLimit(
    `lingo-mp-join:${ip}`,
    Number(process.env.LINGO_MP_JOIN_LIMIT ?? 60),
    60 * 60,
  );
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Pārāk daudz mēģinājumu — pamēģini vēlāk" },
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
    const result = await service.joinMatch(body);
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
