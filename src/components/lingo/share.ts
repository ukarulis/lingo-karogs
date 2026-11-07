import type { LingoRound } from "@/lib/lingo/engine";

export function shareText(
  title: string,
  round: LingoRound,
  palette: "modern" | "legacy",
): string {
  const result =
    round.status === "won"
      ? `${round.attemptsUsed}/${round.maxAttempts}`
      : `X/${round.maxAttempts}`;
  const grid = round.results
    .map((row) =>
      row
        .map((c) =>
          c === "correct"
            ? palette === "legacy"
              ? "🟥"
              : "🟩"
            : c === "present"
              ? "🟨"
              : "⬛",
        )
        .join(""),
    )
    .join("\n");
  return `${title}\n${result}\n${grid}\nlingo-karogs`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      return true;
    } catch {
      return false;
    }
  }
}
