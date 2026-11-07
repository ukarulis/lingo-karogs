# Lingo V2 — A fāzes ziņojums

## 1. Repozitorija sākotnējais stāvoklis

- Bāzes komits: `467a3d9` (V1.2.0).
- Iepriekšējā sesija bija izdzēsusi `src/lib/lingo/engine.ts` (pārrakstīšanas
  sākums); šī sesija to pilnībā atjaunoja jaunajā, konfigurācijas vadītā
  veidolā, saglabājot visas publiskās eksporta parakstus.

## 2. Apstiprinātie atradumi

- Dzinējs bija cieši piesaistīts 5 burtu garumam un Latvijas valodai:
  `WORD_LENGTH = 5` konstante, garuma regex un vārdnīcas prasība bija
  iebūvētas pašā `submitGuess`.
- Vēsturiskais lietotāja ziņotais trūkums: nevar mēģināt burtu kombinācijas,
  kuru nav vārdnīcā — tas izrietēja no vārdnīcas pārbaudes visos režīmos.
- "Atkārtoti vienādi minējumi" saglabājumos: V1.2 jau bloķēja jaunus
  dublikātus, bet veciem saglabājumiem nebija normalizācijas ceļa; nebija
  arī aizsardzības pret bojātiem laukiem (garuma/konfigurācijas).
- Pareizo burtu pārnešana nākamajās rindās nebija ieviesta, lai gan tā ir
  vēsturiska Lingo uzvedība.
- Ievades āķis nezināja par bloķētām pozīcijām ārpus pirmā burta, tāpēc
  pilna vārda ievade ar bloķētiem burtiem nebūtu darbojusies.

## 3. Ieviestie spēles noteikumi

- Konfigurējams dzinējs: garums 4–7, mēģinājumu skaits, minējumu politika
  (`freeform` / `dictionary`), pirmā burta atklāšana, pareizo burtu
  pārnešana — visi kā raunda konfigurācijas lauki ar režīmu noklusējumiem.
- Noklusējumi: Dienas un Neierobežotā spēle = brīvais minējums + burtu
  pārnešana; Klasiskais Lingo = vārdnīcas minējums bez pārnešanas.
- Divu gājienu vērtēšana saglabāta (korekta atkārtotu burtu loģika), tagad
  garuma neatkarīga.
- Dublikātu bloķēšana bez mēģinājuma zaudēšanas saglabāta visos režīmos.
- Raunda statuss `resolved` rezervēts servera izšķirtiem raundiem.
- Detalizēti noteikumi: [RULES_LINGO.md](./RULES_LINGO.md).

## 4. Arhitektūras izmaiņas

- `src/lib/lingo/engine.ts` — tīrs, no ietvara neatkarīgs kodols ar
  `LingoConfig`, `modeDefaults()`, `normalizeRound()`, `lockedPositions()`,
  `fixedLetters()`. Visi mutāciju API joprojām atgriež jaunu stāvokli un
  saglabā vecos parakstus (`createRound(target, mode, opts)`,
  `submitGuess(round, raw, guessSet)`, `evaluateGuess(guess, target)`).
- `use-guess-input.ts` — kursoru balstīta ievade: bloķētu pozīciju burti
  tiek "patērēti", nevis pārvietoti; apstiprināts minējums sinhroni iztīra
  rediģējamos burtus; Backspace nekad neaizskar bloķētos mājienus.
- Režīmu komponentes ielādē saglabājumus caur `normalizeRound()` un fiksēto
  burtu masku caur `fixedLetters()`.
- Saglabājumu aploksne nav mainīta (v=2); migrācija notiek raunda līmenī.

## 5. Mainītie faili

- `src/lib/lingo/engine.ts` (pārrakstīts)
- `src/components/lingo/use-guess-input.ts`
- `src/components/lingo/DailyMode.tsx`
- `src/components/lingo/EndlessMode.tsx`
- `src/components/lingo/ArcadeMode.tsx`
- `src/components/lingo/LingoApp.tsx`
- `src/components/lingo/Onboarding.tsx`
- `src/components/lingo/share.ts`
- `src/app/ka-spelet/page.tsx`
- `tests/lingo-engine.test.ts`
- `e2e/lingo.spec.ts`
- `docs/RULES_LINGO.md`, `docs/PHASE_A_LINGO_V2.md`

## 6. Ieviestie testi

Vienību: brīvā/vārdnīcas politika, pirmā burta ievērošana brīvajā politikā,
pārnešana (bloķēšana, dzelteno nebloķēšana, uzkrāšana, izslēgšana), garumi
4–7, neatbilstošu garumu noraidīšana, `resolved` raunda bloķēšana, mantoto
saglabājumu atjaunošana (konfigurācijas aizpilde, pārnesto burtu atvasināšana,
arkādes politika, dublikātu turpmāka bloķēšana, nekonsekventa statusa labošana,
bojātu datu noraidīšana).

E2E: apstiprināto burtu pārnešana nākamajā rindā; brīvā minējuma pieņemšana
Dienas režīmā ar tieši viena mēģinājuma patēriņu; vārdnīcas politikas
atgriezeniskā saite Klasiskajā režīmā ar rediģējamības saglabāšanu; regresijas
tests, kas atveido vēsturisko anomāliju — vecs Dienas saglabājums ar
dublikātu minējumiem tiek atjaunots un tālāki dublikāti tiek bloķēti.

## 7. Testu rezultāti

- TypeScript (`tsc --noEmit`): bez kļūdām.
- ESLint: bez kļūdām un brīdinājumiem.
- Vitest: **116/116** (bāze 97; +19).
- Playwright: **62/62**, ieskaitot axe pieejamības, ģeometrijas, responsive,
  vizuālās regresijas (bāzes momentuzņēmumi nav mainīti), Karogs un
  multiplayer komplektus.
- Vizuālais bāzes momentuzņēmums "lingo board" saglabāts pikseļu precīzs.

## 8. Saglabājumu savietojamība

- V1.0/V1.1 neaploksnētie un V1.2 aploksnētie saglabājumi turpina darboties.
- Veco Dienas/Neierobežoto raundu politika pēc atjaunošanas kļūst `freeform`
  un pārnesēj burti tiek atvasināti no pēdējās rezultātu rindas; Klasiskā
  spēle paliek uz vārdnīcas politikas bez pārneses.
- Statistika un Karogs dati netiek aiztikti.

## 9. Drošība un godīgums

- Dzinējs ir bez ietvara atkarībām un klients nevar ietekmēt vērtēšanu.
- Brīvais minējums nedod bezmaksas informāciju: katrs minējums patērē
  mēģinājumu, dublikāti tiek bloķēti.
- Slepenie vārdi netiek pārvietoti no klienta uz serveri (A fāzē viss
  darbojas lokāli; nākamajās fāzēs servera konfigurācijas turpinās šo
  principu).

## 10. Zināmie ierobežojumi

- 4/6/7 burtu izvēles saskarnē vēl nav — tās ir B fāzē (dzinējs jau atbalsta).
- Pareizo burtu pārnešanas vizuālais stils pagaidām izmanto to pašu indigo
  "mājiena" šūnu kā palīdzības burti.
- Daudzspēlētāju režīmi vēl nav ieviesti (C+ fāzes).

## 11. Ražošanas izvietošanas statuss

Sk. repozitorija stāvokli: izmaiņas ir apstiprinātas ar pilno testu ciklu,
bet izvietošana Vercel notiek tikai tad, ja ir pieejami projekta
akreditācijas dati. Ja to nav, prasības ir: `VERCEL_TOKEN` un piekļuve
projektam `lingo-karogs` (`npx vercel deploy --prod`).

## 12. Manuālās pieņemšanas scenāriji

1. `/lingo` → Dienas vārds: ievadi izdomātu 5 burtu kombināciju → tā tiek
   pieņemta, patērē 1 mēģinājumu, burti iekrāsojas.
2. Ievadi vārdu ar pareizu burtu vidū (piem., pret `ĀBOLS` — `ĀBELE`) →
   pareizie burti parādās nākamajā rindā un ir bloķēti.
3. Ievadi to pašu vārdu vēlreiz → "Šo vārdu jau mēģināji.", mēģinājums
   nepatērējas.
4. Klasiskajā Lingo ievadi "ĀBCDE" → "Šāds vārds nav vārdnīcā", vārds
   paliek rediģējams.
5. Atsvaidzini lapu raunda vidū → spēle atjaunojas bez datu zuduma.
6. Ievadi pilnu vārdu, ieskaitot atklāto pirmo burtu → ievade strādā
   intuitīvi (ne dubultojas, ne pārlec).

## 13. Ieteicamā nākamā fāze

B fāze: 4/6/7 burtu izvēles saskarnē, garuma neatkarīgi paneļi un tastatūra,
Latvijas valodas pakotnes līgums un vārdnīcas versiju pārvaldība.
