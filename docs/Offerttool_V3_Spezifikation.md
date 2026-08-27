# Offerttool V3 – Regelbasierte Befüllung

**Zweck:** Deterministische Generierung der Offerte aus n Kalktools (.xlsx) und einer Word-Formatvorlage.
**Ersetzt:** V2 (Textbausteine mit `%%TOKEN%%`, Interpretation durch ein Sprachmodell).
**Grundsatz:** Der Generator trifft **keine** Entscheidungen. Jede Ausgabe ist Funktion von
(Vorlage, Kalktool-Zellen, CRM-Datensatz, dieser Spezifikation). Gleiche Eingabe → byteweise gleiche Ausgabe.

**Referenzdateien:**
`Offerte_deCH_Kauf.docx` (Vorlage), `Kalktool_Birsfelden_C3351i.xlsx` (Kalktool Q4 2025).

---

## 0. Warum kein Freitext-Template mehr

V2 beschreibt Textbausteine in Prosa und markiert Lücken mit `%%TOKEN%%`. Das setzt voraus, dass
jemand – Mensch oder Modell – den Baustein im Dokument **findet**. Ein Suchen-und-Ersetzen über
Fliesstext bricht, sobald ein Wort in der Vorlage geändert wird, und es ist nicht prüfbar, ob alle
Stellen getroffen wurden.

V3 dreht das um:

| | V2 | V3 |
|---|---|---|
| Fundstelle im Dokument | Textsuche nach Baustein | benannter Anker (`w:tag` eines Inhaltssteuerelements) |
| Auflösung | Modell interpretiert Regeltext | Generator wertet `mapping.yaml` aus |
| Fehlende Daten | Modell erfindet oder lässt weg | definierter Fehlercode, Abbruch oder markierte Lücke |
| Prüfbarkeit | Sichtprüfung | Golden Record (Abschnitt 14) |
| Formatierung | „gemäss Vorlage" | Style-ID hart in der Regel hinterlegt |

Ein Sprachmodell darf am Ende der Kette stehen (Plausibilisierung, Lektorat), aber nie in der
Befüllung selbst.

---

## 1. Pipeline

```
1  LOAD_TEMPLATE     Vorlage öffnen, Ankerkatalog validieren      → E10x
2  LOAD_SOURCES      n Kalktools + CRM-Datensatz einlesen         → E20x
3  EXTRACT           Zellen → Rohwerte (Abschnitt 4)              → E21x
4  PARSE             Freitextfelder zerlegen (Abschnitt 6)        → W30x
5  DERIVE            Schalter und Rechenwerte (Abschnitt 5)       → E40x
6  VALIDATE_INPUT    Abbruchregeln (Abschnitt 13.1)               → E4xx
7  RENDER            Anker füllen, Standort-Blöcke klonen         → E50x
8  POSTPROCESS       TOC, Feldwerte einfrieren (Abschnitt 12)
9  VALIDATE_OUTPUT   Sperrliste, Restplatzhalter (Abschnitt 13.2) → E6xx
```

Schritte 1–6 sind seiteneffektfrei und erzeugen ein `context`-Objekt. Erst Schritt 7 berührt das
Dokument. Bricht ein Schritt ab, entsteht **keine** Datei – nie eine halbe Offerte.

---

## 2. Eingaben

### 2.1 Vorlage

Eine `.dotx`, einmalig mit Ankern präpariert (Abschnitt 3). Die Vorlage ist verbindlich:
Der Generator legt keine eigenen Absatz- oder Tabellenformate an und ändert keine Style-Definition.

### 2.2 Kalktools

Liste von Dateipfaden, **Reihenfolge = Reihenfolge der Standorte im Dokument**.
Ein Kalktool = ein Standort = ein Gerät. Die Nummerierung (`standort.index`) ist der 1-basierte
Listenindex, nicht ein Wert aus dem Blatt.

Blattnamen: `KM` = `KM - Système couleur ` (Achtung: Leerzeichen am Ende), `SOL` = `Détail Solutions`.
Der Generator liest Blätter **nach Position** (`KM` = Index 0, `SOL` = Index 1) und prüft den Namen
nur als Warnung, damit ein umbenanntes Blatt nicht die Generierung stoppt.

### 2.3 CRM-Datensatz

JSON, ein Objekt pro Offerte. Pflichtfelder in Abschnitt 4.4.

### 2.4 Konfiguration

`mapping.yaml` (Abschnitt 15). Enthält jede Zelladresse. Im Code stehen **keine** Zelladressen.
Bei einer neuen Kalktool-Version wird nur die YAML dupliziert und angepasst; die Auswahl erfolgt
über `KM!C1` (`"Version: Q4 2025"`).

**Unbekannte Version.** Im Feld sind ältere Kalktools im Umlauf, deren `KM!C1` eine Version nennt,
für die es keine YAML gibt. Geraten wird trotzdem nicht: jede YAML führt unter `layout_marken` die
Beschriftungen, die an bestimmten Zellen stehen müssen (`KM!A5` = `Kunde :` und so weiter).

| Lage | Verhalten |
|---|---|
| Version bekannt, Marken stimmen | Mapping wird verwendet |
| Version bekannt, Marke weicht ab | Mapping wird verwendet, `W314` |
| Version unbekannt, genau ein Mapping passt | dieses Mapping, `W313` |
| Version unbekannt, mehrere oder kein Mapping passt | Abbruch `E202` |

So kostet eine kleine Abweichung eine Warnung statt einer verweigerten Offerte, ein wirklich
umgebautes Kalktool aber führt zum Abbruch, bevor irgendwelche Zellen falsch gelesen werden.

---

## 3. Ankerkatalog

Jede Einfügestelle in der Vorlage ist ein Inhaltssteuerelement (`w:sdt`) mit gesetztem `w:tag`.
Der Generator adressiert ausschliesslich über `w:tag`. Fehlt ein Anker aus dieser Liste → `E101`.
Ein Anker, den die Spezifikation nicht kennt → `E102`.

### 3.1 Ankertypen

| Typ | Bedeutung | Verhalten des Generators |
|---|---|---|
| `TEXT` | einzeiliger Wert | ersetzt den Inhalt durch genau einen Run |
| `BLOCK` | mehrere Absätze | ersetzt den Inhalt durch n Absätze, Style je Zeile aus der Regel |
| `TABLE` | Tabelle mit Kopf- und Musterzeile | klont die Musterzeile je Datensatz |
| `SECTION` | ganzer Abschnitt inkl. Überschriften | wird je Standort geklont oder entfernt |
| `SWITCH` | Variantenblock | genau eine Kindvariante bleibt stehen, alle anderen werden gelöscht |

### 3.2 Anker in der Vorlage

| Tag | Typ | Inhalt | Style-ID |
|---|---|---|---|
| `OFF.KUNDE` | BLOCK | Kundenadressblock Deckblatt | `Normal` |
| `OFF.ANBIETER` | BLOCK | Graphax-Adresse (statisch) | `Normal` |
| `OFF.KONTAKT` | BLOCK | Ansprechperson Graphax | `Normal` |
| `OFF.KLASSIFIZIERUNG` | TEXT | „Vertraulich" | `Normal` |
| `OFF.NUMMER` | TEXT | Offertnummer | `Normal` |
| `OFF.VERSION` | TEXT | Offertversion | `Normal` |
| `OFF.DATUM` | TEXT | Offertdatum, eingefroren | `Normal` |
| `OFF.GUELTIG_BIS` | TEXT | Gültigkeitssatz | `Normal` |
| `SEC.STANDORT` | SECTION | Kapitel 1.1 je Standort | – |
| `HEAD.STANDORT` | TEXT | Standortüberschrift | `Heading3` |
| `LINE.STANDORT_ADRESSE` | TEXT | Installationsadresse | `05Klein` |
| `TBL.HARDWARE` | TABLE | Geräteliste | `graphax11` |
| `HEAD.DL` | TEXT | Überschrift Dienstleistungen | `Heading3` |
| `TBL.DIENSTLEISTUNG` | TABLE | einmalige Kosten | `graphax100` |
| `SEC.SERVICE` | SECTION | Kapitel 1.2 je Standort | – |
| `HEAD.SERVICE_STANDORT` | TEXT | Standortüberschrift Service | `Heading3` |
| `TBL.SERVICE` | TABLE | Wartungs- und Klickkosten | `graphax1000` |
| `TBL.TOTAL` | TABLE | Summen | `graphax100` |
| `TBL.GESAMTTOTAL` | TABLE | Summe über alle Standorte | `graphax100` |
| `SW.VERTRAGSTEXT` | SWITCH | Kauf / Miete / Leasing | `Normal` |
| `HEAD.VERTRAGSTEXT` | TEXT | Überschrift Laufzeit/Kündigung | `Heading2` |
| `TBL.KONDITIONEN` | TABLE | Konditionentabelle | `graphax20` |
| `LINE.NACHWEIS` | TEXT | Kalktool-Version, Verkaufschance | `05Klein` |
| `OFF.ORT_DATUM` | TEXT | „Spreitenbach, TT.MM.JJJJ" | `Normal` |

Style-IDs sind die internen IDs aus `styles.xml`, nicht die Anzeigenamen
(`graphax11` = „graphax_1_1", `05Klein` = „05_Klein").

---

## 4. Feldkatalog

Typen: `TXT` Text · `INT` Ganzzahl · `DEC` Dezimalzahl · `CUR` Betrag · `RATE` Klickpreis ·
`DATE` Datum · `ENUM` Aufzählung.
Pflicht: `M` Muss (fehlt → Abbruch) · `O` Kann (fehlt → Feld entfällt) · `W` fehlt → Warnung.

### 4.1 Kopfdaten (Blatt KM)

| Feld | Zelle | Typ | Formatter | Pflicht |
|---|---|---|---|---|
| `kunde.firma` | `B5` | TXT | `trim` | M |
| `kunde.strasse` | `D5` | TXT | `trim` | M |
| `kunde.plz_ort_roh` | `G5` | TXT | `parse_plz_ort` | M |
| `kunde.nr` | `J3` | TXT | `trim` | O |
| `kunde.kontakt_roh` | `J5` | TXT | `parse_kontakt` | W |
| `standort.name` | `B7` | TXT | `trim` | M |
| `standort.strasse` | `D7` | TXT | `trim` | M |
| `standort.plz_ort_roh` | `G7` | TXT | `parse_plz_ort` | M |
| `vk.name` | `B3` | TXT | `trim` | M |
| `vk.nr` | `E3` | TXT | `trim` | O |
| `verkaufschance` | `M8` | TXT | `trim` | M |
| `datum` | `M9` | DATE | `date_de` | M |
| `kalktool.version` | `C1` | TXT | `trim` | M |

### 4.2 Vertragsrahmen (Blatt KM)

| Feld | Zelle | Typ | Formatter | Pflicht |
|---|---|---|---|---|
| `finanzierungsart` | `I16` | ENUM 1–5 | – | M |
| `laufzeit` | `J16` | INT | `monate` | M |
| `fakt.pauschale` | `M15` | TXT | `trim` | M |
| `fakt.mehrseiten` | `M16` | TXT | `trim` | M |
| `fakt.gebuehren` | `L98` | TXT | `trim` | O |
| `vertragsbeginn_roh` | `A100` | TXT | `parse_vertragsbeginn` | W |
| `anlieferungsart` | `C96` | TXT | `trim` | O |
| `business.type` | `A15` | TXT | `trim` | O |
| `business.subtype` | `A16` | TXT | `trim` | O |

### 4.3 Service und Volumen (Blatt KM)

| Feld | Zelle | Typ | Formatter | Pflicht |
|---|---|---|---|---|
| `sla.type` | `J58` | TXT | `trim` | O |
| `sla.preis` | `M58` | CUR | `chf` | O |
| `grundpauschale` | `M59` | CUR | `chf` | O |
| `volumen.sw` | `H56` | INT | `int_ch` | M |
| `preis.sw` | `H59` | RATE | `rate` | M |
| `volumen.color` | `H61` | INT | `int_ch` | M |
| `preis.color` | `H64` | RATE | `rate` | M |
| `volumen.scan` | `H66` | INT | `int_ch` | O |
| `preis.scan` | `H69` | RATE | `rate` | O |
| `fleet.level` | `J64` | TXT | `trim` | O |
| `fleet.preis` | `M64` | CUR | `chf` | O |
| `zaehlerversand` | `C10` | TXT | `trim` | O |
| `service.geraet` | `L94` | CUR | `chf` | M |
| `service.solution` | `L93` | CUR | `chf` | O |
| `pauschale_ohne_service` | `L92` | CUR | `chf` | M bei Miete/Leasing |
| `monatspauschale_total` | `L95` | CUR | `chf` | M bei Miete/Leasing |
| `summenlabel` | `H92` | TXT | `trim` | M bei Miete/Leasing |
| `netto_verkaufspreis` | `C59` | CUR | `chf` | M bei Kauf |
| `restwert_altvertrag` | `C60` | CUR | `chf` | O |
| `dl_eingerechnet` | `C61` | CUR | `chf` | O |
| `vertragswert` | `C62` | CUR | `chf` | M bei Kauf |

### 4.4 CRM

| Feld | Typ | Pflicht | Ersatz falls leer |
|---|---|---|---|
| `crm.offertnummer` | TXT | W | `verkaufschance` + Warnung `W305` |
| `crm.offertversion` | TXT | W | `"1.0"` + Warnung `W306` |
| `crm.kontakt.anrede` | TXT | O | Zeile entfällt |
| `crm.kontakt.vorname` | TXT | O | aus `parse_kontakt` |
| `crm.kontakt.nachname` | TXT | O | aus `parse_kontakt` |
| `crm.vk.funktion` | TXT | O | Zeile entfällt |
| `crm.vk.email` | TXT | O | Zeile entfällt |
| `crm.vk.telefon` | TXT | O | Zeile entfällt |

Regel: Ein leeres Kann-Feld erzeugt **keine** leere Zeile im Dokument. Der Absatz wird gelöscht.

### 4.5 Positionslisten

| Liste | Blatt | Bereich | Spalten | Zeilenfilter |
|---|---|---|---|---|
| `hardware` | KM | `A27:E52` | A Bezeichnung, C Listenpreis | `A` nicht leer **und** `A` ≠ `"Support :"` |
| `dienstleistung` | KM | `A72:D93` | Label = Zeile n, Werte = Zeile n+1 | `A(n+1)` > 0 |
| `solutions.sw` | SOL | `A21:H38` | A Anzahl, B Art.-Nr., C Bezeichnung, H Netto | `C` nicht leer **und** `H` > 0 |
| `solutions.maint` | SOL | `A43:H56` | wie oben | wie oben |
| `solutions.dl` | SOL | `A61:H71` | A Anzahl/Std, B Art.-Nr., C Bezeichnung, G Preis/Std, H Total | `C` nicht leer **und** `H` > 0 |

**Blockstruktur `dienstleistung`:** Der Bereich ist paarweise aufgebaut – eine Zeile mit dem Label
(Spalten B–D leer), darunter eine Zeile mit Beträgen. Der Parser liest Paare (n, n+1) von `A72`
aufsteigend. Labels enthalten in der Referenzdatei gesperrte Buchstaben
(`"I n t e g r a t i o n"`); Formatter `label_clean` (Abschnitt 7.7) normalisiert das.

Nur **Spalte A (verrechnet)** erscheint in der Offerte. Spalte B (finanziert) steckt in der
Monatspauschale, Spalte C ist die Summe beider, Spalte D die Amortisation – beide unbrauchbar.

---

## 5. Ableitungsregeln

Alle Regeln sind Boolesche oder arithmetische Ausdrücke über Abschnitt 4. Keine Regel liest eine
Zelle, die nicht im Feldkatalog steht.

### 5.1 Finanzierungsvariante

| `finanzierungsart` | `variante` | `vertragsart_wort` |
|---|---|---|
| 1 | `KAUF` | – |
| 2 | `MIETE` | Mietvertrag |
| 3 | `LEASING` | Leasingvertrag |
| 4 | `LEASING` | Leasingvertrag |
| 5 | `MIETE` | Mietvertrag |

Jeder andere Wert → `E401`.

### 5.2 Schalter

```
show.color        = volumen.color > 0  ODER  preis.color > 0
show.sw           = volumen.sw    > 0  ODER  preis.sw    > 0
show.scan         = volumen.scan  > 0  ODER  preis.scan  > 0
show.fleet        = fleet.level nicht leer
show.solutions    = SOL!E39 > 0  ODER  SOL!E57 > 0  ODER  SOL!H71 > 0
show.dienstleistung = summe(dienstleistung[].betrag) > 0
show.altvertrag   = restwert_altvertrag > 0
show.sla          = sla.type nicht leer
```

**Änderung gegenüber V2:** `show.color` prüft zusätzlich den Klickpreis. In der Referenzdatei ist
`volumen.color = 0`, `preis.color = 0.032` – ein Farbsystem mit Abrechnung ab der ersten Seite.
Die V2-Regel `volumen.color > 0` hätte den Farbklickpreis unterschlagen. Dasselbe gilt für SW.

### 5.3 Rechenwerte

```
ab_seite.sw     = volumen.sw    + 1
ab_seite.color  = volumen.color + 1
ab_seite.scan   = volumen.scan  + 1
gueltig_bis     = datum + 60 Tage
gesamttotal.einmalig  = summe über alle Standorte von summe(dienstleistung[].betrag)
gesamttotal.monatlich = summe über alle Standorte von monatspauschale_total
gesamttotal.kauf      = summe über alle Standorte von vertragswert
```

### 5.4 Summenregel (Doppelzählungssperre)

Kapitel 1.2 zeigt Servicebestandteile **ohne Summenzeile**. Kapitel 1.4 zeigt:

| Variante | Zeilen in `TBL.TOTAL` |
|---|---|
| `KAUF` | `Total Kauf` → `vertragswert` (C62) |
| `MIETE` / `LEASING` | Zeile 1 `summenlabel` + „ bei einer Laufzeit von {laufzeit} Monaten" → `pauschale_ohne_service` (L92)<br>Zeile 2 `Monatspauschale total inkl. Service` → `monatspauschale_total` (L95) |

Verbot, im Generator als Assertion: `L95` und die Servicebeträge aus Kapitel 1.2 dürfen nie in
derselben Summe stehen. Es gilt `L95 = L92 + L93 + L94`; Abweichung > 0.01 → `E402`.

### 5.5 Hardwarepreise

```
show.hardware_preise = (variante == KAUF) UND kalktool.hat_spalten(ArtNr, Anzahl, Nettopreis)
```

Das Kalktool Q4 2025 hat diese Spalten nicht (`A27:E52` = Bezeichnung, Listenpreis,
Kalkulationsart, CIF). Bis zur Erweiterung ist `show.hardware_preise` immer falsch:
`TBL.HARDWARE` zeigt Bezeichnung und Stückzahl, das Total steht in Kapitel 1.4.

`stueck` ist bis dahin fix `1` – belegbar über `KM!C53 = summe(C27:C52)` bei Menge 1 je Zeile.
Weicht `C53` von dieser Summe ab → `W307`, Spalte „Stück" wird leer gerendert statt geraten.
Spalte „Artikel No." zeigt `–`.

---

## 6. Parser

Reguläre Ausdrücke, Python-Syntax. Trifft kein Muster, greift der Fallback und es entsteht eine
Warnung – nie eine stille Zuweisung.

### 6.1 `parse_plz_ort` (G5, G7)

```
^\s*(?P<plz>\d{4})\s+(?P<ort>.+?)\s*$
```
Fallback: `plz` leer, `ort` = ganzer String, Warnung `W301`.

### 6.2 `parse_kontakt` (J5)

Der Freitext enthält Name, Mail und Telefon in beliebiger Reihenfolge, durch ≥2 Leerzeichen getrennt.

```
1  email    = erster Treffer von  [\w.+-]+@[\w-]+\.[\w.]+
2  telefon  = erster Treffer von  (?:\+41|0)[\s\d]{8,}        (Fundstelle aus 1 vorher entfernen)
3  rest     = Reststring, mehrfache Leerzeichen zu einem zusammengezogen, getrimmt
4  vorname  = rest bis zum ersten Leerzeichen
   nachname = Rest danach
```
Kein Treffer bei 1 oder 2 → Warnung `W302`. Enthält `rest` mehr als zwei Wörter → `W303`,
`vorname` = erstes Wort, `nachname` = alle weiteren.

Beispiel Referenzdatei:
`"Tom Wiedmer   tom.wiedmer@birsfelden.ch    061 317 33 48"`
→ `vorname="Tom"`, `nachname="Wiedmer"`, `email="tom.wiedmer@birsfelden.ch"`, `telefon="061 317 33 48"`.

### 6.3 `parse_vertragsbeginn` (A100)

```
(?P<d>\d{1,2})[.\-/](?P<m>\d{1,2})[.\-/](?P<y>\d{2,4})
```
Kein Treffer → `vertragsbeginn = null`, Warnung `W304`, im Vertragstext greift die Variante
„zum vereinbarten Zeitpunkt" (Abschnitt 8.3).
Beispiel: `"Vertragsbeginn 01.08.2026"` → `2026-08-01`.

### 6.4 Datumsfeld M9

Enthält die Zelle `=TODAY()`, ist der gelesene Wert das Öffnungsdatum, nicht das Offertdatum.
Der Generator liest den **zwischengespeicherten** Wert (`data_only=True`) und setzt `W308`.
Der Wert wird als Text ins Dokument geschrieben, nie als Feld (Abschnitt 12.2).

---

## 7. Formatter

Verbindlich, inklusive Trennzeichen. Tausendertrenner ist das typografische Apostroph U+2019 (`’`).

| Name | Regel | Beispiel |
|---|---|---|
| `trim` | Leerraum aussen entfernen, innere Mehrfachleerzeichen auf eines reduzieren | `" Museum "` → `Museum` |
| `chf` | `CHF ` + Betrag, 2 Nachkommastellen, Tausendertrenner | `2024.7475` → `CHF 2’024.75` |
| `rate` | `CHF ` + Betrag, 4 Nachkommastellen, kein Tausendertrenner | `0.032` → `CHF 0.0320` |
| `int_ch` | Ganzzahl, Tausendertrenner | `1500` → `1’500` |
| `monate` | Ganzzahl + `" Monate"` | `60` → `60 Monate` |
| `date_de` | `TT.MM.JJJJ` | `2026-07-28` → `28.07.2026` |
| `label_clean` | siehe 7.7 | `"I n t e g r a t i o n - Netzwerk"` → `Integration Netzwerk` |

Rundung: kaufmännisch (half-up) auf die Zielstellenzahl, **erst bei der Ausgabe**. Zwischensummen
rechnen mit dem vollen Wert. `2024.7475` wird zu `CHF 2’024.75`, nicht zu `2024.74`.

Alle Beträge sind netto, exklusive MWST und vRB. Der Hinweis steht einmal im Einleitungstext
Kapitel 1.1 und wird nirgends wiederholt.

### 7.7 `label_clean`

```
1  Zeichenfolgen aus Einzelbuchstaben mit Leerzeichen zusammenziehen:
   Treffer auf  \b(?:\w\s){2,}\w\b  →  Leerzeichen entfernen
2  " - " → " "
3  Mehrfachleerzeichen → ein Leerzeichen, trimmen
4  Erstes Zeichen gross
```
`"Wegpauschale - I n t e g r a t i o n - Netzwerk - Fax - Scan - LDAP"`
→ `"Wegpauschale Integration Netzwerk Fax Scan LDAP"`.
Für die Referenzdatei ist zusätzlich `label_override` in der YAML gesetzt, weil die Rohlabels dort
mehrere Leistungen in einer Zeile bündeln – Overrides sind Daten, nicht Code.

---

## 8. Textbausteine

Bausteine sind Templates mit `{feld}`-Platzhaltern. Erlaubt sind ausschliesslich Felder aus
Abschnitt 4 und 5. Keine Bedingungen im Text – Varianten sind eigene Bausteine.

### 8.1 Standortüberschrift (geändert gegenüber V2)

```
HEAD.STANDORT          = "Standort {standort.index}: {standort.name}"
HEAD.SERVICE_STANDORT  = "Standort {standort.index}: {standort.name}"
HEAD.DL                = "Im Angebot enthaltene Schulungen und Dienstleistungen – Standort {standort.index}: {standort.name}"
LINE.STANDORT_ADRESSE  = "Installationsadresse: {standort.strasse}, {standort.plz} {standort.ort}"
```

**Regel:** Die Installationsadresse steht **genau einmal** je Standort, als Zeile im Style `05Klein`
direkt unter `HEAD.STANDORT` in Kapitel 1.1. Sie erscheint nicht in weiteren Überschriften und
nicht im Inhaltsverzeichnis. Grund: Bei n Standorten wird das Verzeichnis sonst unlesbar, und
Überschriften mit Komma und Hausnummer brechen im TOC über mehrere Zeilen um.

Ist `standort.name` leer → `HEAD.STANDORT = "Standort {standort.index}"`, Warnung `W309`.

### 8.2 Servicetabelle

Zeilen werden in dieser Reihenfolge erzeugt, jede nur wenn ihr Schalter wahr ist:

| # | Schalter | Beschreibung (Spalte 1) | Betrag (Spalte 2) |
|---|---|---|---|
| 1 | immer | `Servicevertrag pro Monat und pro Gerät für {geraet}` | `service.geraet` |
| 1a | `show.sla` | `Service Level Agreement: {sla.type_kurz}` | `sla.preis` falls > 0, sonst leer |
| 1b | immer | `Mit {volumen.color} Seiten in Farbe und {volumen.sw} Seiten schwarzweiss inkludiert` | leer |
| 2 | `show.color` | `Zusätzliche Seiten ab der {ab_seite.color}. Seite in Farbe` | `preis.color` |
| 3 | `show.sw` | `Zusätzliche Seiten ab der {ab_seite.sw}. Seite schwarzweiss` | `preis.sw` |
| 4 | `show.scan` | `Zusätzliche Scans ab dem {ab_seite.scan}. Scan` | `preis.scan` |
| 5 | `show.fleet` | `Zählerstanderfassung und Fleet Management: {fleet.level}` | `fleet.preis` |
| 5a | `zaehlerversand` gesetzt | `Zählerstandsmeldung: {zaehlerversand}` | leer |

`sla.type_kurz` = `sla.type` bis vor `" - CHF"` (die Zelle enthält Label und Preis gemischt:
`"Premium - CHF 50.00"` → `"Premium"`). Ist `sla.preis` = 0, wird kein Betrag ausgegeben – der
SLA ist in `service.geraet` enthalten und würde sonst doppelt wirken.

Zeilen 1–1b liegen in einer Tabellenzelle (mehrere Absätze), ebenso 2–3 und 5–5a. Das entspricht
dem Aufbau von `graphax1000` in der Vorlage.

### 8.3 Vertragstext (`SW.VERTRAGSTEXT`)

Variante `KAUF`, Überschrift `Laufzeit und Kündigungsfrist für Serviceverträge beim Kauf`:

> Der Start und die Laufzeit des Servicevertrags werden gemäss einer separaten Vereinbarung
> festgelegt. Nach Ablauf der vereinbarten Laufzeit verlängert sich der Servicevertrag automatisch
> um jeweils ein Jahr. Eine Kündigung des Servicevertrags ist möglich, indem er mit einer
> Kündigungsfrist von drei Monaten zum Ende der Laufzeit gekündigt wird.

Variante `MIETE` / `LEASING`, Überschrift
`Laufzeit und Kündigungsfrist {vertragsart_wort} und Servicevertrag`:

> Der {vertragsart_wort} tritt {beginn_phrase} in Kraft und läuft für eine bestimmte Laufzeit von
> {laufzeit} Monaten. Die Laufzeit des Servicevertrags ist an diese Laufzeit gekoppelt und endet
> gleichzeitig. Nach Ablauf verlängern sich beide Verträge automatisch um jeweils ein weiteres Jahr.
> Eine Beendigung ist möglich, indem sie jeweils zum Ende der Laufzeit unter Einhaltung einer
> Kündigungsfrist von drei Monaten gekündigt werden.

```
beginn_phrase = "am {vertragsbeginn|date_de}"   falls vertragsbeginn gesetzt
              = "zum vereinbarten Zeitpunkt"    sonst
```

### 8.4 Konditionen (`TBL.KONDITIONEN`)

Zeile „Abrechnungsintervall", drei Absätze:

```
Servicepauschalen: {fakt.pauschale}, im Voraus.
Mehrseitenpreise: {fakt.mehrseiten}, rückwirkend.
Gebühren: {fakt.gebuehren}.                        (nur wenn gesetzt)
```

Zeile „Rechnungsstellung":

```
Die einmaligen Kosten werden nach der Installation in Rechnung gestellt.
Die {pauschale_wort} werden {fakt.pauschale|klein} im Voraus verrechnet.
Die Seitenpreise für Schwarzweiss- und Farbdruck werden {fakt.mehrseiten|klein} rückwirkend in Rechnung gestellt.
```
`pauschale_wort` = `"Miet- und Servicepauschalen"` bei MIETE, `"Leasing- und Servicepauschalen"`
bei LEASING, `"Servicepauschalen"` bei KAUF. `|klein` = erster Buchstabe klein.

Alle übrigen Zeilen der Tabelle sind statisch und werden nicht angefasst.

### 8.5 Nachweiszeile

```
LINE.NACHWEIS = "Kalkulationsgrundlage: Kalktool {kalktool.version} · Verkaufschance {verkaufschance} · Anlieferungsart: {anlieferungsart}"
```
Fehlt ein Teil, entfällt das jeweilige Segment samt Trennzeichen.

---

## 9. Dokumentaufbau

```
Deckblatt          OFF.KUNDE, OFF.ANBIETER, OFF.KONTAKT, OFF.KLASSIFIZIERUNG,
                   OFF.NUMMER, OFF.VERSION, OFF.DATUM, OFF.GUELTIG_BIS
Inhaltsverzeichnis (Abschnitt 12.1)
1    Preise
1.1  Geräte oder Software          Einleitungstext (statisch)
       je Standort: SEC.STANDORT
         HEAD.STANDORT
         LINE.STANDORT_ADRESSE
         TBL.HARDWARE
         HEAD.DL + TBL.DIENSTLEISTUNG        nur wenn show.dienstleistung
1.2  Servicepreise und laufende Kosten
       je Standort: SEC.SERVICE
         HEAD.SERVICE_STANDORT
         TBL.SERVICE
1.3  Total                          TBL.TOTAL je Standort,
                                    TBL.GESAMTTOTAL nur wenn Standortanzahl > 1
1.4  HEAD.VERTRAGSTEXT + SW.VERTRAGSTEXT
2    Konditionen                    TBL.KONDITIONEN, danach statisch
3    Verbindlichkeit                OFF.ORT_DATUM
4    Beilagen                       statisch, danach LINE.NACHWEIS
```

Bei einem Standort entfällt `TBL.GESAMTTOTAL` ersatzlos – kein leerer Abschnitt, keine Überschrift.

---

## 10. Tabellenregeln

1. Jede Tabelle in der Vorlage hat genau eine **Kopfzeile** und genau eine **Musterzeile**.
   Der Generator klont die Musterzeile je Datensatz und entfernt die Musterzeile danach.
   Er baut nie eine Tabelle neu auf – dabei gingen Spaltenbreiten (`tblGrid`) und
   Rahmendefinitionen verloren.
2. Zellinhalte werden absatzweise gesetzt. Überzählige Absätze werden gelöscht, fehlende durch
   Klonen des letzten Absatzes ergänzt. Die Zeichenformatierung des ersten Runs bleibt erhalten.
3. Inhaltssteuerelemente **innerhalb** von Zellen werden vor dem Setzen aufgelöst (`w:sdt` durch
   seinen `w:sdtContent` ersetzen). Andernfalls überleben Reste der Vorlage sichtbar im Text –
   in der Referenzvorlage stecken unter anderem `"bizhub C257i"` und `"CHF 5.00"` in solchen
   Elementen.
4. `tblLook` steuert die bedingte Formatierung. Die Vorlage liefert `04E0`
   (firstRow + lastRow + firstColumn + noVBand). Für Listentabellen ohne Summenzeile –
   `TBL.HARDWARE` – ist `lastRow` zu löschen (`04A0`), sonst wird die letzte Position fett
   dargestellt und liest sich wie ein Total.
5. Tabellen mit Summenzeile (`TBL.DIENSTLEISTUNG`, `TBL.TOTAL`) behalten `04E0`; die letzte
   erzeugte Zeile ist die Summe.
6. Leerzeilen aus den Quellbereichen werden vor dem Rendern verworfen (Filter Abschnitt 4.5),
   nicht als leere Tabellenzeile ausgegeben.

---

## 11. Mehrere Standorte

```
für i, datei in enumerate(kalktools, start=1):
    ctx = extract(datei)
    ctx.standort.index = i
    klone SEC.STANDORT  → fülle mit ctx
    klone SEC.SERVICE   → fülle mit ctx
    klone TBL.TOTAL     → fülle mit ctx
```

Regeln über Standorte hinweg:

| Prüfung | Verhalten |
|---|---|
| `finanzierungsart` unterschiedlich | `E403` – gemischte Varianten in einer Offerte sind nicht spezifiziert |
| `laufzeit` unterschiedlich | `W310`, Vertragstext nennt dann die längste Laufzeit |
| `kunde.firma` unterschiedlich | `E404` |
| `kalktool.version` unterschiedlich | `W311`, alle Versionen in `LINE.NACHWEIS` |
| Standortanzahl > 1 | `TBL.GESAMTTOTAL` mit `gesamttotal.*` |

Kopfdaten (Kunde, Verkäufer, Datum, Offertnummer) stammen **immer** aus dem ersten Kalktool.

---

## 12. Nachbearbeitung

### 12.1 Inhaltsverzeichnis

Nach dem Rendern stimmen weder Einträge noch Seitenzahlen des zwischengespeicherten TOC.
Deterministisches Verfahren:

```
1  Alle Überschriften (Heading1–3) in Dokumentreihenfolge einsammeln.
2  Nummern vergeben: H1 → "n.0", H2 → "n.m", H3 → "n.m.k".
3  Alle bestehenden _Toc-Bookmarks entfernen, je Überschrift ein neues setzen.
4  Dokument nach PDF rendern, Seitenzahl je Überschrift aus dem PDF-Text lesen.
   Die TOC-Seite selbst wird bei der Suche übersprungen.
5  TOC-Einträge aus den Vorlagen-Absätzen TOC1/TOC2/TOC3 klonen; je Eintrag
   Anker, Titel, Nummer und PAGEREF-Feld setzen.
6  w:updateFields = true setzen, damit Word beim Öffnen nachrechnet.
```

Schritt 4 kostet einen zusätzlichen Rendervorgang, ist aber die einzige Methode, die ohne
Word-Automatisierung korrekte Seitenzahlen liefert.

### 12.2 Felder einfrieren

Die Vorlage enthält `TIME`-Felder im Fliesstext (Deckblatt-Datum, „Spreitenbach, …"). Diese würden
beim Öffnen auf das Tagesdatum springen und das Offertdatum überschreiben. Regel: Feld-Runs
(`fldChar` begin/separate/end samt `instrText`) löschen, durch einen statischen Run mit
`datum|date_de` ersetzen. Das `TIME`-Feld in der **Fusszeile** bleibt – es ist das Druckdatum.

---

## 13. Validierung

### 13.1 Abbruch

| Code | Bedingung |
|---|---|
| `E101` | Anker aus Abschnitt 3.2 fehlt in der Vorlage |
| `E102` | Unbekannter Anker in der Vorlage |
| `E201` | Kalktool nicht lesbar oder Blattanzahl < 2 |
| `E202` | Kalktool-Version unbekannt und Layout passt zu keinem Mapping |
| `E211` | Zelle aus dem Feldkatalog ausserhalb des Blattbereichs |
| `E212` | Pflichtfeld im Kalktool ist leer |
| `E401` | `finanzierungsart` leer oder nicht in 1–5 |
| `E402` | `L95 ≠ L92 + L93 + L94` (Toleranz 0.01) |
| `E403` | Gemischte Finanzierungsarten über mehrere Standorte |
| `E404` | Unterschiedliche Kunden über mehrere Standorte |
| `E411` | `laufzeit` leer oder ≤ 0 bei MIETE/LEASING |
| `E412` | Kein Hardwareartikel mit Bezeichnung |
| `E413` | MIETE/LEASING und `L92` = 0 |
| `E414` | KAUF und `C62` = 0 |
| `E601` | Wert aus der Sperrliste im gerenderten Dokument |
| `E602` | Unaufgelöster Platzhalter `{…}` oder `%%…%%` im gerenderten Dokument |

### 13.2 Sperrliste

Diese Bereiche werden nie gelesen und ihre Werte nie ausgegeben. Die Liste ist im Generator hart
hinterlegt, nicht als Konvention.

```
KM!D27:E52     Kalkulationsart, CIF
KM!C53, E53    Total Listenpreis, Total CIF
KM!B54:E58     Marge effektiv, Marge alt, Marge in %
KM!C57         Total CIF
KM!B63:B67     Marge von unten, Rabattsätze
KM!E21         Rabattsatz
KM!H83:M90     Finanzierungsfaktoren, Amortisation, Zinsen
KM!J72:M78     Provisionsrelevante Umsätze, Marge totale
KM!G32, G39    Rabattsätze Solutions
SOL!F, SOL!G   Kalkulationsart, CIF
```

Ausnahme: `KM!C53` darf zur Plausibilisierung der Stückzahl gelesen (Abschnitt 5.5), aber nicht
ausgegeben werden.

Prüfung in Schritt 9: Der Textinhalt des fertigen Dokuments wird gegen die formatierten Werte
aller gesperrten Zellen gehalten. Treffer → `E601`, Datei wird verworfen.

### 13.3 Warnungen

| Code | Bedingung |
|---|---|
| `W301` | PLZ/Ort nicht trennbar |
| `W302` | Mail oder Telefon in `J5` nicht gefunden |
| `W303` | Name in `J5` mehrdeutig |
| `W304` | Vertragsbeginn in `A100` nicht parsbar |
| `W305` | Offertnummer aus CRM fehlt, Verkaufschance eingesetzt |
| `W306` | Offertversion fehlt, `1.0` eingesetzt |
| `W307` | `C53` ≠ Summe der Listenpreise, Stückzahl nicht belegbar |
| `W308` | `M9` liefert `TODAY()` statt eines eingefrorenen Datums |
| `W309` | `standort.name` leer |
| `W310` | Unterschiedliche Laufzeiten über mehrere Standorte |
| `W311` | Unterschiedliche Kalktool-Versionen |
| `W312` | `#DIV/0!` in `H32` oder `H39` (rein intern, ohne Wirkung auf die Offerte) |
| `W313` | Kalktool-Version unbekannt; Layout stimmt mit einem bekannten Mapping überein |
| `W314` | Beschriftung im Kalktool weicht vom erwarteten Layout ab |
| `W315` | Installationsadresse fehlt, Zeile entfällt |
| `W316` | Weder Offertnummer noch Verkaufschance vorhanden, Strich eingesetzt |
| `W317` | Standortname verweist auf den Kunden, Kundenname eingesetzt |

Warnungen erscheinen im Log **und** in einer Begleitdatei `<offerte>.pruefprotokoll.md`, nie im
Dokument selbst.

---

## 14. Golden Record – Referenzfall Birsfelden

Testfall `Kalktool_Birsfelden_C3351i.xlsx`. Weicht ein Wert ab, ist der Generator defekt.

| Grösse | Erwartet |
|---|---|
| `variante` | `MIETE` (I16 = 2) |
| `laufzeit` | `60 Monate` |
| `kunde.firma` | `Gemeindeverwaltung Birsfelden` |
| `kunde.plz` / `ort` | `4127` / `Birsfelden` |
| `kontakt` | `Tom Wiedmer`, `tom.wiedmer@birsfelden.ch`, `061 317 33 48` |
| `standort.index` / `name` | `1` / `Museum` |
| `LINE.STANDORT_ADRESSE` | `Installationsadresse: Schulstrasse 29 1.OG, 4127 Birsfelden` |
| `HEAD.STANDORT` | `Standort 1: Museum` |
| `datum` / `gueltig_bis` | `28.07.2026` / `26.09.2026` |
| `hardware` | `bizhub C3351i`, `PF-P27`, `DK-P04` – je Stück 1, ohne Preise |
| `show.color` / `show.sw` | wahr / wahr |
| `preis.color` / `preis.sw` | `CHF 0.0320` / `CHF 0.0050` |
| `service.geraet` | `CHF 3.50` |
| `sla.type_kurz` / `sla.preis` | `Premium` / 0 → ohne Betrag |
| `dienstleistung` | `120.00` (Wegpauschale) und `180.00` (Integration Netzwerk), Total `CHF 300.00` |
| nicht enthalten | `200.00` Transport und `115.00` Bereitstellung (Spalte B, finanziert) |
| `TBL.TOTAL` Zeile 1 | `Mietpauschale pro Monat (ohne Service) bei einer Laufzeit von 60 Monaten` → `CHF 43.50` |
| `TBL.TOTAL` Zeile 2 | `Monatspauschale total inkl. Service` → `CHF 47.00` |
| `vertragsbeginn` | `01.08.2026` |
| `fakt.pauschale` / `fakt.mehrseiten` | `Quartalsweise` / `Halbjährlich` |
| Warnungen | `W305`, `W306`, `W308`, `W312` |
| Sperrliste | keine Treffer; insbesondere `2’645`, `1’587`, `23.45`, `2’024.75`, `2’339.75` fehlen |

---

## 15. `mapping.yaml`

Vollständig für Q4 2025. Der Generator enthält keine einzige Zelladresse.

```yaml
version: "Q4 2025"
version_cell: "KM!C1"
sheets:
  KM: {index: 0, expect_name: "KM - Système couleur "}
  SOL: {index: 1, expect_name: "Détail Solutions"}

fields:
  kunde.firma:        {cell: "KM!B5",  type: TXT,  fmt: trim,             req: M}
  kunde.strasse:      {cell: "KM!D5",  type: TXT,  fmt: trim,             req: M}
  kunde.plz_ort_roh:  {cell: "KM!G5",  type: TXT,  fmt: parse_plz_ort,    req: M}
  kunde.nr:           {cell: "KM!J3",  type: TXT,  fmt: trim,             req: O}
  kunde.kontakt_roh:  {cell: "KM!J5",  type: TXT,  fmt: parse_kontakt,    req: W}
  standort.name:      {cell: "KM!B7",  type: TXT,  fmt: trim,             req: M}
  standort.strasse:   {cell: "KM!D7",  type: TXT,  fmt: trim,             req: M}
  standort.plz_ort_roh: {cell: "KM!G7", type: TXT, fmt: parse_plz_ort,    req: M}
  vk.name:            {cell: "KM!B3",  type: TXT,  fmt: trim,             req: M}
  vk.nr:              {cell: "KM!E3",  type: TXT,  fmt: trim,             req: O}
  verkaufschance:     {cell: "KM!M8",  type: TXT,  fmt: trim,             req: M}
  datum:              {cell: "KM!M9",  type: DATE, fmt: date_de,          req: M}
  kalktool.version:   {cell: "KM!C1",  type: TXT,  fmt: trim,             req: M}
  finanzierungsart:   {cell: "KM!I16", type: ENUM, values: [1,2,3,4,5],   req: M}
  laufzeit:           {cell: "KM!J16", type: INT,  fmt: monate,           req: M}
  fakt.pauschale:     {cell: "KM!M15", type: TXT,  fmt: trim,             req: M}
  fakt.mehrseiten:    {cell: "KM!M16", type: TXT,  fmt: trim,             req: M}
  fakt.gebuehren:     {cell: "KM!L98", type: TXT,  fmt: trim,             req: O}
  vertragsbeginn_roh: {cell: "KM!A100",type: TXT,  fmt: parse_vertragsbeginn, req: W}
  anlieferungsart:    {cell: "KM!C96", type: TXT,  fmt: trim,             req: O}
  sla.type:           {cell: "KM!J58", type: TXT,  fmt: trim,             req: O}
  sla.preis:          {cell: "KM!M58", type: CUR,  fmt: chf,              req: O}
  grundpauschale:     {cell: "KM!M59", type: CUR,  fmt: chf,              req: O}
  volumen.sw:         {cell: "KM!H56", type: INT,  fmt: int_ch,           req: M}
  preis.sw:           {cell: "KM!H59", type: RATE, fmt: rate,             req: M}
  volumen.color:      {cell: "KM!H61", type: INT,  fmt: int_ch,           req: M}
  preis.color:        {cell: "KM!H64", type: RATE, fmt: rate,             req: M}
  volumen.scan:       {cell: "KM!H66", type: INT,  fmt: int_ch,           req: O}
  preis.scan:         {cell: "KM!H69", type: RATE, fmt: rate,             req: O}
  fleet.level:        {cell: "KM!J64", type: TXT,  fmt: trim,             req: O}
  fleet.preis:        {cell: "KM!M64", type: CUR,  fmt: chf,              req: O}
  zaehlerversand:     {cell: "KM!C10", type: TXT,  fmt: trim,             req: O}
  service.solution:   {cell: "KM!L93", type: CUR,  fmt: chf,              req: O}
  service.geraet:     {cell: "KM!L94", type: CUR,  fmt: chf,              req: M}
  pauschale_ohne_service: {cell: "KM!L92", type: CUR, fmt: chf, req: M, only: [MIETE, LEASING]}
  monatspauschale_total:  {cell: "KM!L95", type: CUR, fmt: chf, req: M, only: [MIETE, LEASING]}
  summenlabel:        {cell: "KM!H92", type: TXT,  fmt: trim, req: M, only: [MIETE, LEASING]}
  netto_verkaufspreis:{cell: "KM!C59", type: CUR,  fmt: chf, req: M, only: [KAUF]}
  restwert_altvertrag:{cell: "KM!C60", type: CUR,  fmt: chf, req: O}
  dl_eingerechnet:    {cell: "KM!C61", type: CUR,  fmt: chf, req: O}
  vertragswert:       {cell: "KM!C62", type: CUR,  fmt: chf, req: M, only: [KAUF]}

lists:
  hardware:
    range: "KM!A27:E52"
    cols:  {bezeichnung: A, listenpreis: C}
    skip_if: ["bezeichnung leer", "bezeichnung == 'Support :'"]
    stueck_fix: 1
    stueck_check: "KM!C53 == sum(KM!C27:C52)"
  dienstleistung:
    range: "KM!A72:D93"
    layout: paired          # Zeile n = Label, Zeile n+1 = Werte
    cols:  {verrechnet: A, finanziert: B, total: C, amortisation: D}
    use_col: verrechnet
    skip_if: ["verrechnet <= 0"]
    label_fmt: label_clean
    label_override:
      "Wegpauschale - I n t e g r a t i o n - Netzwerk - Fax - Scan - LDAP":
        "Wegpauschale – Integration Netzwerk / Fax / Scan / LDAP"
      "I n t e g r a t i o n - Netzwerk": "Integration Netzwerk"
      "I n t e g r a t i o n - Fax": "Integration Fax"
      "LDAP - C O N F I G U R A T I O N": "LDAP-Konfiguration"
      "T r a n s p o r t": "Transport"
  solutions.sw:
    range: "SOL!A21:H38"
    cols: {anzahl: A, artnr: B, bezeichnung: C, netto: H}
    skip_if: ["bezeichnung leer", "netto <= 0"]
  solutions.maint:
    range: "SOL!A43:H56"
    cols: {anzahl: A, artnr: B, bezeichnung: C, netto: H}
    skip_if: ["bezeichnung leer", "netto <= 0"]
  solutions.dl:
    range: "SOL!A61:H71"
    cols: {stunden: A, artnr: B, bezeichnung: C, preis_std: G, total: H}
    skip_if: ["bezeichnung leer", "total <= 0"]

blocked:
  - "KM!D27:E52"
  - "KM!C53"
  - "KM!E53"
  - "KM!B54:E58"
  - "KM!C57"
  - "KM!B63:B67"
  - "KM!E21"
  - "KM!H83:M90"
  - "KM!J72:M78"
  - "KM!G32"
  - "KM!G39"
  - "SOL!F:F"
  - "SOL!G:G"

styles:
  heading_standort: Heading3
  adresszeile:      "05Klein"
  nachweis:         "05Klein"
  tabelle_liste:    graphax11
  tabelle_summe:    graphax100
  tabelle_service:  graphax1000
  tabelle_konditionen: graphax20
  tbllook_liste:    "04A0"
  tbllook_summe:    "04E0"
```

---

## 16. Offene Punkte im Kalktool

Diese Punkte begrenzen, was der Generator ausgeben kann. Ohne sie bleibt die Offerte korrekt,
aber weniger detailliert.

| # | Fehlt | Auswirkung heute | Lösung |
|---|---|---|---|
| 1 | Artikelnummer, Menge, Netto-Zeilenpreis in `A27:E52` | Hardwaretabelle ohne Art.-Nr., Stück fix 1, keine Zeilenpreise | drei Spalten ergänzen, analog Blatt `Détail Solutions`: `Netto = Listenpreis × (1 − E21)` |
| 2 | Offertnummer, Offertversion | `W305`/`W306`, Verkaufschance als Ersatz | zwei Eingabezellen, oder verbindlich aus dem CRM |
| 3 | Gültig bis | rechnerisch `datum + 60 Tage` | eigene Zelle mit `=M9+60` |
| 4 | Kontaktdaten Verkäufer (Funktion, Mail, Direktwahl) | Zeilen entfallen | aus dem CRM |
| 5 | Kundenkontakt als Freitext `J5` | Parser, `W302`/`W303` möglich | drei Eingabezellen |
| 6 | PLZ und Ort kombiniert (`G5`, `G7`) | Parser, `W301` möglich | je zwei Zellen |
| 7 | Vertragsbeginn als Freitext `A100` | Parser, `W304` möglich | Datumszelle |
| 8 | Anrede | entfällt | aus dem CRM |
| 9 | `M9` = `=TODAY()` | `W308`, Datum beim Export eingefroren | Eingabezelle statt Formel |

**Reihenfolge:** 9 und 3 sind je eine Zelle und beheben zwei Warnungen sofort. 6 und 7 entfernen
zwei Parser. 1 ist die einzige Änderung, die den Inhalt der Offerte sichtbar erweitert.

---

## 17. Änderungen gegenüber V2

| Thema | V2 | V3 |
|---|---|---|
| Befüllung | `%%TOKEN%%` im Fliesstext, Interpretation | benannte Anker, `mapping.yaml` |
| Standortüberschrift | Name, Strasse, PLZ, Ort in der Überschrift | `Standort {i}: {name}`, Adresse als eigene Zeile darunter |
| Color-Schalter | `volumen.color > 0` | `volumen.color > 0 ODER preis.color > 0` |
| SLA | eigene Zeile mit Preis | Zeile ohne Betrag, wenn `M58` = 0 (sonst doppelt) |
| Stückzahl Hardware | nicht spezifiziert | fix 1, geprüft gegen `C53` |
| Fehlerverhalten | Warnung im Log | Fehlercodes, Abbruch ohne Teildatei |
| Inhaltsverzeichnis | nicht behandelt | Neuaufbau mit Seitenzahlen aus dem PDF |
| Datumsfelder | nicht behandelt | `TIME`-Felder im Text eingefroren, Fusszeile bleibt |
| Inhaltssteuerelemente | nicht behandelt | vor dem Setzen auflösen, sonst Textreste der Vorlage |
| `tblLook` | nicht behandelt | `lastRow` bei Listentabellen aus |
| Prüfung | Sichtprüfung | Golden Record Birsfelden |
