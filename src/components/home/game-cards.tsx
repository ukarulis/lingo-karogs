"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, Trophy } from "lucide-react";
import { loadLingoStats, dailyStreaks } from "@/lib/store/lingoStats";
import { karogsAggregates, loadKarogsStats } from "@/lib/store/karogsStats";
import { PieceIcon } from "@/components/karogs/PieceIcon";
import { peekGameSave } from "@/lib/store/storage";

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
              className={`grid size-7 place-items-center rounded-md text-sm font-black uppercase text-white sm:size-8 ${color}`}
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
  const cells: Array<{ piece?: { owner: "red" | "blue"; kind: string; rank: number | null }; lake?: boolean }> =
    [
      { piece: { owner: "blue", kind: "movable", rank: 8 } },
      { piece: { owner: "blue", kind: "flag", rank: null } },
      { lake: true },
      { piece: { owner: "red", kind: "movable", rank: 10 } },
      { piece: { owner: "red", kind: "bomb", rank: null } },
      { piece: { owner: "blue", kind: "movable", rank: 2 } },
      { piece: { owner: "red", kind: "movable", rank: 5 } },
      { piece: { owner: "blue", kind: "movable", rank: 6 } },
      { piece: { owner: "red", kind: "flag", rank: null } },
    ];
  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-xl border border-red-200/70 bg-[#f4eedd] p-2 dark:border-red-900 dark:bg-stone-900"
      aria-hidden
    >
      {cells.map((cell, i) =>
        cell.lake ? (
          <span key={i} className="grid size-10 place-items-center rounded-lg bg-sky-400/70 dark:bg-sky-800" />
        ) : (
          <span key={i} className="grid size-10 place-items-center rounded-lg bg-[#efe6cc] dark:bg-stone-800">
            <span className="block size-9">
              <PieceIcon
                piece={{
                  id: `hp-${i}`,
                  owner: cell.piece!.owner,
                  kind: cell.piece!.kind as "movable" | "bomb" | "flag",
                  rank: cell.piece!.rank,
                  redSees: true,
                  blueSees: true,
                }}
              />
            </span>
          </span>
        ),
      )}
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
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-100 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-emerald-900 dark:from-emerald-950 dark:to-teal-950 sm:p-8"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs font-black tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
            LINGO
          </div>
          <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            Atmini piecu burtu vārdu!
          </h2>
        </div>
        <LingoPreview />
      </div>
      <p className="max-w-sm text-sm text-stone-600 dark:text-stone-300">
        Trīs režīmi: dienas vārds, neierobežota spēle un klasiskais Lingo ar dzīvībām.
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <Trophy className="size-4" aria-hidden />
        {detail}
      </div>
      <span className="mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition group-hover:bg-emerald-500">
        <Play className="size-4" aria-hidden />
        Spēlēt Lingo
      </span>
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
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-red-200 bg-gradient-to-br from-red-50 to-rose-100 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-red-900 dark:from-red-950 dark:to-rose-950 sm:p-8"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black tracking-[0.2em] text-red-700 dark:text-red-400">
            KAROGS
          </div>
          <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            Izvieto armiju. Iegūsti pretinieka karogu.
          </h2>
        </div>
        <KarogsPreview />
      </div>
      <p className="max-w-sm text-sm text-stone-600 dark:text-stone-300">
        Pret datoru, divatā uz viena ekrāna vai tiešsaistē ar draugu.
      </p>
      <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-400">
        <Trophy className="size-4" aria-hidden />
        {detail}
      </div>
      <span className="mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white shadow-sm transition group-hover:bg-red-500">
        <Play className="size-4" aria-hidden />
        Spēlēt Karogu
      </span>
    </Link>
  );
}

export function ContinueHint() {
  // localStorage is only available after hydration; defer the read so the
  // server and client render identically.
  const [resume, setResume] = useState<{ label: string; href: string } | null>(null);
  useEffect(() => {
    setResume(
      [
        { key: "karogsAiGame", label: "Karogs pret datoru", href: "/karogs" },
        { key: "karogsLocalGame", label: "Karogs divatā", href: "/karogs" },
        { key: "lingoEndless", label: "Lingo neierobežotā", href: "/lingo" },
        { key: "lingoArcade", label: "Klasiskais Lingo", href: "/lingo" },
      ].find((g) => {
        const meta = peekGameSave(g.key);
        return (
          meta &&
          meta.status !== "won" &&
          meta.status !== "lost" &&
          meta.status !== "over" &&
          meta.status !== "finished"
        );
      }) ?? null,
    );
  }, []);
  if (!resume) return null;
  return (
    <div className="mx-auto mb-5 flex max-w-4xl items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950">
      <p className="min-w-0 truncate text-sm font-semibold text-indigo-900 dark:text-indigo-200">
        Ir nepabeigta spēle: {resume.label}
      </p>
      <Link
        href={resume.href}
        className="shrink-0 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
      >
        Turpināt spēli
      </Link>
    </div>
  );
}

export function GameCards() {
  return (
    <>
      <ContinueHint />
      <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 lg:grid-cols-2">
        <LingoCard />
        <KarogsCard />
      </div>
    </>
  );
}
