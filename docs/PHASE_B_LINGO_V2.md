# Lingo V2 — B fāzes ziņojums

## Sākuma komits

`abdefcb` (A fāzes noslēgums; tīrs darba koks).

## Īstenojuma kopsavilkums

- **Daudzgarumu spēle.** 4, 5, 6 un 7 burtu spēles darbojas ar vienu un to
  pašu dzinēju un vienu `DailyMode`/`EndlessMode`/`ArcadeMode` kopu —
  nekādu dublikātu. Neierobežotajā spēlē pieejams garuma pārslēdzējs
  (4/5/6/7 burti + Nejauši), katra garuma sesija tiek glabāta atsevišķi un
  nesen lietoto vārdu izvairīšanās darbojas katram garumam. Nejauši režīms
  katrā kārtā izvēlas jaunu iespējotu garumu. Dienas vārds (5 burti) un
  Klasiskais Lingo (5 burti, vārdnīcas minējumi) ir nemainīgi.
- **Valodas pakotnes.** Jauns `LanguagePack` kontrakts ar grafēmu
  segmentāciju, NFC normalizāciju, alfabēta validāciju un tastatūras
  izkārtojumu. Dzinējs validē un vērtē caur pakotni un katram raundam
  piešķir `language` + `ruleSet` identitāti. Latviešu pakotne ir īstā
  pakotne; mock pakotne ar citu alfabētu un normalizāciju pierāda
  paplašināmību testos.
- **Ievade un tāfele.** Tāfele ir datu vadīta (kolonnas/rindas no raunda
  konfigurācijas, kompakti izmēri mobilajā); tastatūra nāk no pakotnes;
  fiziskā tastatūra tiek validēta ar izvēlētās pakotnes noteikumiem.
- **Krāsu shēma.** Modernā noklusējuma shēma: zaļš = pareizā vietā,
  dzeltens = citā vietā, **sarkans = nav vārdā**. Vēsturiskā (sarkans =
  pareizi, zaļš = nav) un augsta kontrasta shēmas saglabātas; leģendas
  spēlē, pamācībā un palīdzības lapā seko izvēlētajai paletei; kopīgošanas
  režģī tagad izmanto sarkanos kvadrātiņus.
- **Statistika v2.** Neierobežotās spēles rezultāti tiek glabāti atsevišķos
  spaiņos pēc valodas un garuma; V1 dati tiek vienreiz migrēti uz `lv:5`
  spaini (idempotenti); Dienas rezultāti vairs netiek jaukti neierobežotās
  spēles skaitītājos; dienas sērijas tagad balstās uz Rīgas kalendāru
  (ieskaitot DST pārejas). Statistikas lapā parādās tabula pēc garumiem.
- **Saglabājumi.** Neierobežotās spēles atslēgas:
  `lingoEndless:{valoda}:{garums}`; vecā `lingoEndless` sesija tiek vienreiz
  pārcelta uz `lingoEndless:lv:5`. Bojāti dati noraida tikai konkrēto spēli.

## Ģenerētās vārdnīcas un vārdu skaits

| Garums | Mērķvārdi | Biežie | Minējumi | Iespējots |
| --- | ---: | ---: | ---: | --- |
| 4 | 537 | 348 | 6 584 | jā |
| 5 | 1 033 | 624 | 22 675 | jā (iesaldēts) |
| 6 | 1 665 | 882 | 58 821 | jā |
| 7 | 1 906 | 887 | 120 777 | jā |

Pilns pārskats: `data/DICTIONARY_REPORT.md`. Piecu burtu kopas ir
bit-identiskas iepriekšējai versijai — Dienas vārda vēsture nav mainīta.

## Kvalitātes vārti

Garums tiek iespējots tikai tad, ja mērķvārdi ≥ 400, biežie ≥ 100 un
minējumi ≥ 1000. Ģenerators pārtrauc darbu, ja 5 burtu kopas mainītos;
izvēlne slēpj neiespējotus garumus, un bojāts/tukšs kopums nekad nerada
spēli bez vārdiem.

## Licence un izcelsme

Visi kopumi atvasināti no Tēzaurs.lv 2026 (CC BY-SA 4.0,
handle 20.500.12574/156) un 25K biežuma kopas (CC BY-SA 4.0,
handle 20.500.12574/148); atribūcija saglabāta `data/NOTICE.md` un
pakotnes `attribution` laukā. Nav izdomātu vārdu; avotu faili ir lokāli
pieejami un reproducēšana ir `npm run gen:dict`.

## Valodas pakotnes API

Detalizēti: `docs/LANGUAGE_PACKS.md`.

## Statistikas migrācija

V1 `endless` struktūra → V2 spainis `lv:5`, vienreiz un idempotenti
(persistēta pie pirmās ielādes). Vēsturiski Dienas uzvaras bija ieskaitītas
`endless` skaitītājos; tās nevar atdalīt retroaktīvi un paliek `lv:5`
spainī — turpmāk režīmi ir pilnībā nodalīti.

## Veiktspēja

- Sākotnējais komplekts nav audzis: 5 burtu kopums (209 KB neapstrādāts,
  ~62 KB gzip) jau bija sākotnējā komplektā; 4/6/7 burtu kopumi tiek
  ielādēti tikai pēc izvēles (57/596/1334 KB neapstrādāti; ~19/159/326 KB
  gzip).
- Vārdu izvēle un minējumu kopas tiek kešotas procesa mūžā.
- Raunds glabā visu konfigurāciju, tāpēc turpmākai servera pusei nav
  jāsūta vārdnīcas klientiem.

## Testi

- TypeScript: bez kļūdām. ESLint: bez kļūdām un brīdinājumiem.
- Vitest: **132/132** (13 jauni: pakotnes, kopumi, migrācija, Rīgas
  kalendārs, konfigurēti mēģinājumi).
- Playwright: **68/68**, ieskaitot 5 jaunus plūsmas testus (4 un 7 burtu
  raundi, sesiju pārslēgšana, nejaušais režīms, krāsu leģenda) un 7 burtu
  dēli 320px platumā; axe pieejamība; vizuālā regresija — statistikas
  sekcijas bāzes momentuzņēmums apzināti pārģenerēts pārveidotajai
  sekcijai, pārējie momentuzņēmumi nav mainīti.
- Karogs komplekts: pilnībā zaļš (Karogs netika mainīts).

## Ekrānuzņēmumi

- `docs/screenshots/phase-b/lingo-unlimited-7-desktop.png`
- `docs/screenshots/phase-b/lingo-unlimited-4-mobile.png`
- `docs/screenshots/phase-b/lingo-daily-colors.png`
- `docs/screenshots/phase-b/statistika-per-length.png`

## Zināmie ierobežojumi

- Dienas vārdam joprojām ir tikai oficiālais 5 burtu izaicinājums
  (citi garumi — iespējama turpmāka iespēja ar atsevišķiem identifikatoriem).
- Klasiskais Lingo paliek uz 5 burtiem.
- Publiskā/privitā raunda stāvokļa atdalīšana (C fāzes pamati) ir sagatavota
  tikai daļēji: raunds jau nes `language` + `ruleSet` un dzinējs ir bez
  ietvara atkarībām; atsevišķi publiskie/protokola tipi nāks kopā ar
  daudzspēlētāju C fāzē.
- Statistika atspoguļo visus neierobežotos rezultātus (ieskaitot Nejauši
  režīmu) attiecīgā garuma spainī — dokumentēts lēmums.

## Ražošana

**Izvietots ražošanā.** Vercel izvietojums `dpl_A4uunmRBWPc7H1jfMLC4twWgca2m`
(statuss READY), publiskā adrese https://lingo-karogs.vercel.app.

Pārbaudes pret ražošanu:

- `scripts/smoke-production.mjs` — 9/9.
- `scripts/verify-production.mjs` — 5/5 (Karogs un kopējās lapas neskartas).
- Reāla pārlūkprogramma: pilni raundi **visos četros garumos** (4, 5, 6 un 7
  burti) — katrs raunds pabeigts ar 5 brīvajiem minējumiem, tāfelei ir
  pareizs kolonnu skaits, bez lapas kļūdām; statistikas lapā katram
  garumam reģistrētas spēles.

## Gala komits

`00d01b8` (dokumentācija un ekrānuzņēmumi) virs `b74ab3c` (implementācija).
