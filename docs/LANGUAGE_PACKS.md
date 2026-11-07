# Valodas pakotnes (Language Pack) API

Spēles dzinējs (`src/lib/lingo/engine.ts`) ir valodneitrāls: visi
valodai specifiskie noteikumi nāk no `LanguagePack` saskarnes
(`src/lib/lingo/pack/types.ts`).

## Kontrakts

```ts
export interface LanguagePack {
  id: string;                       // stabils identifikators, piem. "lv"
  locale: string;                   // displejam/šķirošanai, piem. "lv-LV"
  displayName: string;              // cilvēklasāms nosaukums
  dictionaryVersion: string;        // vārdnīcas versija
  ruleSetVersion: string;           // noteikumu versija
  supportedLengths: readonly number[];
  alphabet: readonly string[];      // mazie burti grafēmu līmenī
  normalizeInput(input: string): string;
  segmentWord(word: string): string[];
  validateCharacters(word: string): boolean;
  keyboardLayout: KeyboardLayout;
  attribution: string;
  license: string;
}
```

- `normalizeInput` — apgriež atstarpes, samazina reģistru un veic Unicode
  normalizāciju (NFC), lai dekomponētas diakritiskās zīmes
  (`a` + komb. makrons) kļūtu par vienu burtu (`ā`).
- `segmentWord` — sadala vārdu lietotāja uztvertos burtos ar grafēmu
  segmentāciju (`Intl.Segmenter`), nevis ar koda vienību garumu.
- `validateCharacters` — pārbauda, vai katrs grafēms ir alfabētā.
- `keyboardLayout.rows` — ekrāna tastatūras rindas; `"enter"` un `"back"`
  ir rezervētie taustiņi; `compactKeys` sarakstā norādītie taustiņi tiek
  renderēti mazāki šauros ekrānos; `physicalKeyMap` var kartēt fiziskās
  tastatūras taustiņus uz burtiem.

## Reģistrs

`src/lib/lingo/pack/registry.ts`:

- `registerPack(pack)` — reģistrē pakotni (testi to izmanto mock pakotnei).
- `resolvePack(id)` — atgriež pakotni pēc raundā saglabātā identifikatora;
  nezināmiem/mantotiem identifikatoriem atgriež latviešu pakotni.

Katrs raunds saglabā `language` un `ruleSet` laukus, tāpēc vērtēšana vienmēr
notiek ar to pašu pakotni, ar kuru raunds tika izveidots — arī pēc
saglabājuma atjaunošanas.

## Vārdu kopumi

`src/lib/lingo/pools.ts` ielādē Latvijas valodas kopumus pēc manifesta
(`src/lib/lingo/data/lv/manifest.json`), kur katram garumam ir:

- `enabled` — kvalitātes vārtu rezultāts;
- `file` — kopuma fails;
- `targetCount` / `frequentCount` / `guessCount` — kopumu izmēri;
- `stats` — ģenerēšanas statistika (neapstrādātie kandidāti, izslēgtie pēc
  iemesla, dublikāti).

4/6/7 burtu kopumi tiek ielādēti tikai pēc pieprasījuma (dinamisks imports);
5 burtu kopums ir sākotnējā komplektā. Ja kāda garuma kopums ir bojāts vai
tukšs, šis garums tiek uzskatīts par neiespējotu un netiek rādīts izvēlnē —
nekad nerodas tukša vai bezgalīgi ielādējoša spēle.

## Paplašināmības pierādījums

`tests/lingo-pack.test.ts` reģistrē mock pakotni ar citu alfabētu
(`a,b,c,d,w`) un normalizāciju (`v → w`) un pabeidz pilnu raundu — bez
jebkādām dzinēja izmaiņām.

## Nākamās valodas

Lai pievienotu valodu, nepieciešams: reāls, licencēts vārdnīcas avots ar
dokumentētu izcelsmi, ģenerēšanas cauruļvads ar tādiem pašiem kvalitātes
vārtiem, jauna `LanguagePack` implementācija un testi. Interfeisa tulkojums
un mīklu valoda ir atsevišķi jēdzieni un netiek jaukti.
