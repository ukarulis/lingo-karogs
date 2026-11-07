# Lingo V2.1 — infrastruktūras pārbaude un lēmumi

## Pārbaudītie resursi (2026-11-07)

| Resurss | Statuss |
| --- | --- |
| Vercel projekts `4357lv/lingo-karogs` | Autentificēts CLI (`ukarulis`), projekts piesaistīts, izvietošana darbojas |
| Vercel ražošanas mainīgie | Tikai `NEXT_PUBLIC_SITE_URL`; nav Supabase/Datubāzes mainīgo |
| Vercel integrācijas | Nav (`vercel integration ls` — tukšs) |
| DigitalOcean CLI (`doctl`) | Instalēts, bet **nav autentificēts**; konfigurācijas direktoriju nav |
| Docker | Nav instalēts |
| Supabase projekts | Nekur nav konfigurēts (nav URL/atslēgu ne lokāli, ne Vercel) |
| Lokālais PostgreSQL 18 pakalpojums | Darbojas (ports 5432), bet pieprasa paroli, kas nav pieejama; `pg_hba.conf` nav lasāms |
| Lokālais mainīgais `CARDZ_DO_ENV_FILE` | Pieder citam projektam (Cardz) — **netiek izmantots** |

## Lēmums par ražošanas aizmugursistēmu

Ražošanas tiešsaistei izvēlētais ceļš ir **tiešais PostgreSQL** adapters
(`LINGO_MP_STORE=postgres`), jo:

- Supabase REST nevar transakcionāli sasaistīt vairākas tabulas;
- DigitalOcean Managed PostgreSQL (vai Supabase PostgreSQL) izmanto parasto
  PostgreSQL protokolu;
- jauns `store-postgres.ts` adapters (draiveris `pg`) veic visas saistītās
  rakstīšanas vienā transakcijā un nodrošina kopīgu, izturīgu rate-limiter
  tabulu.

Supabase adapters ir saglabāts saderībai, bet tā `transaction()` ir
sekvenciāla (dokumentēts ierobežojums); ražošanai ieteicams `postgres`
režīms.

## Nepieciešamie vides mainīgie

| Mainīgais | Kur | Mērķis |
| --- | --- | --- |
| `LINGO_MP_STORE=postgres` | Vercel Production | Izvēlētais aizmugures režīms |
| `LINGO_MP_DATABASE_URL` | Vercel (noslēpums) | Pooled savienojums (PgBouncer režīms `transaction`) |
| `PLAYER_TOKEN_SALT` | Vercel (noslēpums) | ≥16 zīmes; ražošanā bez tā sistēma ciešo nedarbojas |
| `OPERATOR_HEALTH_KEY` | Vercel (noslēpums) | Aizsargātās diagnostikas atslēga |
| `LINGO_MP_SSL=disable` | Tikai lokālai attīstībai | TLS validācija ražošanā vienmēr ieslēgta |
| `LINGO_MP_POOL_MAX` | Pēc izvēles | Pūla limits (noklusējums 3) |

Nekad neievietot `NEXT_PUBLIC_*` noslēpumus; tiešsaistes žetonus nesūtīt URL.

## Migrācijas

- `migrations-postgres/0001_lingo_init.sql` — idempotenta shēma
  (standarta PostgreSQL, bez Supabase specifikas) ar unikāliem
  ierobežojumiem, indeksiem un `lingo_rate_limits` tabulu.
- `supabase/migrations-lingo.sql` — Supabase variants (RLS ieslēgta).
- `ensureLingoMpStore()` palaiž migrācijas idempotenti pirms pirmās
  lietošanas; versija tiek fiksēta `lingo_schema_versions`.

## Piekļuves ierobežojumi

- Ražošanas datubāzei jāļauj savienojumi tikai no Vercel reģiona / caur
  trusted sources; TLS validācija ieslēgta.
- Lietojumprogrammas lietotājam jābūt least-privilege: CRUD tikai
  `lingo_*` tabulām.
- Operatora diagnostika (`/api/lingo-mp/health`) prasa galvenes atslēgu.

## Veselības pārbaude

- Publiskā: `GET /api/lingo-mp/status` — `{available, mode}` bez
  infrastruktūras detaļām.
- Operatora: `GET /api/lingo-mp/health` ar `X-Operator-Key` galveni —
  datubāzes sasniedzamība, aizkave, shēmas versija, konfigurācijas
  klātbūtne.

## Dublēšana un atcelšana

- Pirms migrācijām: datubāzes snapshot/dump no izvēlētā providera paneļa.
- Migrācijas ir tikai pievienojošas un idempotentas; atcelšana ir lietotnes
  līmenī (atgriezt `LINGO_MP_STORE=disabled`), nevis destruktīva datubāzē.

## Trūkstošā iespēja (precīzi)

**ATRISINĀTS V2.2**: īpašnieks piešķīra pagaidu DigitalOcean piekļuvi.
Izveidota `lingo_prod` datubāze, `lingo_app` lietotājs un `lingo_pool`
baseins; shēma `lingo`; TLS ar DigitalOcean projekta CA; ražošana
aktivizēta. Detalizēti: `docs/LINGO_V2_2_PRODUCTION.md`.
