import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getLingoMpStore } from "@/lib/lingo-mp/factory";
import {
  LingoMultiplayerService,
  toLingoActionResponse,
} from "@/lib/lingo-mp/service";
import { rateLimit } from "@/lib/multiplayer/rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  token: z.string().min(8).max(128),
  action: z.object({
    actionId: z.string().min(8).max(128),
    type: z.enum(["ready", "guess", "extend", "forfeit", "cancel", "rematch", "leave"]),
    payload: z.object({ word: z.string().max(64).optional() }).optional(),
  }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = rateLimit(`lingo-mp-action:${id}:${ip}`, 120, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate-limit", error: "Pārāk daudz pieprasījumu" },
      { status: 429 },
    );
  }
  const store = getLingoMpStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, code: "disabled", error: "Tiešsaistes spēle pašlaik nav pieejama" },
      { status: 503 },
    );
  }
  try {
    const parsed = Body.parse(await req.json());
    const service = new LingoMultiplayerService(store);
    const response = await service.action(id, parsed.token, {
      actionId: parsed.action.actionId,
      type: parsed.action.type,
      payload: parsed.action.payload,
    });
    return NextResponse.json(response);
  } catch (error) {
    const response = toLingoActionResponse(error);
    const status =
      error instanceof Error && "status" in error
        ? (error as { status: number }).status
        : 400;
    return NextResponse.json(response, { status });
  }
}
