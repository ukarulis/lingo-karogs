"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import {
  TEZAURS_SEARCH_URL,
  loadWordInfo,
  type WordInfo,
} from "@/lib/lingo/content";
import { cn } from "@/lib/utils";

/**
 * Educational word card shown after a round is resolved. Enrichment loads
 * lazily and can never block gameplay.
 */
export function WordInfoCard({
  word,
  compact = false,
}: {
  word: string;
  compact?: boolean;
}) {
  const [info, setInfo] = useState<WordInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadWordInfo(word).then((data) => {
      if (cancelled) return;
      setInfo(data);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [word]);

  const primary = info?.senses[0];
  const extra = info ? info.senses.slice(1) : [];

  return (
    <div className="mx-auto mt-4 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-start gap-2">
        <BookOpen className="mt-0.5 size-4 shrink-0 text-indigo-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold uppercase tracking-wide">
            {word}
            {info?.difficulty === "beginner" ? (
              <span className="ml-2 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Viegls vārds
              </span>
            ) : null}
          </p>
          {!loaded ? (
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
          ) : primary ? (
            <div className="mt-1.5 space-y-1.5 text-sm text-stone-700 dark:text-stone-300">
              <p>{primary.definition.join(" ")}</p>
              {primary.example ? (
                <p className="text-xs italic text-stone-500 dark:text-stone-400">
                  „{primary.example.text}”
                  {primary.example.source ? (
                    <span className="not-italic"> — {primary.example.source}</span>
                  ) : null}
                </p>
              ) : null}
              {!compact && extra.length > 0 ? (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {expanded ? (
                    <ChevronUp className="size-3.5" aria-hidden />
                  ) : (
                    <ChevronDown className="size-3.5" aria-hidden />
                  )}
                  {expanded ? "Mazāk" : `Vairāk nozīmju (${extra.length})`}
                </button>
              ) : null}
              {expanded ? (
                <ul className="mt-2 space-y-2 border-t border-stone-100 pt-2 dark:border-stone-800">
                  {extra.map((sense, i) => (
                    <li key={i} className="text-sm">
                      <p>{sense.definition.join(" ")}</p>
                      {sense.example ? (
                        <p className="text-xs italic text-stone-500 dark:text-stone-400">
                          „{sense.example.text}” — {sense.example.source}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
              Šim vārdam skaidrojums vēl nav sagatavots.
            </p>
          )}
          <a
            href={`${TEZAURS_SEARCH_URL}${encodeURIComponent(word)}`}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400",
            )}
          >
            <ExternalLink className="size-3.5" aria-hidden />
            Avots: Tēzaurs.lv (CC BY-SA 4.0)
          </a>
          {primary?.source === "editorial" ? (
            <p className="mt-1 text-[10px] text-stone-400 dark:text-stone-500">
              Vienkāršotu skaidrojumu sagatavojuši projekta autori.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
