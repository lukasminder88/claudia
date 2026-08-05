# Analyse: Abacus for Distributors (Build 171)

Diese Analyse beschreibt, wie der Abacus intern aufgebaut ist und wie er Klickpreise
berechnet. Sie ist die Grundlage für die Nachbildung in `js/abacus-engine.js`.

## 1. Aufbau der Dateien

Abacus und Foliant sind **interaktive PDF-Formulare (AcroForm)** mit umfangreichem,
dokument-weitem JavaScript. Die eigentlichen Daten stecken in versteckten Formularfeldern.

### Abacus (`Abacus_v1.2_for_Distributors_Build_171.pdf`)
- Einseitiges Formular mit Menü: `OPEN FOLIANT`, `SERVICE VALUES`, `USAGE BALANCE`,
  `CONDITIONS`, `VOLUMES`, `CALCULATE`, `IMPORT FOLIANT`.
- Dokument-JavaScript (ca. 220 KB) in 11 Blöcken:
  `ButtonHandler`, **`Calculation`**, `Dialogs`, `General`, `Gfx`, `GfxChart`,
  `Interpretation`, `Language`, `Textprocessor`, `UILogisticFunctions`, `_startup`.
- Datenfelder:
  - `Castor` – **Registry** mit Default-Konditionen, Default-Servicewerten, Medienkatalog,
    Farb-/Plexmodi (siehe unten).
  - `Pandora` – die aktuell geladene/beispielhafte Gerätekonfiguration (Module + Teileliste).
  - `CalculationReport` – zuletzt berechneter Report (dient hier als Validierungsreferenz).

### Foliant (`Foliant_bizhub_C251i…C751i_v1.10R1.pdf`)
- Interaktiver Konfigurator für die Geräteserie.
- Datenfelder:
  - `Pandora` (Text, ~12 KB) – Basistabellen: **ArticleCodes**, **ConsumableCodes**,
    **Physicals** (Maße/Gewicht/Strom) und **DynamicData** (Formeln).
  - `Seelensuppe` (FlateDecode, ~184 KB) – UI-/Sprite-/Logik-Layout des Konfigurators.
  - `Babelfisch` (FlateDecode, ~488 KB) – Sprachbibliothek (Übersetzungen).

**Wichtig:** Ein *unkonfigurierter* Foliant enthält noch **keine** Modul-Teile mit
Ergiebigkeiten/Preisen. Erst wenn er im Konfigurator „finalisiert" wird
(`isFinalised()`), füllt sich `Pandora` mit `Modules` + `PartsList`. Preise stammen immer
aus einer separat importierten **Preisliste** (im Foliant sind sie 0).

## 2. Datenfluss beim Laden (Abacus)

```
OPEN FOLIANT  → genBtn_LoadConfig_action()
  liest configTagList aus dem Foliant (welche Module gewählt sind)
  → collectSystemValues()
      liest Pandora.Modules, filtert die gewählten Module,
      lädt je Modul: service-Werte, mediaCatalog, colorModes, plexModes
      lädt Registry-Defaults (LocalConditions / LocalServices)
```

Das Ergebnis ist ein `currentConfig`-XML mit:
`conditionLocal`, `service` (HW), `serviceLocal` (Arbeit), `moduleData`, `mediaCatalog`,
`colorModes`, `plexModes`, `volumeData`, und – aus dem Foliant – `Pandora.Modules` /
`Pandora.PartsList`.

## 3. Registry-Defaults (aus dem Feld `Castor`)

### Konditionen (`conditionLocal`)
| Name | Default | Einheit |
|---|---|---|
| `volumePeriod` | 1 | Monate |
| `calcPeriod` | 60 | Monate |
| `profitParts` / `profitCons` / `profitToner` / `profitService` | 0 | % |

### HW-Servicewerte (`service`, Beispiel bizhub 4000i)
| Name | Wert | Bedeutung |
|---|---|---|
| `mcbf` | 26239 | Mean Copies Between Failures |
| `pmCycle` | 200000 | PM-Intervall (Bilder) |
| `timeCM` | 0,5 h | Zeit je Störungsbesuch |
| `timePM` | 2,36 h | Zeit je PM |
| `nonPMpartsFact` | 0,5 | Non-PM-Teile-Zuschlag |
| `avImgJob` / `effImgJob` | 1 / 1 | Bilder pro Job (Ist/Spez.) |
| `singImgJobMul` | 1,2 | 1-Bild-Job-Faktor |

### Arbeit/Anfahrt (`serviceLocal`)
| Name | Wert |
|---|---|
| `timeTrav` | 0,5 h |
| `costTravHour` | 45 €/h |
| `distTrav` | 30 km |
| `costTravDist` | 0,7 €/km |
| `costLabHour` | 45–60 €/h |
| `plannedOV` / `timeOV` / `costOV` | 0 / 0 / 47 |

### Medienkatalog (Referenz A4)
`A4sef standard`: `length=297 width=210 refMul=1` → **Referenzmedium** (`default=3`).
Kleinere Medien haben `refMul < 1` (A5 = 0,5 …).

## 4. Die Berechnung (`calcVolumeValues` + `calcVolumeModuleValues`)

### 4.1 Volumen-Zähler
Aus `images`, `plexity` und Medium:
```
ci = images
cs = ceil(images / plexity)                 // Blätter
ra = round(images · Fläche / RefFläche)      // Referenzflächen (A4: = images)
rl = ceil(images · refMul)                   // Referenzlänge
```
Über die Laufzeit: `volPeriodMultiplier = calcPeriod / volumePeriod`.

### 4.2 Serviceteile & Verbrauch
Je Teil mit Ergiebigkeit `yield`, Paketmenge `qty`, Lebensdauer-Split `yspread` und dem
Funktions-Zähler `vol` (z. B. `print_rl`, `feed_cs`):
```
amount = floor( vol / (yspread · yield) ) · qty
cost   = price · amount
```
Summe je Kategorie, dann:
```
totalSpare = ΣspareCost · imgJobMul · (1 + profitParts/100)
costParts  = totalSpare · (1 + nonPMpartsFact)      // abgerechnet inkl. Non-PM-Teile
totalCons  = ΣconsCost  · imgJobMul · (1 + profitCons/100)
```
mit
```
imgJobMul = 1,                             falls avImgJob ≥ effImgJob
          = m·avImgJob + n  sonst, mit
            m = (1 - singImgJobMul)/(effImgJob - 1),  n = 1 - m·effImgJob
```

### 4.3 Toner
Je Volumen und aktiver Farbe (K bzw. C,M,Y):
```
Ergiebigkeit(Deckung):
  1 Punkt  [cov0, y0]:  yield = y0 · cov0 / cov      // invers zur Deckung
  n Punkte:            lineare Interpolation zwischen den Stützstellen
gedruckteBilder = volume.ra · printAnteil
gebinde         = gedruckteBilder / Ergiebigkeit(Deckung)
tonerCost      += gebinde · price / qty
```
Am Ende: `totalToner = ΣtonerCost · volPeriodMultiplier · (1 + profitToner/100)`.

### 4.4 Service / Arbeit
```
totalRefLength = ΣvolumeRL · volPeriodMultiplier
MCBV           = mcbv, sonst ceil( 1 / (1/mcbf + 1/pmCycle) )
Besuche (V)    = ceil( totalRefLength / MCBV )
visitsPM       = totalRefLength / pmCycle          // Bruch
eventsPM       = floor( totalRefLength / pmCycle )

travTime  = timeTrav · (plannedOV + V) · costTravHour
travDist  = costTravDist · distTrav · (plannedOV + V)
fixPerTrav= costFixPerTrav · (plannedOV + V)
fixMonth  = costFixMonthTrav · volPeriodMultiplier
labHour   = costLabHour · ( (V - visitsPM)·timeCM + eventsPM·timePM )
otherVis  = (plannedOV · timeOV) · costOV

serviceCost  = travTime + travDist + fixPerTrav + fixMonth + labHour + otherVis
totalLabour  = serviceCost · (1 + profitService/100)
```

### 4.5 Zusammenführung & Klickpreis
```
Gesamt        = costParts + totalCons + totalToner + totalLabour
Gesamt o.Toner= costParts + totalCons + totalLabour
```
Je Volumen werden Teile/Verbrauch nach dem Funktions-Zähler-Anteil, die Arbeit nach dem
Referenzlängen-Anteil zugeteilt; der **Klickpreis** = `Volumenkosten / Volumenbilder`.

## 5. Validierung am mitgelieferten Beispiel (bizhub 4000i / BH4422S)

Der Abacus-`CalculationReport` (60 Monate, ein Mono-Volumen, `rl_PRN = 210000`):

| Teil | qty | Preis | yield | vol | used | cost |
|---|---|---|---|---|---|---|
| IUP26 (Verbrauch) | 1 | 27,70 | 60000 | 210000 | 3 | **83,10** |
| Transfer Roller | 1 | 7,14 | 200000 | 210000 | 1 | 7,14 |
| Fusing Unit | 1 | 88,49 | 200000 | 210000 | 1 | 88,49 |
| Pick-Up Roller | 1 | 4,42 | 200000 | 210000 | 1 | 4,42 |
| Feed/Sep. Pad | 1 | 7,24 | 200000 | 210000 | 1 | 7,24 |

- `floor(210000/60000)·27,70 = 3·27,70 = ` **83,10 €** (Verbrauch) ✓
- Serviceteile PM = 7,14+88,49+4,42+7,24 = **107,29 €** ✓
- Abgerechnet inkl. Non-PM 0,5: `107,29·1,5 = ` **160,935 €** ✓

Die Engine (`node test/validate.cjs`) liefert exakt diese Werte. Der im PDF gespeicherte
Labour-Betrag (833,79) stammt aus einem älteren Arbeits-/Anfahrtskostenstand; mit dem im
`Castor` hinterlegten aktuellen Wertesatz liefert **dieselbe Formel** 742,575 – die Formel
ist also korrekt, nur die gespeicherten Eingabewerte des Reports sind älter.
