"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { LingoRound } from "@/lib/lingo/engine";
import { copyToClipboard, shareText } from "./share";

export function ResultDialog({
  open,
  onClose,
  round,
  title,
  palette,
}: {
  open: boolean;
  onClose: () => void;
  round: LingoRound;
  title: string;
  palette: "modern" | "legacy";
}) {
  const [copied, setCopied] = useState(false);
  if (!round) return null;
  const text = shareText(title, round, palette);
  const won = round.status === "won";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={won ? "Vārds atminēts! 🎉" : "Neizdevās šoreiz"}
    >
      <p className="text-sm text-stone-600 dark:text-stone-300">
        {won
          ? `Atminēji vārdu “${round.target.toUpperCase()}” ar ${round.attemptsUsed}. mēģinājumu.`
          : `Vārds bija “${round.target.toUpperCase()}”. Pamēģini vēlreiz!`}
      </p>
      <pre className="mt-4 rounded-xl bg-stone-100 p-4 text-sm font-semibold whitespace-pre-wrap dark:bg-stone-800">
        {text}
      </pre>
      <div className="mt-4 flex gap-2">
        <Button
          onClick={async () => {
            const ok = await copyToClipboard(text);
            if (ok) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }
          }}
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Nokopēts!" : "Kopēt rezultātu"}
        </Button>
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <Button
            variant="secondary"
            onClick={() =>
              void navigator
                .share({ text })
                .catch(() => undefined)
            }
          >
            <Share2 className="size-4" aria-hidden />
            Dalīties
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}
