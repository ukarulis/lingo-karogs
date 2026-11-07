# Vārdu datu avoti un licences

`src/lib/lingo/data/dictionary.json` ir atvasināts datu fails, kas ģenerēts ar
`scripts/generate-dictionary.mjs` no šādiem atvērtiem avotiem:

1. **Tēzaurs.lv 2026 (pavasara izlaidums) atvērtie dati — Latviešu valodas
   WordNet (LMF/XML)** un **vārdformu saraksts (ispell)**
   - CLARIN-LV digitālā bibliotēka: https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/156
   - Licence: CC BY-SA 4.0
   - Mērķvārdi (lietvārdi nominatīvā) atlasīti no WordNet lemmām;
     minējumu saraksts veidots no ispell vārdformām un visām LMF lemmām.

2. **Latviešu valodas vārdu biežuma datu kopa (25K)**
   - CLARIN-LV digitālā bibliotēka: https://repository.clarin.lv/repository/xmlui/handle/20.500.12574/148
   - Licence: CC BY-SA 4.0
   - Izmantota dienas vārdu (biežāko vārdu) kopas atlasei.

## Licence

Atvasinātais fails tiek izplatīts ar **CC BY-SA 4.0** licenci saskaņā ar avotu
licenču share-alike nosacījumu.

Atribūcija:

> Vārdu dati atvasināti no Tēzaurs.lv 2026 atvērtajiem datiem (CC BY-SA 4.0,
> handle 20.500.12574/156) un Latviešu valodas vārdu biežuma datu kopas
> (CC BY-SA 4.0, handle 20.500.12574/148), CLARIN-LV digitālā bibliotēka.

## Filtrēšana

- Tikai piecu burtu vārdi no latviešu alfabēta (NFC normalizācija, mazie
  burti).
- Mērķvārdi: lietvārdu lemmas; priekšroka vārdiem no biežuma kopas.
- Konservatīvs manuāls aizskarošu vārdu saraksts
  (`scripts/generate-dictionary.mjs`), kas tiek dokumentēts un papildināms.
- Tiek iekļauti arī daudzskaitlinieki (plurale tantum), kā oriģinālajā spēlē.

## Pārģenerēšana

```bash
npm run gen:dict
```

Skripts lasa `data-src/tezaurs-lmf.zip`, `data-src/tezaurs-ispell.zip` un
`data-src/frequencies-lv-25K.tsv` (lejupielāde no iepriekš norādītajām CLARIN-LV
saitēm) un ģenerē `src/lib/lingo/data/dictionary.json`.
