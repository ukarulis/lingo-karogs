import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/multiplayer/factory";
import { MultiplayerService, MultiplayerError } from "@/lib/multiplayer/service";
import { rateLimit } from "@/lib/multiplayer/rate-limit";

export const runtime = "nodejs";

const PlacementCell = z.object({
  id: z.string(),
  owner: z.enum(["red", "blue"]),
  kind: z.enum(["movable", "bomb", "flag"]),
  rank: z.union([z.number().int().min(1).max(10), z.null()]),
  redSees: z.boolean(),
  blueSees: z.boolean(),
});

const Body = z.object({
  token: z.string().min(8).max(128),
  action: z.object({
    actionId: z.string().min(8).max(128),
    type: z.enum(["deploy", "ready", "move", "resign", "rematch", "cancel", "claim-abandon"]),
    payload: z.object({
      placement: z.record(z.string(), PlacementCell).optional(),
      pieceId: z.string().optional(),
      to: z.number().int().min(0).max(99).optional(),
    }),
  }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limit = rateLimit(`mp-action:${id}:${ip}`, 120, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, code: "rate-limit", error: "Pārāk daudz pieprasījumu" },
      { status: 429 },
    );
  }
  const store = getStore();
  if (!store) {
    return NextResponse.json(
      { ok: false, code: "disabled", error: "Tiešsaistes spēle pašlaik nav pieejama" },
      { status: 503 },
    );
  }
  try {
    const parsed = Body.parse(await req.json());
    const service = new MultiplayerService(store);
    const view = await service.action(id, parsed.token, {
      actionId: parsed.action.actionId,
      type: parsed.action.type,
      payload: parsed.action.payload,
    });
    return NextResponse.json({ ok: true, view });
  } catch (error) {
    if (error instanceof MultiplayerError) {
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { ok: false, code: "invalid", error: "Nederīgs pieprasījums" },
      { status: 400 },
    );
  }
}
