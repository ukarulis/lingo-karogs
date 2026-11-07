# Latviešu valodas vārdnīcu pārskats (autoģenerēts)

Versija: `tezaurs-2026-2` · ģenerēts: 2026-11-07T13:41:44.186Z

## Atlases politika

- Mērķvārdi: lietvārdu lemmas no WordNet (LMF), tikai latviešu alfabēta
  mazie burti (NFC), bez atstarpēm/defisēm, bez lielā sākumburta
  (īpašvārdi), ārpus aizskarošo vārdu saraksta.
- Biežie mērķvārdi: mērķvārdi, kas ir 25K biežuma kopā ar POS `n`.
- Minējumi: ispell vārdformas + visas LMF lemmas + mērķvārdi
  (alfabēts, NFC, bez atstarpēm/defisēm).
- Kvalitātes slieksnis: mērķvārdi ≥ 400, biežie ≥ 100, minējumi ≥ 1000.
- 5 burtu kopas ir iesaldētas (Dienas vārda identitāte).

## Statistika

| garums | iespējots | neapstr. lemmas | neapstr. ispell | nederīgas rakstzīmes | formāts | īpašvārdi | bloķēti | dublikāti | mērķi | biežie | minējumi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | jā | 927 | 10030 | 177 | 6 | 10 | 1 | 79 | 537 | 348 | 6584 |
| 5 | jā | 1678 | 30341 | 153 | 6 | 21 | 1 | 97 | 1033 | 624 | 22675 |
| 6 | jā | 2524 | 71344 | 107 | 5 | 40 | 0 | 59 | 1665 | 882 | 58821 |
| 7 | jā | 2875 | 135901 | 69 | 7 | 29 | 0 | 40 | 1906 | 887 | 120777 |

## Avoti un licences

- Tēzaurs.lv 2026 atvērtie dati (WordNet LMF un ispell), CC BY-SA 4.0,
  handle 20.500.12574/156.
- Latviešu valodas vārdu biežuma datu kopa (25K), CC BY-SA 4.0,
  handle 20.500.12574/148.

Atvasinātie faili tiek izplatīti ar CC BY-SA 4.0.

Reproducēšana: `npm run gen:dict` (avota faili `data-src/`).
