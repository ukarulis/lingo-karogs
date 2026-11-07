import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Par projektu",
  description:
    "Neatkarīgs Lingo un Karogs fanu projekts: vēsture, vārdu datu avoti, licences un privātums.",
};

export default function ParProjektuPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-black tracking-tight sm:text-3xl">Par projektu</h1>
      <div className="space-y-6 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        <section>
          <h2 className="mb-2 text-lg font-extrabold text-stone-900 dark:text-stone-100">
            Divas leģendāras spēles
          </h2>
          <p>
            Lingo un Karogs ir leģendāras latviešu spēles, kas sākotnēji tika izplatītas
            kopā ar Tildes Biroja programmatūru. Šis projekts ir{" "}
            <b>neatkarīga fanu versija</b>: spēļu mehānika veidota pēc publiski
            pieejamiem noteikumu aprakstiem un klasiskajiem spēļu likumiem, bet viss
            kods, dizains, grafika un vārdu datu apstrāde ir radīti no jauna.
          </p>
          <p className="mt-2">
            Projekts <b>nav saistīts ar Tilde</b> vai spēļu oriģinālo izstrādātāju un
            neizmanto viņu kodu, logo, grafiku vai vārdu sarakstus.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-extrabold text-stone-900 dark:text-stone-100">
            Apzinātas atšķirības no oriģināliem
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Lingo oriģinālā (TV šova iedvesmotā) krāsu shēma: sarkans = pareizi,
              zaļš = burta nav. Mūsdienu noklusējums ir zaļš = pareizi, pelēks =
              burta nav; vēsturiskā shēma pieejama iestatījumos.
            </li>
            <li>
              Klasiskajā režīmā punktu formula ir šī projekta fiksēts, dokumentēts
              aprēķins (500/400/300/250/200), jo oriģinālā precīza formula nav
              publiski aprakstīta.
            </li>
            <li>
              Karogs balstās uz klasiskajiem Stratego stila likumiem (10×10 laukums,
              40 figūras, divi ezeri). Oriģinālā Karogs figūru nosaukumu un
              precīzu atšķirību detalizēta dokumentācija nav publiski pieejama,
              tāpēc izmantoti labi dokumentētie klasiskie likumi.
            </li>
            <li>Vārdu datubāze veidota no brīvi licencētiem avotiem, nevis oriģinālā 999 vārdu saraksta.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-extrabold text-stone-900 dark:text-stone-100">
            Vārdu dati un licences
          </h2>
          <p>
            Lingo minējumu vārdnīca ģenerēta no atvērtiem CLARIN-LV resursiem
            (CC BY-SA 4.0):
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Tēzaurs.lv 2026 (pavasara izlaidums) atvērtie dati — Latviešu valodas
              WordNet (LMF) un vārdformu saraksts,{" "}
              <a
                href="https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/156"
                className="text-indigo-600 underline dark:text-indigo-400"
                target="_blank"
                rel="noreferrer"
              >
                handle 20.500.12574/156
              </a>
            </li>
            <li>
              Latviešu valodas vārdu biežuma datu kopa (25K),{" "}
              <a
                href="https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/148"
                className="text-indigo-600 underline dark:text-indigo-400"
                target="_blank"
                rel="noreferrer"
              >
                handle 20.500.12574/148
              </a>
            </li>
          </ul>
          <p className="mt-2">
            Atvasinātie vārdu dati (dictionary.json) tiek izplatīti ar to pašu
            CC BY-SA 4.0 licenci. Ģenerēšanas skripts un pilna atribūcija:
            <code className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-800">
              scripts/generate-dictionary.mjs
            </code>
            un <code className="mx-1 rounded bg-stone-100 px-1.5 py-0.5 dark:bg-stone-800">data/NOTICE.md</code>.
          </p>
          <p className="mt-2">
            Programmas kods tiek izplatīts ar MIT licenci. Aizskarošu vārdu
            filtrēšanai izmantots konservatīvs manuāls saraksts, kas tiek
            dokumentēts un papildināms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-extrabold text-stone-900 dark:text-stone-100">
            Privātums un dati
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Statistika, iestatījumi un spēļu progress glabājas tikai tavā
              pārlūkā (localStorage) — bez konta un bez servera augšupielādes.
            </li>
            <li>
              Tiešsaistes spēlēs serveris glabā tikai spēles stāvokli un segvārdu;
              spēlētāja identifikācijai izmanto anonīmu pagaidu kodu.
            </li>
            <li>
              Līderu tabulā iekļūst tikai servera verificēti tiešsaistes rezultāti;
              lokālo statistiku tur nevar ievietot.
            </li>
            <li>Visus lokālos datus vari izdzēst iestatījumos.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-extrabold text-stone-900 dark:text-stone-100">
            Atvērtais kods
          </h2>
          <p>
            Projekta avota kods atrodas GitHub:{" "}
            <a
              href="https://github.com/ukarulis/lingo-karogs"
              className="text-indigo-600 underline dark:text-indigo-400"
              target="_blank"
              rel="noreferrer"
            >
              ukarulis/lingo-karogs
            </a>
            . Ziņojumi un ierosinājumi ir laipni gaidīti.
          </p>
        </section>
      </div>
    </div>
  );
}
