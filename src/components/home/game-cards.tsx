"use client";

import Link from "next/link";
import { Flag, Play, Trophy, Type } from "lucide-react";
import { loadLingoStats, dailyStreaks } from "@/lib/store/lingoStats";
import { karogsAggregates, loadKarogsStats } from "@/lib/store/karogsStats";
import { PieceIcon } from "@/components/karogs/PieceIcon";

function LingoPreview() {
  const rows: Array<Array<[string, string]>> = [
    [
      ["L", "bg-emerald-600"],
      ["A", "bg-stone-200 text-stone-500 dark:bg-stone-700"],
      ["P", "bg-amber-400 text-stone-900"],
      ["A", "bg-stone-200 text-stone-500 dark:bg-stone-700"],
      ["S", "bg-emerald-600"],
    ],
    [
      ["D", "bg-emerald-600"],
      ["Ā", "bg-amber-400 text-stone-900"],
      ["R", "bg-stone-200 text-stone-500 dark:bg-stone-700"],
      ["Z", "bg-amber-400 text-stone-900"],
      ["S", "bg-emerald-600"],
    ],
  ];
  return (
    <div className="grid gap-1" aria-hidden>
      {rows.map((row, r) => (
        <div key={r} className="flex gap-1">
          {row.map(([letter, color], c) => (
            <span
              key={c}
              className={`grid size-7 place-items-center rounded-md text-sm font-black uppercase text-white ${color}`}
            >
              {letter}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function KarogsPreview() {
  const pieces = [
    { owner: "red", kind: "movable", rank: 10 },
    { owner: "blue", kind: "movable", rank: 2 },
    { owner: "blue", kind: "bomb", rank: null },
    { owner: "red", kind: "flag", rank: null },
  ] as const;
  return (
    <div className="flex items-end gap-1" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className={
            "inline-block " +
            (i % 2 === 0 ? "size-8" : "size-10") +
            (p.owner === "red" ? "" : " translate-y-1")
          }
        >
          <PieceIcon
            piece={{
              ...p,
              id: `preview-${i}`,
              redSees: true,
              blueSees: true,
            }}
          />
        </span>
      ))}
    </div>
  );
}

function LingoCard() {
  const stats = loadLingoStats();
  const streak = dailyStreaks(stats.daily);
  const bestArcade = stats.arcade.bestScore;
  const detail =
    streak.current > 0
      ? `Dienas sērija: ${streak.current}`
      : bestArcade > 0
        ? `Labākais klasikas rezultāts: ${bestArcade}`
        : "5 mēģinājumi · pirmais burts zināms";
  return (
    <Link
      href="/lingo"
      className="group relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-emerald-900 dark:from-emerald-950 dark:to-teal-950 sm:p-9"
    >
      <div className="absolute -right-6 -top-6 opacity-10 transition group-hover:scale-110" aria-hidden>
        <Type className="size-36" />
      </div>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0">
          <LingoPreview />
        </div>
        <div>
          <div className="text-xs font-black tracking-[0.25em] text-emerald-700 dark:text-emerald-400">
            LINGO
          </div>
          <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            Atmini piecu burtu vārdu!
          </h2>
          <p className="mt-2 max-w-sm text-sm text-stone-600 dark:text-stone-300">
            Trīs režīmi: dienas vārds, neierobežota spēle un klasiskais Lingo ar dzīvībām.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <Trophy className="size-4" aria-hidden />
            {detail}
          </div>
          <span className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition group-hover:bg-emerald-500">
            <Play className="size-4" aria-hidden />
            Spēlēt
          </span>
        </div>
      </div>
    </Link>
  );
}

function KarogsCard() {
  const aggregates = karogsAggregates(loadKarogsStats());
  const detail =
    aggregates.games > 0
      ? `Uzvaras: ${aggregates.wins} · Labākā sērija: ${aggregates.bestStreak}`
      : "40 figūras · slepena izvietošana · 3 pretinieki";
  return (
    <Link
      href="/karogs"
      className="group relative overflow-hidden rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-100 p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-red-900 dark:from-red-950 dark:to-rose-950 sm:p-9"
    >
      <div className="absolute -right-6 -top-6 opacity-10 transition group-hover:scale-110" aria-hidden>
        <Flag className="size-36" />
      </div>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0 rounded-2xl border border-red-200/70 bg-white/60 p-3 dark:border-red-900 dark:bg-stone-950/40">
          <KarogsPreview />
        </div>
        <div>
          <div className="text-xs font-black tracking-[0.25em] text-red-700 dark:text-red-400">
            KAROGS
          </div>
          <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            Noslēp savu karogu. Atklāj pretinieka stratēģiju.
          </h2>
          <p className="mt-2 max-w-sm text-sm text-stone-600 dark:text-stone-300">
            Pret datoru, divatā uz viena ekrāna vai tiešsaistē ar draugu.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400">
            <Trophy className="size-4" aria-hidden />
            {detail}
          </div>
          <span className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm transition group-hover:bg-red-500">
            <Play className="size-4" aria-hidden />
            Spēlēt
          </span>
        </div>
      </div>
    </Link>
  );
}

export function GameCards() {
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 lg:grid-cols-2">
      <LingoCard />
      <KarogsCard />
    </div>
  );
}
