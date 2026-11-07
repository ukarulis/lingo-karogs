import Link from "next/link";
import { ArrowRight, BookOpen, LineChart, Sparkles, Type, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameCards } from "@/components/home/game-cards";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <section className="mx-auto max-w-2xl pt-14 pb-10 text-center sm:pt-20">
        <div className="mb-5 flex justify-center" aria-hidden>
          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm dark:border-stone-800 dark:bg-stone-900">
            {[
              ["L", "bg-emerald-600"],
              ["I", "bg-amber-400 text-stone-900"],
              ["N", "bg-stone-300 text-stone-700"],
            ].map(([letter, color]) => (
              <span
                key={letter}
                className={`grid size-9 place-items-center rounded-lg text-lg font-black text-white ${color}`}
              >
                {letter}
              </span>
            ))}
          </div>
          <div className="-ml-1 grid size-9 place-items-center self-end rounded-lg bg-red-600 text-lg font-black text-white shadow-sm" aria-hidden>
            K
          </div>
        </div>
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
          <Sparkles className="size-3.5" aria-hidden />
          Atdzimst leģendāras latviešu spēles
        </div>
        <h1 className="text-4xl font-black tracking-tight text-balance sm:text-6xl">
          Lingo &amp; Karogs
        </h1>
        <p className="mt-4 text-lg text-stone-600 text-balance dark:text-stone-300">
          Divas leģendāras spēles. Jauns sākums.
        </p>
        <p className="mx-auto mt-3 max-w-lg text-sm text-stone-500 dark:text-stone-400">
          Atmini vārdus, slepeni izvieto savu armiju un izcīni uzvaru — bez reģistrācijas,
          uz jebkuras ierīces.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" href="/lingo">
            <Type className="size-4" aria-hidden />
            Spēlēt Lingo
          </Button>
          <Button size="lg" variant="danger" href="/karogs">
            <Flag className="size-4" aria-hidden />
            Spēlēt Karogs
          </Button>
        </div>
      </section>

      <GameCards />

      <section className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            icon: BookOpen,
            title: "Kā spēlēt?",
            text: "Īsi un interaktīvi noteikumi abām spēlēm.",
            href: "/ka-spelet",
          },
          {
            icon: LineChart,
            title: "Statistika",
            text: "Tavi rezultāti, sērijas un sasniegumi.",
            href: "/statistika",
          },
          {
            icon: ArrowRight,
            title: "Dienas vārds",
            text: "Viens vārds visai Latvijai — katru dienu.",
            href: "/lingo",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
          >
            <item.icon className="size-6 text-indigo-600 dark:text-indigo-400" aria-hidden />
            <div className="mt-3 font-bold">{item.title}</div>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{item.text}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
