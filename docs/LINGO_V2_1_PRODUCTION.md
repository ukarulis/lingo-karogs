# Lingo V2.1 — ražošanas ziņojums

## 1. Sākuma komits

`8358f7d` (C fāzes noslēgums; tīrs koks).

## 2. Atklātā vide

Sk. `docs/INFRASTRUCTURE_LINGO_V2.md`. Kodolīgi: Vercel autentificēts un
piesaistīts; Supabase nekur nav konfigurēts; `doctl` instalēts, bet nav
autentificēts; Docker nav; lokālais PostgreSQL prasa nepieejamu paroli;
`CARDZ_DO_ENV_FILE` pieder citam projektam un netika lietots.

## 3.–6. Datubāze, lēmumi, noslēpumi, migrācijas

Jauns tiešā PostgreSQL adapters (`LINGO_MP_STORE=postgres`, draiveris `pg`)
ar reālām transakcijām, kopīgu izturīgu rate-limiter, TLS validāciju,
least-privilege plānu un idempotentām migrācijām (`migrations-postgres/`).
Serviss tagad izpilda visas saistītās rakstīšanas vienā transakcijā
(SQLite — `BEGIN IMMEDIATE`; PostgreSQL — `BEGIN/COMMIT` ar rollback).
`PLAYER_TOKEN_SALT` ražošanā ir obligāts (fail-closed), spēlētāja žetons
vairs neceļo URL (galvene `X-Player-Token`), operatora diagnostika
aizsargāta ar atslēgu. Pirms ražošanas migrācijām nepieciešams īpašnieka
apstiprināts resurss un backup.

## 7. Diakritisko ievades pamatcēlonis

Fiziskās tastatūras apstrādātājs ignorēja visus Ctrl/Alt notikumus.
Windows latviešu izkārtojumā AltGr pienāk kā Ctrl+Alt+burts, tāpēc derīgie
burti tika izmesti. Turklāt ekrāna tastatūra rādīja Q/W/X/Y, kas nav
latviešu alfabētā.

## 8. Ievades labojumi

- AltGr atpazīšana (`getModifierState("AltGraph")` + Ctrl+Alt kombinācija);
  Ctrl/Meta īsceļi joprojām darbojas.
- Mirušo taustiņu (`Dead`) un vairāku rakstzīmju ievade tiek noraidīta
  vienas grafēmas līmenī; dekomponētā ievade tiek NFC normalizēta.
- Latviešu tastatūra vairs nerāda Q/W/X/Y; izkārtojums nāk no valodas
  pakotnes.
- Jauni pārlūka testi: AltGr, dead-key, dekompozīcija, visi 11 diakritiskie
  taustiņi, svešu burtu noraidīšana, Ctrl īsceļi, tiešsaistes ievade.

## 9. Tiešsaistes iesniegšanas labojumi

Minējums vairs netiek iztīrīts pirms servera apstiprinājuma: stāvokļi
`editable → submitting → accepted/rejected`; noraidījums saglabā rediģējamo
vārdu; zaudēta atbilde tiek atkārtota ar to pašu `actionId`; aizkavējusies
apstiprinājuma atbilde vairs neizdzēš nākamās kārtas burtus (reset tikai
tad, ja buferis joprojām satur pieņemto vārdu); pieņemšanas pārbaude skatās
arī `resolvedRounds` vēsturi.

## 10. Drošības sacietināšana

Transakcijas, izturīgs rate-limiter (PostgreSQL `lingo_rate_limits`),
galvenes autentifikācija, obligāts sāls, strukturēti rediģēti žurnāli,
veselības pārbaudes, bez noslēpumiem atbildēs.

## 11. UX izmaiņas

Precīza mikro-kopija (garums nav vairs fiksēti "5 burti"), laika brīdinājums
pēdējās 15 sekundēs, "+15 sekundes" apstiprinājums, gaidīšanas stāvoklis
"Vārds atminēts — gaidi pretinieku…", iesniegšanas indikators.

## 12. Automātiskie testi

- TypeScript / ESLint: tīri.
- Vitest: 146/146.
- Playwright: 76/76 (izpildīti pilnā komplektā), ieskaitot 4 jaunus ievades
  testus un atjaunotus tiešsaistes plūsmu testus.
- Vizuālās bāzes nemainītas; axe bez kritiskiem pārkāpumiem.

## 13. PostgreSQL testi

Adapters un migrācijas ir kodā, bet **nav izpildīti pret dzīvu PostgreSQL**:
ne autorizētas attālinātas datubāzes, ne lokālā servisa paroles nav
pieejamas. SQLite ceļš (transakcijas, idempotence, konflikti) ir pilnībā
testēts; PostgreSQL integrācijas testus pievienosim, tiklīdz resurss būs
autorizēts.

## 14. Ražošanas tiešsaistes pārbaude

Nav iespējama bez autorizētas datubāzes — prasība netiek uzskatīta par
izpildītu. Ražošanā tiešsaiste turpina **fail closed** ar godīgu
ne-pieejamības ziņojumu; solo spēles un Karogs darbojas.

## 15. Ekrānuzņēmumi

`docs/screenshots/phase-c/` (iepriekšējā fāzē) un esošie
`docs/screenshots/phase-b/`. Šajā fāzē vizuālais dizains netika mainīts.

## 16. Zināmie ierobežojumi

- Ražošanas datubāzes nav (precīzs trūkums dokumentēts infrastruktūras
  dokumentā).
- Vairāku instanču rate-limiter darbojas tikai ar `postgres` režīmu.
- Reakciju sistēma (P5) atlikta — dokumentēts lēmums: vispirms stabila
  ražošanas aizmugure.

## 17.–19. Gala komits, izvietojums, nākamā fāze

Aizpildīts izvietošanas brīdī. Ieteicamā nākamā fāze: pēc datubāzes
autorizācijas — PostgreSQL integrācijas testi un ražošanas tiešsaistes
akceptance; pēc tam D fāze (vērtējumi un publiska piemeklēšana).
