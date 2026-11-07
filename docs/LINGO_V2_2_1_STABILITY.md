# Lingo V2.2.1 — multiplayer stability release

## 1. Sākuma komits

`757c495` (V2.2 ražošanas ziņojums).

## 2. Apstiprinātie atradumi

Ražošanas Piecu vārdu cīņā pēc kārtas izšķiršanas nākamās kārtas ievade
dažkārt apstājās: serveris pareizi pārgāja uz nākamo kārtu (raunda ieraksts
`playing`, 0 iesniegumu abiem spēlētājiem), bet klienta ievades buferis
nebija piesaistīts jaunajai kārtai.

## 3. Reproducētās problēmas

- Pēc kārtas beigām nākamās kārtas laukums varēja saglabāt iepriekšējās
  kārtas burtus/virkni; tastatūra šķita aktīva, bet iesniegumi netika
  sūtīti vai tika noraidīti kā dublikāti.
- Vēlīna iepriekšējās kārtas atbilde varēja ietekmēt jaunās kārtas buferi,
  jo pieņemšanas pārbaude ignorēja raunda identitāti.
- Vecāks aptaujas snapshots teorētiski varēja pārrakstīt jaunāku stāvokli.
- Akceptances skripts tipa pirms kārtas aktīvā stāvokļa (kārtas virsraksts
  atjaunojas par vienu aptaujas ciklu agrāk nekā tastatūra) — tas maskēja
  reālo klienta sacensību.

## 4. Saknes cēloņi

Ievades kontrolierim (`useGuessInput`) nebija raunda dzīves cikla atslēgas:
buferis un kursors dzīvoja pāri kārtu robežām. `OnlineMode` pieņemtie/
gaidošie iesniegumi glabājās bez raunda ID, un `guessLandedIn()` meklēja
vārdu jebkurā kārtā. Ja divas kārtas sākās ar vienu burtu un vienādu
garumu, iepriekšējā kārtā pieņemts vārds varēja izskatīties kā jaunās
kārtas iesniegums. Turklāt akceptances skripts mēģināja rakstīt brīdī, kad
tastatūra vēl bija atslēgta, un pēc tam gaidīja kārtas maiņu, kas nekad
nenāca.

## 5. Arhitektūras izmaiņas

- `RoundView` tagad satur stabilu `id` (`matchId:roundIndex`) gan aktīvajai
  kārtai, gan `resolvedRounds` vēsturei.
- `useGuessInput` saņem `roundKey`; kad tas mainās, buferis un kursors tiek
  pilnībā atiestatīti un ielādēti jaunās kārtas bloķētie burti.
- `OnlineMode` saista katru gaidošo/queued iesniegumu ar raunda ID; vecās
  kārtas vēlīnās atbildes nevar iztīrīt vai aizpildīt jaunās kārtas ievadi.
- Skata atjauninājumi iet caur monotonu versijas sargu — vecāki snapshoti
  netiek lietoti.
- Raunda maiņas efekts notīra gaidošo/queued stāvokli un iesniegšanas
  karodziņu pirms jaunās kārtas ievades.

## 6. Faili

- `src/lib/lingo-mp/types.ts`, `src/lib/lingo-mp/engine.ts` (raunda ID DTO)
- `src/components/lingo/use-guess-input.ts` (raunda barjera)
- `src/components/lingo/OnlineMode.tsx` (ar raundu saistīti iesniegumi,
  versijas sargs, vēlīno atbilžu aizsardzība)
- `src/lib/lingo-mp/store-postgres.ts`, `src/lib/lingo-mp/do-ca.ts`
  (CA kā bundlēta konstante — serverless TLS bez failu piekļuves)
- `e2e/lingo-online.spec.ts` (tīra bufera pārbaude katrā kārtas pārejā)
- `tests/lingo-mp.test.ts` (raunda identitātes testi)
- `scripts/accept-production.mts` (aktīvas ievades gaidīšana)

## 7. Dati un migrācijas

Nav shēmas izmaiņu; raunda ID jau eksistēja datubāzē (`rounds.id`), tagad
tiek eksponēts publiskajā DTO. Nekas netika migrēts vai pārģenerēts.

## 8. Valodu/vārdnīcu pārklājums

Nav mainīts — šis ir stabilitātes izlaidums.

## 9. UI/UX lēmumi

Kārtas pāreja vienmēr sākas ar tīru rediģējamo rindu (tikai atklātais
pirmais burts/bloķētie burti); vecās kārtas ievade nekad neparādās.

## 10. Automātisko testu rezultāti

- TypeScript: tīrs. ESLint: tīrs.
- Vitest: 152/152 (6 PostgreSQL integrācijas testi tiek izlaisti bez
  operatora akreditācijām; pēdējie reālie rezultāti — 6/6 zaļi).
- Playwright: 76/76 (ieskaitot atjaunoto Piecu vārdu cīņas testu ar tīra
  bufera pārbaudi starp kārtām).

## 11. Reālā pārlūka akceptance

Pret ražošanu, divi neatkarīgi pārlūka konteksti, **divas secīgas pilnas
akceptances** (dažādas pirmās kārtas sākuma burti):

- Ātrais duelis: vienāda publiskā mājiena vērtība, vienāds rezultāts abos
  klientos, bez atbildes noplūdes — PASS.
- Piecu vārdu cīņa: piecas kārtas pabeigtas, pagarinājums 3→2 (viena
  kārtā), vienāds gala rezultāts abos klientos — PASS.
- Revanšs: abi pieprasa, jauna istaba, abi gatavības stāvoklī — PASS.
- Atjaunošana pēc pārlādes: vieta un minējumu vēsture — PASS.
- Veselība `available:true` (`postgres`), nepareizs žetons 403,
  operatora diagnostika ar nepareizu atslēgu 403 — PASS.

## 12. Veiktspēja

Aptauja paliek 1,2 s spēles laikā ar focus/visibility atjaunināšanu; nav
jaunu infrastruktūras komponentu. CA bundlēšana novērš failu I/O aukstajā
startā.

## 13. Pieejamība

Axe komplekti zaļi (14/14); vizuālās bāzes nemainītas.

## 14. Drošība

Nav atklātu noslēpumu; raunda ID nav slepens (tas satur tikai matchId un
indeksu). Vēlīnās atbildes vairs nevar ietekmēt citu kārtu; versijas
sargs novērš vecāku snapshotu pārrakstīšanu.

## 15. Ražošanas izvietošana

Izvietots Vercel projektā `lingo-karogs`; statuss READY; publiskā adrese
https://lingo-karogs.vercel.app. Šī izlaiduma laikā tika atklāts un
salabots arī serverless CA bundlēšanas defekts (turbopackIgnore izslēdza
sertifikātu no funkcijas), tāpēc CA tagad ir koda konstante
`DIGITALOCEAN_CA_PEM`.

## 16. Gala komits

`72454b5` (raunda identitāte + CA) un dokumentācijas komits šajā izlaidumā.

## 17. Vercel izvietojuma ID

`dpl_4Q5ktxp3UCvqqW3Q3mw7w18VA6Kj` (ražošanas aliass
https://lingo-karogs.vercel.app).

## 18. Ekrānuzņēmumi

`docs/screenshots/v2.2.1/` — ražošanas istaba (desktop), aktīva kauja
(desktop) un mobilā kaujas skatu (375 px).

## 19. Zināmie ierobežojumi

- PostgreSQL integrācijas testu atkārtošana šajā izlaidumā nebija
  iespējama — pagaidu DB akreditācijas tika dzēstas pēc V2.2; pēdējie
  reālie rezultāti (6/6) paliek spēkā, un šajā izlaidumā servera shēma
  netika mainīta.
- Operatora veselības pareizās atslēgas pārbaude tika izlaista (tā
  glabājas tikai Vercel; lokālais tests to iepriekš apstiprināja).

## 20. Ieteikums nākamajam izlaidumam

V2.3 — mobilā ievades pārstrāde (tīmekļa tastatūras salikums + šūnas
izvēle ar pieskārienu) un globālā paletes konfigurācija. Pirms V2.3
darba sākuma ieteicams vēlreiz palaist divas ražošanas Piecu vārdu
cīņas ar cilvēku pāri, lai apstiprinātu stabilā stāvokļa saglabāšanos.
