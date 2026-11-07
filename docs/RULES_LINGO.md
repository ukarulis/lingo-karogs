# Lingo noteikumi un spēles loģika (Phase A)

Šis dokuments apraksta Lingo spēles noteikumus, kā tie ir ieviesti pēc V2
programmas A fāzes, un atzīmē, kuri noteikumi nāk no vēsturiskā Lingo un kuri
ir mūsu oriģināli papildinājumi.

## Avoti

- Tilde / Apple "Vecais labais Lingo" (2013) un oficiālā palīdzība.
- Two Way Media Lingo (Apvienotā Karaliste) palīdzība.
- TV3 Lingo formāts (vispārīga publiska informācija).

Artwork, skaņas un pirmkods no šīm spēlēm netiek kopēti.

## Vēsturiskie pamatnoteikumi

- Dators izvēlas **piecu burtu** latviešu vārdu.
- Tiek atklāts **pirmais burts**.
- Spēlētājam ir **5 mēģinājumi**.
- Vēsturiskajā (Tilde) krāsu shēmā **sarkans** nozīmē "burts pareizajā
  vietā", **dzeltens** — "burts ir vārdā, bet citā vietā". Mūsu modernajā
  noklusējuma shēmā pareizais burts ir **zaļš**, nav vārdā esošs — **pelēks
  / sarkans** atkarībā no izvēlētās paletes. Abas shēmas ir pieejamas
  iestatījumos, un krāsas nekad nemaina vērtēšanas loģiku.
- Klasiskajā zālē: dzīvības, palīdzības un punkti par atminējumu ar mazāku
  mēģinājumu skaitu (500 / 400 / 300 / 250 / 200).

## Vērtēšanas algoritms (visiem režīmiem vienāds)

Katrs minējums tiek vērtēts ar divu gājienu algoritmu:

1. Pirmajā gājienā atzīmē visus burtus, kas atrodas **pareizajā pozīcijā**
   (`correct`), un "rezervē" atlikušos mērķa vārda burtus.
2. Otrajā gājienā atlikušajām pozīcijām pārbauda, vai burts vēl ir
   neatbildēto mērķa burtu sarakstā — tad tas ir `present` (citā vietā),
   pretējā gadījumā `absent` (nav vārdā).

Tas garantē pareizu atkārtotu burtu apstrādi: ja mērķa vārdā burts ir vienu
reizi, trīs vienādi burti minējumā nesaņems trīs pozitīvas atzīmes.

Piemērs: mērķis `ABOLS`, minējums `ABELE` →
`correct, correct, absent, correct, absent`.

## Minējumu politikas

### Brīvais minējums (`freeform`) — noklusējums Dienas un Neierobežotajā spēlē

- Pieņem jebkuru pareizā garuma burtu virkni no latviešu alfabēta
  (ieskaitot diakritiskās zīmes); vārdam **nav** jābūt vārdnīcā.
- Izdomāta kombinācija patērē tieši vienu mēģinājumu un tiek vērtēta kā
  parasts minējums.
- Atkārtots identisks minējums tiek noraidīts ("Šo vārdu jau mēģināji."),
  un mēģinājums netiek patērēts — bezmaksas informācijas nav.

### Vārdnīcas minējums (`dictionary`) — noklusējums Klasiskajā Lingo

- Pieņem tikai vārdnīcā esošus vārdus; citādi parāda "Šāds vārds nav
  vārdnīcā" un mēģinājumu nepatērē.

Abi spēlētāji turpmākajā daudzspēlētāju spēlē vienmēr saņems vienu un to
pašu politiku — politika ir daļa no spēles konfigurācijas.

## Pirmā burta un apstiprināto burtu pārnešana

- Pirmais burts tiek atklāts un bloķēts (Dienas / Neierobežotā / Klasiskā
  režīmā). Ievadot visu vārdu, ieskaitot jau atklāto pirmo burtu, tas tiek
  "patērēts" bez pārvietošanas, tāpēc pilna vārda ievade uzvedas intuitīvi.
- **Pareizi novietoti burti automātiski parādās nākamajās rindās** Dienas un
  Neierobežotajā spēlē (`carryConfirmedLetters`). Dzeltenie (citā vietā
  esošie) burti **netiek** bloķēti.
- Klasiskajā Lingo burtu pārnešana ir izslēgta — katra rinda paliek pilnīgi
  brīva (dokumentēta novirze no TV formāta, kur pareizie burti palika
  redzami; šo var ieslēgt ar konfigurāciju).
- Atklātie palīdzības burti un apstiprinātie burti nevar būt pretrunā —
  abi nāk no mērķa vārda.

## Raunda dzīves cikls

`ready → playing → won/lost` (solo). Statuss `resolved` ir rezervēts
servera izšķirtiem daudzspēlētāju raundiem. Pabeigts raunds vairs nepieņem
minējumus; ātri atkārtota Enter spiešana nevar iesniegt vairākus minējumus.

## Garumi

Dzinējs un saskarne atbalsta 4, 5, 6 un 7 burtu vārdus. Katram garumam ir
atsevišķs, validēts vārdu kopums (mērķvārdi, biežie, minējumi) ar
kvalitātes vārtiem; garums bez derīga kopuma netiek rādīts. Katra raunda
konfigurācija (`length`, `maxAttempts`, `guessPolicy`, `revealFirstLetter`,
`carryConfirmedLetters`) kopā ar `language` un `ruleSet` tiek saglabāta
pašā raundā.

- Neierobežotajā spēlē var izvēlēties 4/5/6/7 burtus vai **Nejauši**
  (garums mainās katrā kārtā; nejaušības režīma rezultāti tiek ieskaitīti
  attiecīgā garuma statistikas spainī).
- Katram garumam ir sava, atsevišķi saglabāta sesija — pārslēdzoties
  garumiem, nepabeigtās spēles nepazūd.
- Dienas vārds paliek oficiālais 5 burtu izaicinājums; Klasiskais Lingo
  paliek uz 5 burtiem ar vārdnīcas minējumiem.

## Saglabāšana un migrācija

- Saglabājumi tiek glabāti versijētā aploksnē (`lk.*`).
- `normalizeRound()` atjauno V1.0–V1.2 raundus: aizpilda trūkstošos
  konfigurācijas laukus pēc režīma noklusējumiem, atvasina pārnestos burtus
  no pēdējās rezultātu rindas un labo nekonsekventus beigu statusus.
- Bojāts ieraksts tiek noraidīts un atslēga izdzēsta (tikai šī spēle) — bez
  bezgalīgas ielādes un neaiztiekot statistiku.
- Vēsturiskie dublikātu minējumi saglabājumos netiek pārrakstīti, bet jauni
  dublikāti tiek bloķēti.
- Neierobežotās spēles sesijas tiek glabātas ar atslēgu
  `lingoEndless:{valoda}:{garums}`; vecā `lingoEndless` piecu burtu sesija
  tiek vienreiz pārcelta uz `lingoEndless:lv:5`.
- Statistika (v2) glabā neierobežotās spēles rezultātus atsevišķi pēc
  valodas un garuma; Dienas rezultāti vairs netiek jaukti neierobežotās
  spēles skaitītājos.

## Vēsturiskais pret oriģinālo

| Noteikums | Izcelsme |
| --- | --- |
| 5 burtu vārds, pirmais burts atklāts | Vēsturiskais Lingo |
| 5 mēģinājumi | Vēsturiskais Lingo |
| Sarkans = pareizi, dzeltens = citā vietā | Vēsturiskā (Tilde) palete |
| Zaļš (pareizi) / dzeltens (citā vietā) / sarkans (nav) noklusējuma shēma | Mūsu modernā izvēle (maināma) |
| 4, 6 un 7 burtu garumi | Mūsu paplašinājums (5 burti ir vēsturiskais noklusējums) |
| Divu gājienu vērtēšana ar atkārtotiem burtiem | Mūsu precizējums |
| Brīvais minējums Dienas / Neierobežotajā spēlē | Mūsu oriģināls produkta lēmums |
| Vārdnīcas minējums Klasiskajā spēlē | Vēsturiskais noteikums |
| Pareizo burtu pārnešana nākamajās rindās | Vēsturiska uzvedība (konfigurējama) |
| Dzīvības, palīdzības, punktu formula | Vēsturiskā zāle, koriģēts līdzsvars |
| Dublikātu bloķēšana bez mēģinājuma zaudēšanas | Mūsu drošības precizējums |
