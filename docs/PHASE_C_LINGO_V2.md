# Lingo V2 — C fāzes ziņojums

## 1. Sākuma un gala komiti

- Sākums: `2b9d418` (B fāzes noslēgums).
- Gala komits: sk. repozitoriju (ieviešana `45d9cbb` + `7be6cd4` + gala
  dokumentācijas komits).

## 2. Arhitektūras lēmumi

- **Atsevišķs `lingo-mp` domēns.** Karogs infrastruktūras modeļi netiek
  lietoti Lingo; pārņemti tikai pārbaudītie infrastruktūras modeļi: žetonu
  jaukšana ar sāli, īso istabu kodu ģenerēšana, optimistiskā versiju
  atjaunināšana un action-id idempotence.
- **Tīrs, deterministisks dzinējs.** Visas pārejas (atskaite, kārta, raunds,
  rezultāts) tiek aprēķinātas no saglabātiem laikspiedoliem ar injicējamu
  pulksteni — bez garas dzīvojošiem taimeriem, tāpēc darba instance var
  pazust un jauna to atjaunot identiski.
- **Serverless draudzīgs laiks.** Termiņi tiek glabāti UTC ISO formātā;
  nokavējumi tiek izšķirti pie nākamā lasījuma/darbības, nevis ar fonā
  darbināmu taimeri.
- **Klients redz tikai rediģēto skatu.** Servera privātie modeļi
  (mērķvārdi, pilna minējumu vēsture) nekad netiek serializēti API atbildēs.
- **`LINGO_MP_STORE` atsevišķs karogs.** `sqlite` lokāli/E2E, `supabase`
  tikai ar akreditācijām, `disabled` ražošanā bez konfigurācijas — Karogs
  tiešsaistes uzvedība netiek ietekmēta.

## 3. Datu bāzes shēma un migrācijas

`supabase/migrations-lingo.sql`: `lingo_matches` (dzīves cikls, budžeti,
termiņi, rematch karogi, versija), `lingo_match_rounds` (katras kārtas
privātais vārds, termiņi, iznākumi, punkti), `lingo_round_submissions`
(katrs minējums ar vērtējumu, unikāls `(round_id, player, seq)`),
`lingo_match_events` (unikāls `action_id`), `lingo_match_results` (unikāls
`match_id`). Visām tabulām ir ieslēgta RLS; anonīmiem klientiem piekļuves
nav, serveris lieto tikai service-role atslēgu. SQLite ekvivalents
(`store-sqlite.ts`) tiek lietots lokālai attīstībai un visiem automātiskajiem
testiem — tas nepierāda PostgreSQL transakciju uzvedību, bet visi kritiski
invarianti (unikāli ierobežojumi, idempotence) ir izteikti shēmā abām
implementācijām.

## 4. Viesu sesijas un autorizācija

- Klienta ģenerēts `playerToken` (crypto.randomUUID), serverī glabāts tikai
  SHA-256 jaucējums ar servera sāli (`PLAYER_TOKEN_SALT`).
- Uzaicinājuma saite satur tikai istabas kodu (`/lingo?room=CODE`), ne
  noslēpumus. Sesija tiek glabāta localStorage un atjauno pareizo vietu pēc
  pārlādēšanas.
- Tikai dalībnieka žetons var iesniegt minējumus/pagarinājumus; svešs
  žetons saņem 403. Segvārdi tiek validēti (2–20 rakstzīmes).
- Istabas ar statusu `waiting` noveco pēc 24 stundām (lazy tīrīšana).

## 5. Privātais/publiskais stāvoklis

Servera privātajā modelī ir mērķvārdi un visi minējumi. Publiskais skats
(`LingoMpView`) satur tikai: savus minējumus ar vērtējumiem, savu termiņu,
atlikušos mēģinājumus/pagarinājumus, pretinieka progresu (iznākums un
minējumu skaits — apzināti redzama informācija), atklātos vārdus tikai pēc
kārtas izšķiršanas un gala rezultātu. E2E pārbauda, ka aktīvā skatā nav
ne mērķvārda, ne pretinieka minējumu.

## 6. Spēles protokols

`POST /api/lingo-mp` (izveide), `POST /api/lingo-mp/join`, `GET
/api/lingo-mp/[id]?token=…`, `POST /api/lingo-mp/[id]/action`,
`GET /api/lingo-mp/status`. Darbības: `ready`, `guess`, `extend`,
`forfeit`, `cancel`, `rematch`, `leave`. Katrai darbībai `actionId`;
atkārtots pieprasījums atgriež pašreizējo stāvokli bez atkārtota efekta.
Rezultāti tiek finalizēti tikai serverī; `version` pieaug monotoni, un
optimistiskās versiju atjaunināšanas novērš pārrakstīšanu.

Dzīves cikls: `waiting → ready → countdown → playing → finished` ar
termināliem `cancelled`/`expired`/`forfeited`. Pārejas:
izveide → pievienošanās → gatavība ×2 → atskaite (4 s) → kārta → minējumi /
pagarinājumi / noilgums → kārtas izšķiršana (5 s pāreja) → fināls →
revanšs ×2 → jauna istaba.

## 7. Taimeris un pagarinājumi

- Ātrais duelis: 60 s/kārta, bez pagarinājumiem.
- Piecu vārdu cīņa: 90 s/kārta, 3 pagarinājumi spēlei, +15 s katrs,
  maksimums 1 kārtā, tikai pirms termiņa. Pagarinājums maina tikai
  termiņu — punktu laika bonuss tiek rēķināts no sākotnējās kārtas
  ilguma bāzes (tests to apstiprina).
- Klients sinhronizē pulksteni pēc `serverNow` un rāda aptuvenu atskaiti;
  autoritatīvs vienmēr ir servera termiņš.

## 8. Punktu formula

Atrisināta kārta:
`1000 + 150 × (5 − mēģinājumi) + floor(max(0, bāzesLaiks − pagājušaisLaiks))`.
Neatrisināta — 0 punktu. Uzvarētājs: lielāka punktu summa → vairāk atminētu
vārdu → mazāk kopējo minējumu atrisinātajās kārtās → mazāks kopējais
atrisināšanas laiks → neizšķirts.

## 9. Drošības kontroles

- Žetonu jaukšana ar sāli; autorizācija katrai darbībai; nezināmas
  valodas/vārdnīcas/noteikumu versijas tiek noraidītas izveides brīdī.
- action-id idempotence (tīkla atkārtojums nepatērē papildu resursus).
- Optimistiskās versiju atjaunināšanas ar atkārtojumu.
- Limiti: izveide 10/h, pievienošanās 20/h, darbības 120/min uz istabu+IP
  (dalītais in-memory limiter — vairāku instanču vidē nepieciešams dalīts
  limiter, sk. ierobežojumus).
- Pārbaužu testi: viltoti žetoni, sveša istaba, idempotence, atbildes
  noplūde.

## 10. Vienību un E2E rezultāti

- TypeScript un ESLint: bez kļūdām.
- Vitest: **145/145** (13 jauni: dzīves cikls, vērtēšana, pagarinājumi,
  punktu formula, noplūdes aizsardzība, SQLite noturība pēc restartēšanas,
  idempotence, revanšs, viltoti žetoni).
- Playwright: **72/72**, ieskaitot 4 jaunus divu neatkarīgu pārlūku
  scenārijus: pilns Ātrais duelis ar vienādiem rezultātiem abos klientos;
  Piecu vārdu cīņa ar pagarinājumu (3→2, viena kārta), visām piecām
  kārtām, rezultātu tabulu un revanšu; pārlādēšana atjauno vietu un
  minējumu vēsturi; idempotence un 403 viltotiem žetoniem. Vizuālās
  bāzes momentuzņēmumi nav mainīti.

## 11. Lokālā divu pārlūku pārbaude

Izpildīta pret lokālo serveri ar `LINGO_MP_STORE=sqlite` (sk. §10). Divas
neatkarīgas pārlūka konteksti spēlē pilnu spēli ar vienādiem vārdiem un
vienādiem rezultātiem.

## 12. Ražošanas infrastruktūras prasības

Nepieciešams Supabase projekts:

- `NEXT_PUBLIC_SUPABASE_URL` (projekta URL — nav noslēpums).
- `SUPABASE_SERVICE_ROLE_KEY` (noslēpums; tikai servera vide).
- `PLAYER_TOKEN_SALT` (noslēpums; stabila vērtība).
- `LINGO_MP_STORE=supabase`.

Migrācija: `supabase/migrations-lingo.sql` (SQL redaktorā vai
`supabase db push`). Pēc migrācijas pārbaudīt, ka anonīmiem pieprasījumiem
nav piekļuves (`alter … enable row level security` jau shēmā).

## 13. Ražošanas statuss

**Implementācija pabeigta; ražošanas aktivizēšana bloķēta** — Supabase
akreditācijas nav nodrošinātas. Ražošanā `LINGO_MP_STORE` nav iestatīts,
tāpēc izvietotajā vietnē "Spēlēt ar draugu" godīgi rāda
"Tiešsaistes spēle pašlaik nav pieejama", un API atbild ar 503. C fāzes
ražošanas pieņemšanas kritērijs (divas īstas ierīces pret ražošanu) vēl
nav izpildīts — to nevar izpildīt bez akreditācijām.

## 14. Zināmie ierobežojumi

- Rate limiter ir in-memory (viena instance): vairāku instanču izvietojumā
  jāpievieno dalīts limiter; kritiskos invariantus tomēr sargā DB
  ierobežojumi un idempotence.
- Savienojuma stāvoklis tiek noteikts pēc dalības, nevis reāllaika
  sirdsdarbības; sinhronizācija ir aptaujas (1,5 s spēles laikā), nevis
  push notikumi — atvienošanās indikators nav reāllaika.
- Revanšs sākas ar gatavības fāzi abiem spēlētājiem; pārslēgta nav
  iespējama bez jaunas istabas.
- E2E režīmā mērķvārdi ir deterministiski (`NEXT_PUBLIC_E2E`), lai testi
  varētu atminēt vārdu; ražošanas ceļš izmanto kriptogrāfisko nejaušību.

## 15. Manuālās pieņemšanas instrukcijas

1. `LINGO_MP_STORE=sqlite npm run dev` (vai `npm run build && npm start`).
2. Pārlūkā A: Lingo → "Spēlēt ar draugu" → segvārds → "Izveidot istabu".
3. Kopē saiti un atver pārlūkā B (cita ierīce/privātais logs) → segvārds →
   "Pievienoties".
4. Abi "Esmu gatavs" → atskaite → viena un tā pati pirmā burta atbilde.
5. Spēlē ātro dueli: uzvar noteiktais pēc punktiem/mēģinājumiem/laika;
   rezultāts redzams abiem.
6. Piecu vārdu cīņā izmanto "Pagarināt +15 s" (3→2→1, vienreiz kārtā),
   pabeidz visas piecas kārtas, salīdzini punktus, pieprasi revanšu abos
   klientos un turpini jaunā istabā.
7. Pārlādē lapu spēles vidū — vieta un minējumu vēsture atjaunojas.
