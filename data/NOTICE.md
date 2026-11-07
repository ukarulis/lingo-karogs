# Vārdu datu avoti un licences

Lingo vārdnīcu faili ir atvasināti dati, kas ģenerēti ar
`scripts/generate-dictionary.mjs` no šādiem atvērtiem avotiem:

1. **Tēzaurs.lv 2026 (pavasara izlaidums) atvērtie dati — Latviešu valodas
   WordNet (LMF/XML)** un **vārdformu saraksts (ispell)**
   - CLARIN-LV digitālā bibliotēka: https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/156
   - Licence: CC BY-SA 4.0
   - Mērķvārdi (lietvārdu lemmas) atlasīti no WordNet lemmām; minējumu
     saraksts veidots no ispell vārdformām un visām LMF lemmām.

2. **Latviešu valodas vārdu biežuma datu kopa (25K)**
   - CLARIN-LV digitālā bibliotēka: https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/148
   - Licence: CC BY-SA 4.0
   - Izmantota biežo vārdu kopas atlasei.

## Licence

Atvasinātie faili tiek izplatīti ar **CC BY-SA 4.0** licenci saskaņā ar avotu
licenču share-alike nosacījumu.

Atribūcija:

> Vārdu dati atvasināti no Tēzaurs.lv 2026 atvērtajiem datiem (CC BY-SA 4.0,
> handle 20.500.12574/156) un Latviešu valodas vārdu biežuma datu kopas
> (CC BY-SA 4.0, handle 20.500.12574/148), CLARIN-LV digitālā bibliotēka.

## Filtrēšana

- Tikai 4–7 burtu vārdi no latviešu alfabēta (NFC normalizācija, mazie
  burti). Lielā sākumburta īpašvārdi netiek iekļauti mērķvārdos.
- Mērķvārdi: lietvārdu lemmas; priekšroka vārdiem no biežuma kopas.
- Konservatīvs manuāls aizskarošu vārdu saraksts
  (`scripts/generate-dictionary.mjs`), kas tiek dokumentēts un papildināms.
- Tiek iekļauti arī daudzskaitlinieki (plurale tantum), kā oriģinālajā spēlē.
- Katrs garums tiek iespējots tikai tad, ja izpilda kvalitātes sliekšņus:
  mērķvārdi ≥ 400, biežie ≥ 100, minējumi ≥ 1000.

## Pārģenerēšana

```bash
npm run gen:dict
```

Skripts lasa `data-src/tezaurs-lmf.zip`, `data-src/tezaurs-ispell.zip` un
`data-src/frequencies-lv-25K.tsv` (lejupielāde no iepriekš norādītajām CLARIN-LV
saitēm) un ģenerē:

- `src/lib/lingo/data/lv/manifest.json` — valodas pakotnes metadati un
  kvalitātes statistika katram garumam;
- `src/lib/lingo/data/lv/length-{4,5,6,7}.json` — atsevišķi vārdu kopumi
  katram garumam (mērķvārdi, biežie, minējumi);
- `src/lib/lingo/data/dictionary.json` — mantotais piecu burtu fails
  (iesaldēts: Dienas vārda identitātes dēļ kopas netiek mainītas);
- `data/DICTIONARY_REPORT.md` — pilns statistikas pārskats.

Piecu burtu kopu maiņa izraisīs ģeneratora kļūdu, lai nejauši nemainītu
Dienas vārdu vēsturi.
