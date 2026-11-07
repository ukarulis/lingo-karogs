# Arhitektūras piezīmes

## Moduļu struktūra

- `src/lib/lingo/` — tīrā Lingo loģika: `engine.ts` (minējumu vērtēšana,
  raundi, spēļu zāle), `daily.ts` (Rīgas laika kalendārs), `words.ts`
  (vārdnīcas ielāde un atlase), `colors.ts` (krāsu shēmas).
- `src/lib/karogs/` — tīrā Karogs loģika: `engine.ts` (laukums, izvietošana,
  gājieni, kaujas, neizšķirti), `ai.ts` (trīs AI līmeņi), `summary.ts`.
- `src/lib/store/` — lokālā noturība (localStorage ar atmiņas fallback),
  statistika, sasniegumi, iestatījumi, tiešsaistes sesijas.
- `src/lib/multiplayer/` — servera puses loģika: krātuves saskarne ar SQLite
  (izstrāde/testi) un Supabase (ražošana) implementācijām, servera autoritatīvais
  serviss, API klients.
- `src/app/api/` — Next.js API ceļi: istabu izveide/pievienošanās, gājienu
  darbības, skati, līderu tabula, veselības pārbaude.
- `src/components/` — React UI; spēļu dzinēji netiek importēti ārpus
  komponentiem un API ceļiem, un to stāvoklis vienmēr ir serializējams JSON.

## Tiešsaistes spēles modelis

- Katra istaba ir datubāzes rinda: pilns (slepenais) spēles stāvoklis,
  versija, gatavības karodziņi, pēdējās darbības identifikatori.
- Klienti saņem tikai **rediģēto** skatu: pretinieka neatklāto figūru rangi
  nekad netiek nosūtīti. Pēc spēles beigām serveris atklāj visu laukumu.
- Katra darbība tiek validēta serverī ar spēles dzinēju; klienta
  pieprasījumi nav autoritatīvi.
- Vienlaicības kontrole: optimistiska versiju atjaunināšana
  (`UPDATE ... WHERE version = ?`) ar atkārtojumiem konflikta gadījumā.
- Idempotence: katrai darbībai ir klienta ģenerēts `actionId`; atkārtoti
  pieprasījumi atgriež pašreizējo stāvokli bez dublēšanas.
- Sinhronizācija starp klientiem notiek ar aptauju (1,3 s spēles laikā,
  2,4 s citādi) — apzināti izvēlēts mehānisms, kas darbojas identiski gan
  SQLite, gan Supabase režīmā. (Realtime nav izmantots; sk. ierobežojumus.)
- Spēlētāja identifikācija: anonīms ierīces identifikators + nejaušs spēles
  talons; serveris glabā tikai jaucējumus (SHA-256).
- Pamestu spēļu apstrāde: pēc 15 minūšu neaktivitātes otra puse var pieteikt
  uzvaru; istabas, kuras neviens nav pievienojies, saimnieks var atcelt.

## Drošība

- API pieprasījumi tiek validēti ar Zod; gājieni — ar spēles dzinēju.
- Ātruma ierobežojumi: istabu izveide (10/h/IP), pievienošanās (20/h/IP),
  darbības (120/min/game/IP). Tie ir per-instanču (atmiņā) limiti.
- Nav publisku noslēpumu: klienta pakotne satur tikai publiskos mainīgos;
  datubāzei piekļūst tikai serveris ar service-role atslēgu.
- Segvārdi tiek validēti (2–20 zīmes, ierobežots rakstzīmju kopums).
- Personas dati netiek vākti; visa lokālā statistika ir dzēšama vienā darbībā.

## AI (Karogs)

- AI saņem tikai `AiStateView` — rediģētu laukuma skatu, kurā neatklātās
  pretinieka figūras ir `{ hidden: true }` bez ranga. Tests to pārbauda.
- **Viegls** — derīgi gājieni ar lielu nejaušības devu un vienkāršiem
  uzvedības svariem.
- **Vidējs** — viena līmeņa heiristiskais vērtējums: zināmās kaujas,
  sagaidāmās vērtības nezināmām figūrām, pozicionālie svari.
- **Spēcīgs** — minimaksa meklēšana 2 pusgājienu dziļumā ar alfa-beta
  atgriešanu; nezināmas figūras tiek modelētas ar sagaidāmo rangu.
- AI pats neredz slēptos rangus; tā secinājumi balstās uz publisko
  informāciju (atklātās figūras, zaudētās figūras, armijas sastāvs).

## Zināmie ierobežojumi un apzinātas izvēles

- Tiešsaistes sinhronizācija izmanto aptauju, nevis Supabase Realtime
  (mazāks neiztestēta koda apjoms, vienāda uzvedība visos režīmos).
- Ātruma ierobežojumi glabājas servera instances atmiņā — serverless vidē
  tas nozīmē per-instance limitus (V1 pieņemams; nākotnē — datubāzē balstīti).
- Nav instalējams PWA service worker — spēles bezsaistes režīmā balstās uz
  lokālo noturību; manifest un ikonas ir pievienotas.
- Karogs noteikumi balstās uz klasiskajiem, labi dokumentētajiem Stratego
  stila likumiem; oriģinālā Karogs precīzu atšķirību dokumentācija nav
  publiski pieejama.
- Dienas vārda noteikšana ir noteikta (hash no datuma), bet katrs klients to
  aprēķina pats; atbilde netiek sūtīta uz klientu pirms spēles beigām.
