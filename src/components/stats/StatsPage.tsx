"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Award,
  CalendarCheck,
  Clock,
  Flag,
  Gamepad2,
  Globe,
  Lock,
  Medal,
  Sparkles,
  Target,
  Trophy,
  Zap,
  EyeOff,
} from "lucide-react";
import WaProgressBar from "@awesome.me/webawesome/dist/react/progress-bar/index.js";
import { Card } from "@/components/ui/card";
import { Kpi } from "@/components/ui/kpi";
import {
  type LingoStats,
  type EndlessBucket,
  dailyStreaks,
  loadLingoStats,
} from "@/lib/store/lingoStats";
import { enabledLengths } from "@/lib/lingo/pools";
import { karogsAggregates, loadKarogsStats } from "@/lib/store/karogsStats";
import { ACHIEVEMENTS, loadAchievements } from "@/lib/store/achievements";
import { apiLeaderboard } from "@/lib/multiplayer/client";
import type { LeaderboardRow } from "@/lib/multiplayer/types";
import { formatDuration } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Target,
  CalendarCheck,
  Gamepad2,
  Flag,
  Medal,
  EyeOff,
  Zap,
  Globe,
};

function GuessDistribution({
  bucket,
  title,
}: {
  bucket: EndlessBucket;
  title: string;
}) {
  const dist = bucket.distribution;
  const max = Math.max(1, ...dist);
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-bold text-stone-600 dark:text-stone-300">
        {title}
      </h2>
      <div className="space-y-1.5">
        {dist.map((count, i) => (
          <div key={i} className="flex items-center gap-2 text-xs font-semibold">
            <span className="w-4 text-right tabular-nums text-stone-400">{i + 1}</span>
            <WaProgressBar
              className="min-w-0 flex-1"
              value={Math.max(count > 0 ? 8 : 0, (count / max) * 100)}
            >
              {count > 0 ? count : ""}
            </WaProgressBar>
          </div>
        ))}
      </div>
    </Card>
  );
}

function LingoSection({ stats }: { stats: LingoStats }) {
  const streaks = dailyStreaks(stats.daily);
  const solvedDays = Object.values(stats.daily).filter((d) => d.won).length;
  const buckets = enabledLengths().map((len) => ({
    length: len,
    bucket:
      stats.endless[`lv:${len}`] ??
      ({
        total: 0,
        wins: 0,
        losses: 0,
        distribution: [],
        totalSolved: 0,
        currentStreak: 0,
        bestStreak: 0,
      } as EndlessBucket),
  }));
  const allEndless: EndlessBucket = {
    total: buckets.reduce((a, b) => a + b.bucket.total, 0),
    wins: buckets.reduce((a, b) => a + b.bucket.wins, 0),
    losses: buckets.reduce((a, b) => a + b.bucket.losses, 0),
    distribution: [],
    totalSolved: buckets.reduce((a, b) => a + b.bucket.totalSolved, 0),
    currentStreak: 0,
    bestStreak: Math.max(0, ...buckets.map((b) => b.bucket.bestStreak)),
  };
  const total = allEndless.total;
  const winRate = total ? Math.round((allEndless.wins / total) * 100) : 0;
  return (
    <section aria-labelledby="lingo-stats-title">
      <h2 id="lingo-stats-title" className="mb-3 text-lg font-extrabold">
        Lingo
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Target} label="Pabeigti raundi" value={total + solvedDays} />
        <Kpi icon={Trophy} label="Uzvaras" value={allEndless.wins + solvedDays} />
        <Kpi icon={Flag} label="Uzvaru īpatsvars" value={`${winRate}%`} />
        <Kpi icon={CalendarCheck} label="Dienas sērija / rekords" value={`${streaks.current} / ${streaks.best}`} />
        <Kpi icon={Sparkles} label="Atminēti vārdi" value={allEndless.totalSolved + solvedDays} />
        <Kpi icon={Clock} label="Neierobežotie vārdi" value={total} hint="pēc garumiem" />
        <Kpi icon={Gamepad2} label="Klasikas rekords" value={stats.arcade.bestScore} />
        <Kpi icon={Medal} label="Klasikas sesijas" value={stats.arcade.sessions} />
      </div>
      <div className="mt-3 space-y-3">
        <Card className="p-0">
          <div
            className="overflow-x-auto"
            tabIndex={0}
            role="region"
            aria-label="Neierobežotās spēles rezultāti pēc vārda garuma"
          >
            <table className="w-full text-sm">
              <caption className="sr-only">
                Neierobežotās spēles rezultāti pēc vārda garuma
              </caption>
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs font-bold text-stone-400 dark:border-stone-800">
                  <th className="px-4 py-2.5">Garums</th>
                  <th className="px-4 py-2.5 text-right">Spēles</th>
                  <th className="px-4 py-2.5 text-right">Uzvaras</th>
                  <th className="px-4 py-2.5 text-right">Īpatsvars</th>
                  <th className="px-4 py-2.5 text-right">Sērija / rekords</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map(({ length, bucket }) => {
                  const pct = bucket.total
                    ? Math.round((bucket.wins / bucket.total) * 100)
                    : 0;
                  return (
                    <tr
                      key={length}
                      className="border-b border-stone-100 last:border-0 dark:border-stone-800/60"
                    >
                      <td className="px-4 py-2 font-semibold">{length} burti</td>
                      <td className="px-4 py-2 text-right tabular-nums">{bucket.total}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{bucket.wins}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {bucket.total ? `${pct}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {bucket.total
                          ? `${bucket.currentStreak} / ${bucket.bestStreak}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        {buckets
          .filter(({ bucket }) => bucket.total > 0)
          .map(({ length, bucket }) => (
            <GuessDistribution
              key={length}
              bucket={bucket}
              title={`Minējumu sadalījums — ${length} burti`}
            />
          ))}
      </div>
    </section>
  );
}

function KarogsSection() {
  const a = karogsAggregates(loadKarogsStats());
  const opponents: Array<[string, string, { games: number; wins: number }]> = [
    ["Viegls dators", "ai-easy", a.byOpponent["ai-easy"]],
    ["Vidējs dators", "ai-medium", a.byOpponent["ai-medium"]],
    ["Spēcīgs dators", "ai-hard", a.byOpponent["ai-hard"]],
    ["Divatā uz vietas", "local-human", a.byOpponent["local-human"]],
    ["Tiešsaistē", "online", a.byOpponent.online],
  ];
  return (
    <section aria-labelledby="karogs-stats-title">
      <h2 id="karogs-stats-title" className="mb-3 text-lg font-extrabold">
        Karogs
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Trophy} label="Spēles" value={a.games} />
        <Kpi icon={Flag} label="Uzvaras" value={a.wins} />
        <Kpi icon={Clock} label="Zaudējumi / neizšķirti" value={`${a.losses} / ${a.draws}`} />
        <Kpi icon={Target} label="Uzvaru īpatsvars" value={`${a.winRate}%`} />
        <Kpi icon={CalendarCheck} label="Sērija / rekords" value={`${a.currentStreak} / ${a.bestStreak}`} />
        <Kpi icon={Zap} label="Atbruņotas bumbas" value={a.defusals} />
        <Kpi icon={EyeOff} label="Spiega uzvaras" value={a.spyKills} />
        <Kpi icon={Medal} label="Sagrābti karogi" value={a.flagsCaptured} />
      </div>
      <Card className="mt-3 p-5">
        <h3 className="mb-2 text-sm font-bold text-stone-600 dark:text-stone-300">
          Rezultāti pret dažādiem pretiniekiem
        </h3>
        <div className="space-y-1.5">
          {opponents.map(([label, , row]) => {
            const pct = row.games ? Math.round((row.wins / row.games) * 100) : 0;
            return (
              <div key={label} className="flex items-center gap-2 text-xs font-semibold">
                <span className="w-32 shrink-0 text-stone-500 dark:text-stone-400">{label}</span>
                <WaProgressBar className="min-w-0 flex-1" value={pct}>
                  {pct > 18 ? `${row.wins}/${row.games}` : ""}
                </WaProgressBar>
                <span className="w-16 text-right tabular-nums text-stone-400">
                  {row.games > 0 ? `${row.wins}/${row.games}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
          Vidējais spēles ilgums:{" "}
          {a.avgDurationSec > 0 ? formatDuration(a.avgDurationSec) : "—"} · Ātrākā
          uzvara: {a.fastestWinSec != null ? formatDuration(a.fastestWinSec) : "—"}
        </p>
      </Card>
    </section>
  );
}

function Achievements() {
  const unlocked = loadAchievements();
  return (
    <section aria-labelledby="ach-title">
      <h2 id="ach-title" className="mb-3 text-lg font-extrabold">
        Sasniegumi
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ACHIEVEMENTS.map((a) => {
          const Icon = ICONS[a.icon] ?? Award;
          const isUnlocked = !!unlocked[a.id];
          return (
            <Card
              key={a.id}
              className={
                "flex items-center gap-3 p-4 " +
                (isUnlocked ? "" : "opacity-60")
              }
            >
              <div
                className={
                  "grid size-10 shrink-0 place-items-center rounded-xl " +
                  (isUnlocked
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500")
                }
              >
                {isUnlocked ? (
                  <Icon className="size-5" aria-hidden />
                ) : (
                  <Lock className="size-5" aria-hidden />
                )}
              </div>
              <div>
                <div className="text-sm font-bold">{a.title}</div>
                <div className="text-xs text-stone-500 dark:text-stone-400">
                  {a.description}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    void (async () => {
      const data = await apiLeaderboard();
      setRows(data);
      setAvailable(data.length > 0 || true);
      try {
        const res = await fetch("/api/leaderboard");
        const json = (await res.json()) as { available: boolean };
        setAvailable(json.available);
      } catch {
        setAvailable(false);
      }
    })();
  }, []);
  return (
    <section aria-labelledby="lb-title">
      <h2 id="lb-title" className="mb-3 flex items-center gap-2 text-lg font-extrabold">
        <Globe className="size-5 text-indigo-500" aria-hidden />
        Tiešsaistes līderu tabula
      </h2>
      {!available ? (
        <Card className="p-5 text-sm text-stone-500 dark:text-stone-400">
          Līderu tabula pašlaik nav pieejama — tā rāda tikai servera verificētus
          tiešsaistes spēļu rezultātus.
        </Card>
      ) : !rows ? (
        <Card className="h-24 animate-pulse" />
      ) : rows.length === 0 ? (
        <Card className="p-5 text-sm text-stone-500 dark:text-stone-400">
          Pagaidām nav verificētu tiešsaistes rezultātu. Uzspēlē ar draugu un
          kļūsti par pirmo!
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <caption className="sr-only">Tiešsaistes spēļu līderu tabula</caption>
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs font-bold text-stone-400 dark:border-stone-800">
                <th className="px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">Segvārds</th>
                <th className="px-4 py-2.5 text-right">Spēles</th>
                <th className="px-4 py-2.5 text-right">Uzvaras</th>
                <th className="px-4 py-2.5 text-right">Punkti</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.nickname}
                  className="border-b border-stone-100 last:border-0 dark:border-stone-800/60"
                >
                  <td className="px-4 py-2 font-bold text-stone-400">{i + 1}</td>
                  <td className="px-4 py-2 font-semibold">{r.nickname}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.games}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600">
                    {r.wins}
                  </td>
                  <td className="px-4 py-2 text-right font-bold tabular-nums">
                    {r.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </section>
  );
}

export function StatsPage() {
  const lingo = loadLingoStats();
  const lingoTotal =
    Object.values(lingo.endless).reduce((a, b) => a + b.total, 0) +
    Object.keys(lingo.daily).length +
    lingo.arcade.sessions;
  const karogs = karogsAggregates(loadKarogsStats());
  const hasData = lingoTotal > 0 || karogs.games > 0;
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-black tracking-tight sm:text-3xl">Statistika</h1>
      <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
        Personīgie rezultāti glabājas šajā ierīcē. Tiešsaistes tabulā iekļūst tikai
        servera verificētas tiešsaistes spēles.
      </p>
      {!hasData ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Vēl nav nevienas spēles. Rezultāti parādīsies šeit pēc pirmās spēles.
          </p>
          <div className="flex gap-2">
            <Link href="/lingo" className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-emerald-500">
              Spēlēt Lingo
            </Link>
            <Link href="/karogs" className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-red-500">
              Spēlēt Karogu
            </Link>
          </div>
        </Card>
      ) : null}
      <div className="space-y-8">
        <LingoSection stats={lingo} />
        <KarogsSection />
        <Achievements />
        <Leaderboard />
      </div>
    </div>
  );
}
