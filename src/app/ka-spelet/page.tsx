import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kā spēlēt?",
  description:
    "Pilni Lingo un Karogs spēļu noteikumi latviešu valodā: vārdu minēšana, armiju izvietošana, kaujas un speciālās figūras.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details
      className="group rounded-2xl border border-stone-200 bg-white shadow-sm open:shadow-md dark:border-stone-800 dark:bg-stone-900"
      open
    >
      <summary className="cursor-pointer list-none px-5 py-4 text-base font-extrabold transition hover:bg-stone-50 dark:hover:bg-stone-800/60 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between">
          {title}
          <span className="text-stone-400 transition group-open:rotate-90" aria-hidden>
            ›
          </span>
        </span>
      </summary>
      <div className="px-5 pb-5 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        {children}
      </div>
    </details>
  );
}

export default function KaSpeletPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-black tracking-tight sm:text-3xl">Kā spēlēt?</h1>
      <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
        Īsi noteikumi abām spēlēm. Spēlēs pašās pieejamas arī interaktīvas pamācības.
      </p>
      <div className="space-y-3">
        <Section title="Lingo — vārdu minēšana">
          <p>
            Dators izdomā piecu burtu latviešu vārdu un atklāj tā pirmo burtu. Tev ir{" "}
            <b>5 mēģinājumi</b>. Pēc katra minējuma burti tiek iekrāsoti:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b className="text-emerald-600">Zaļš (mūsdienu shēma)</b> — burts ir
              pareizajā vietā. Vēsturiskajā shēmā šis burts ir{" "}
              <b className="text-red-500">sarkans</b>.
            </li>
            <li>
              <b className="text-amber-600">Dzeltens</b> — burts ir vārdā, bet citā vietā.
            </li>
            <li>
              <b className="text-red-500">Sarkans</b> — burta vārdā nav
              (vēsturiskajā shēmā — <b className="text-emerald-600">zaļš</b>).
            </li>
          </ul>
          <p className="mt-3 font-semibold">Dienas vārds</p>
          <p>
            Visiem spēlētājiem viens un tas pats vārds katrā kalendāra dienā (pēc
            Latvijas laika). Rezultātu vari kopīgot, neatklājot atbildi.
          </p>
          <p className="mt-3">
            Dienas un neierobežotajā spēlē darbojas{" "}
            <b>brīvais minējums</b>: der jebkura 5 burtu kombinācija no
            latviešu alfabēta, ne tikai vārdnīcā esoši vārdi. Pareizi
            uzminētie burti automātiski parādās nākamajās rindās.
          </p>
          <p className="mt-3 font-semibold">Neierobežotā spēle</p>
          <p>
            Bezgalīgi nejauši vārdi, uzreiz nākamais pēc katra raunda. Sērija tiek
            saglabāta.
          </p>
          <p className="mt-3 font-semibold">Klasiskais Lingo (spēļu zāle)</p>
          <p>
            Kā izstrādātāja oriģinālajā spēlē: sāc ar <b>5 dzīvībām</b> un{" "}
            <b>5 palīdzībām</b> (maksimums 10 dzīvības). Neatminēts vārds maksā vienu
            dzīvību; atminējums ar <b>pirmo</b> mēģinājumu dod papildu dzīvību.
            Punktu formula: 1. mēģinājums — 500, 2. — 400, 3. — 300, 4. — 250,
            5. — 200 punktu; neveiksme — 0. Palīdzība atklāj vienu vēl nezināmu
            burtu. Šajā režīmā katram minējumam jābūt vārdnīcā esošam vārdam.
          </p>
        </Section>

        <Section title="Karogs — armijas un izvietošana">
          <p>
            Karogs ir stratēģijas spēle uz 10×10 laukuma ar diviem nešķērsojamiem
            ezeriem. Katram spēlētājam ir <b>40 figūras</b>, kuras izvieto savās
            četrās rindās tā, lai pretinieks tās neredz. Sāk sarkanā armija.
          </p>
          <table className="mt-3 w-full max-w-md border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-700">
                <th className="py-1.5 pr-2">Figūra</th>
                <th className="py-1.5 pr-2 text-right">Rangs</th>
                <th className="py-1.5 text-right">Skaits</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Maršals", "10", "1"],
                ["Ģenerālis", "9", "1"],
                ["Pulkvedis", "8", "2"],
                ["Majors", "7", "3"],
                ["Kapteinis", "6", "4"],
                ["Leitnants", "5", "4"],
                ["Seržants", "4", "4"],
                ["Mīnētājs", "3", "5"],
                ["Izlūks", "2", "8"],
                ["Spiegs", "1", "1"],
                ["Bumba", "—", "6"],
                ["Karogs", "—", "1"],
              ].map(([n, r, c]) => (
                <tr key={n} className="border-b border-stone-100 dark:border-stone-800/60">
                  <td className="py-1 pr-2">{n}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{r}</td>
                  <td className="py-1 text-right tabular-nums">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Karogs — gājieni un kaujas">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Figūras iet vienu lauciņu uz augšu, leju, pa kreisi vai pa labi — nekad pa diagonāli.</li>
            <li>Izlūks (2) var iet vairākus brīvus lauciņus taisnā līnijā; pāri figūrām un ezeriem nevar lēkt.</li>
            <li>Bumbas un karogs nekustas.</li>
            <li>Uzejot uz pretinieka figūras, sākas kauja: lielākais rangs uzvar; vienādi rangi iznīcina viens otru.</li>
            <li>Mīnētājs (3) uzbrukumā atbruņo bumbu; citus uzbrucējus bumba iznīcina.</li>
            <li>Spiegs (1) uzveic maršalu (10) tikai tad, ja uzbrūk spiegs; maršala uzbrukumā spiegs iet bojā.</li>
            <li>Sagrābj pretinieka karogu — uzvari spēli.</li>
            <li>Ja pretiniekam nav neviena iespējama gājiena, viņš zaudē.</li>
            <li>Kaujā iesaistīto figūru identitātes kļūst zināmas abiem spēlētājiem.</li>
          </ul>
        </Section>

        <Section title="Karogs — neizšķirti un godīga spēle">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Figūru nedrīkst vadāt šurp un atpakaļ starp vieniem un tiem pašiem diviem lauciņiem trīs gājienus pēc kārtas.</li>
            <li>Ja identiska pozīcija atkārtojas trešo reizi — neizšķirts.</li>
            <li>Ja 120 gājienu laikā nenotiek neviena kauja — neizšķirts.</li>
            <li>Tiešsaistē var pieteikt uzvaru, ja pretinieks nav darbojies 15 minūtes.</li>
          </ul>
        </Section>

        <Section title="Režīmi un tiešsaiste">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><b>Pret datoru</b> — trīs grūtības pakāpes; dators redz tikai to, ko redzētu īsts spēlētājs.</li>
            <li><b>Divatā uz viena ekrāna</b> — ar privātuma aizkaru starp gājieniem.</li>
            <li><b>Tiešsaistē</b> — privāta istaba ar saiti vai kodu, servera pārbaudīti gājieni un revanši.</li>
          </ul>
          <p className="mt-3">
            Sīkāka informācija —{" "}
            <Link href="/par-projektu" className="font-semibold text-indigo-600 underline dark:text-indigo-400">
              lapā Par projektu
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
