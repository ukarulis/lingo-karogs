# Lingo V2.2 — ražošanas aktivizēšanas ziņojums

## 1. Sākuma komits

`17176ef` (V2.1 noslēgums). Gala komits — sk. repo (`336f8f5` un turpmākie).

## 2. Atklātā DigitalOcean infrastruktūra

- Klasteris `c18ec0cd-1865-436d-bb3d-80d14c111c29` (`mezakarte-db-prod`),
  PostgreSQL 17, 1 mezgls, 1 vCPU/2 GB, reģions fra1, statuss online.
- Esošās datubāzes: `defaultdb`, `mezakarte`, `amatpersona_prod`,
  `cardz_dev`, `forestmemory_acceptance` — **nav mainītas**.
- Esošais lietotājs `doadmin` un baseins `Mezakartelv` — nav mainīti.
- Ugunsmūra noteikumu nav (klasteris aizsargāts ar parolēm/TLS);
  ieteikums īpašniekam: pārskatīt trusted sources, nemainot esošo
  lietotņu piekļuvi.
- Vercel funkciju reģions `arn1`; savienojums ar fra1 darbojas.

## 3. Datu bāzes izolācijas lēmums

Izveidots atsevišķs komplekts koplietotajā klasterī:

- datubāze `lingo_prod`;
- lietotājs `lingo_app` (atsevišķi ģenerēta parole, glabāta tikai Vercel
  sekretā vidē);
- shēma `lingo` (īpašnieks `lingo_app`; PostgreSQL 17 atņem CREATE uz
  `public`, tāpēc objekti dzīvo izolētā shēmā);
- loma: `ALTER ROLE lingo_app IN DATABASE lingo_prod SET search_path =
  lingo, public`;
- baseins `lingo_pool` (transaction režīms, 6 savienojumi, datubāze
  `lingo_prod`, lietotājs `lingo_app`).

Runtime izmanto baseinu; migrācijas — tiešo savienojumu.

## 4. Privilēģiju pārbaude

Integrācijas testi apstiprināja: `lingo_app` nevar lasīt `mezakarte`
shēmas tabulas (permission denied) — negatīvais izolācijas tests zaļš.
DDL ražošanā neizpildās pie pieprasījumiem (sk. 6.).

## 5. PostgreSQL shēma un migrācijas

- `migrations-postgres/0001_lingo_init.sql` (idempotents, standarta
  PostgreSQL) — 7 tabulas + indeksi + `lingo_rate_limits`.
- Migrācijas izpildītas ar `scripts/migrate-lingo-db.mjs` caur tiešo
  savienojumu; shēmas versija = 1.

## 6. Savienojuma baseins un TLS

- CA sertifikāts iegūts ar `doctl databases get-ca` (DigitalOcean projekta
  CA) un pievienots repozitorijā `certs/digitalocean-ca.crt` (publisks
  certifikāts, nav noslēpums).
- `pg` draiverim `sslmode` parametrs tiek izņemts no URI un verificēšana
  tiek dota `ssl: { rejectUnauthorized: true, ca }` — stingra hostname un
  CA validācija.
- Baseina režīms `transaction`; `LINGO_MP_POOL_MAX=3` uz instances.
- Runtime neizpilda DDL: `migrate()` tikai pārbauda shēmas versiju; DDL —
  tikai ar `LINGO_MP_AUTO_MIGRATE=1` (netiek lietots ražošanā).

## 7. Reālie PostgreSQL integrācijas testi

`tests/lingo-pg-integration.test.ts` (izpildās tikai ar operatora env):
6/6 zaļi pret reālo ražošanas bāzi — pilns duelis ar autoritatīvu
vērtējumu, vienlaicīgi dublikāti (idempotence), revanša sacensība → tieši
viens jauns mačs, kļūdu injekcija → pilna transakcijas atcelšana,
starpshēmu izolācija, baseina transports.

Testējot atklāja un salaboja reālu PostgreSQL defektu: bērnu-rakstu
upserti konfliktēja ar `action_id` unikālo ierobežojumu pēc optimistiskas
atkārtošanas; tagad `ON CONFLICT DO NOTHING` + versiju konflikts atceļ visu
transakciju pirms atkārtojuma. Vēlāk atklājās vēl viens reāls defekts —
novecojušu agregātu aklie raundu upserti pārrakstīja pretinieka tikko
ierakstīto iznākumu; labots ar tikai-mainīto-raundu rakstīšanu.

## 8. Cardz pārskats (tikai lasāms)

`turn.cards` darbvirsmā atrodas tikai `research/` (zole pētījuma
dokumentācija) un `.secrets/` (nav lasīts); Cardz lietotnes pirmkoda un
socketu arhitektūras nav pieejama. Pārskata tabulu tāpēc nav iespējams
patiesi aizpildīt — netiek izgudrotas "verified findings".

## 9. Aptaujas pret WebSocket lēmums

Vercel WebSockets ir GA (2026-10-20), bet starpinstanču faniem nepieciešama
kopīga notikumu kopne, kuras nav (nav Redis; LISTEN/NOTIFY ar transaction
baseinu nav savienojams bez tiešām sesijām). Lēmums: saglabāt pierādītu
aptaujas modeli ar uzlabojumiem — 1,2 s kadence spēles laikā, focus/
visibility atsvaidzināšana, fetch noilgumi (8–15 s), lai karājošs
pieprasījums nekad neaizsaldē iesniegšanas cauruļvadu. WebSocket ieviešanu
vērtēt tikai kopā ar autorizētu kopīgo notikumu infrastruktūru.

## 10. Ražošanas izvietojums

Vercel ražošanas mainīgie: `LINGO_MP_STORE=postgres`,
`LINGO_MP_DATABASE_URL` (sekret), `LINGO_MP_SSL_CA_FILE`,
`LINGO_MP_POOL_MAX=3`, `PLAYER_TOKEN_SALT` (sekret),
`OPERATOR_HEALTH_KEY` (sekret). Karogs mainīgie un `NEXT_PUBLIC_SITE_URL`
nemainīti. Pagaidu paceltie rate-limit mainīgie pēc pārbaudēm noņemti.

## 11. Divu spēlētāju akceptance

Pret īsto ražošanu (divi neatkarīgi pārlūka konteksti):

- **Ātrais duelis**: istaba → uzaicinājums → abi gatavi → atskaite →
  vienāda publiskā mājiena vērtība → minējumi → vienāds gala rezultāts
  abos klientos; atbildes noplūdes nav (vārds redzams tikai pēc
  izšķiršanas). **PASS** (atkārtoti).
- **Piecu vārdu cīņa**: izveide, pievienošanās, gatavība, pagarinājums
  (+15 s, 3→2, viena kārtā) **PASS**; kārtas izšķiras un punkti strādā,
  bet automatizētajā pārbaudē starp kārtām novērojama klienta puses
  sacensība: pēc kārtas izšķiršanas nākamās kārtas ievade dažkārt netiek
  iesniegta (serveris ieraksta 0 minējumus nākamajā kārtā). Servera puse
  ir korekta (DB pierādījumi, integrācijas testi); atklāts **zināms
  ierobežojums** — prasa klienta ievades kontroliera pārslēgšanas
  pārstrādi. Pilnā 5 kārtu pabeigšana nav sasniegta automātiskajā harnesā,
  un tas netiek uzskatīts par izpildītu.
- **Atkārtota pieslēgšanās / drošība / veselība**: vietas un minējumu
  vēstures atjaunošana pēc pārlādēšanas **PASS**; viltots žetons → 403
  **PASS**; publiskā veselība `available:true` **PASS**; operatora
  diagnostika ar atslēgu **PASS** (db sasniedzams, shēmas versija 1).

## 12. Drošība

Sekreti tikai Vercel; DO administratīvie dati nav Vercel; pagaidu
akreditācijas netika komitetas; vietējie pagaidu faili dzēšami pēc sesijas.
`doadmin` parole paliek rotējama īpašniekam (nav mainīta).

## 13. Zināmie ierobežojumi

- Klienta puses kārtu pārejas sacensība Piecu vārdu cīņā (sk. 11.) —
  nākamais labojums: ievades kontrolieris pārslēdzas tikai pēc
  autoritatīva jaunās kārtas stāvokļa.
- Rate-limiter ir izturīgs tikai `postgres` režīmā.
- WebSocket netika ieviests (pamatojums 9.).
- Automātiskā akceptance pieprasa līdz 30 minūšu retrospektīvu atkārtotu
  izpildi rate-limitu dēļ (noklusējumi 30 izveides/h, 60 pievienošanās/h).

## 14. Solo un Karogs regresija

Solo Lingo (Dienas/Neierobežotā/Klasiskā) un Karogs pārbaudīti ražošanā
(smoke 9/9, verifikācija 5/5); pilnie Playwright komplekti zaļi lokāli.

## 15. Nākamās darbības

1. Labot kārtu pārejas sacensību klienta pusē un pabeigt piecu kārtu
   ražošanas akceptanci.
2. Pēc īpašnieka apstiprinājuma: trusted sources pārskats klasterim un
   `doadmin` paroles rotācija koordinācijā ar citām lietotnēm.
