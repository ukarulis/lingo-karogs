// Structured, redacted server logging for Lingo multiplayer.
// Never log player tokens, guest hashes or secret answer sequences.

export function mpLog(
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.length > 40) {
      safe[key] = `${value.slice(0, 16)}…(${value.length})`;
    } else {
      safe[key] = value;
    }
  }
  console.log(JSON.stringify({ scope: "lingo-mp", event, ...safe }));
}

export function mpError(
  event: string,
  error: unknown,
  fields: Record<string, unknown> = {},
): void {
  const err = error as {
    code?: string;
    message?: string;
    constraint?: string;
    detail?: string;
  } | null;
  mpLog(event, {
    ...fields,
    errorCode: err?.code ?? "unknown",
    errorMessage: err?.message?.slice(0, 120) ?? "unknown",
    constraint: err?.constraint ?? undefined,
    detail: err?.detail?.slice(0, 160) ?? undefined,
  });
}
