# Offerttool V3 – Offerte aus dem Kalktool, ohne KI

Erzeugt aus einem oder mehreren Kalktools (`.xlsx`) und einer Word-Vorlage eine
fertige Offerte (`.docx`) – regelbasiert und deterministisch.

**Grundsatz:** Der Generator trifft keine Entscheidungen. Jede Ausgabe ist Funktion von
(Vorlage, Kalktool-Zellen, CRM-Datensatz, Spezifikation). Gleiche Eingabe → gleiche Ausgabe.
Kein Sprachmodell ist an der Befüllung beteiligt.

Die verbindliche Spezifikation liegt unter [`docs/Offerttool_V3_Spezifikation.md`](docs/Offerttool_V3_Spezifikation.md);
alle Abschnittsverweise im Code und in dieser Datei beziehen sich darauf.

---

## Schnellstart

```bash
pip install -e .

# Offerte erzeugen
offerttool generate examples/Kalktool_Birsfelden_C3351i.xlsx \
    -o Offerte_Birsfelden.docx \
    -c examples/crm_birsfelden.json
```

Ergebnis:

```
Offerte:       Offerte_Birsfelden.docx
Prüfprotokoll: Offerte_Birsfelden.docx.pruefprotokoll.md
Warnungen (2):
  W308 [Standort 1]: M9 liefert TODAY() statt eines eingefrorenen Datums – KM!M9 enthält =TODAY()
  W312 [Standort 1]: #DIV/0! in H32 oder H39 (rein intern, ohne Wirkung auf die Offerte)
```

Mehrere Standorte – **die Reihenfolge der Dateien ist die Reihenfolge im Dokument**
(Abschnitt 2.2), ein Kalktool = ein Standort = ein Gerät:

```bash
offerttool generate standort_a.xlsx standort_b.xlsx -o Offerte.docx -c crm.json
```

---

## Web-Oberfläche im Firmennetz

Für den Betrieb auf einem internen Server, damit alle Verkäufer die App über
eine URL erreichen. Die Oberfläche ist eine dünne Hülle um dieselbe Pipeline –
sie trifft keine eigenen Entscheidungen über den Inhalt der Offerte.

### Mit Docker (empfohlen)

LibreOffice muss auf dem Server liegen, sonst fehlen die Seitenzahlen im
Inhaltsverzeichnis. Das Image bringt es mit:

```bash
docker compose up -d          # erreichbar auf http://<server>:8080
```

`compose.yaml` legt `/tmp` als `tmpfs` an: hochgeladene Kalktools und fertige
Offerten liegen im Arbeitsspeicher und überleben keinen Neustart.

### Ohne Docker

```bash
apt-get install libreoffice-writer-nogui poppler-utils
pip install ".[web]"
offerttool serve --host 0.0.0.0 --port 8080
```

Ohne `--host` hört der Server nur auf `127.0.0.1` und ist im Netz nicht
erreichbar. Ein systemd-Beispiel liegt unter `deploy/offerttool.service`.

### Bedienung

Kalktools hineinziehen, bei mehreren Standorten die Reihenfolge mit den Pfeilen
setzen — **die Reihenfolge ist die Reihenfolge der Standorte im Dokument**. Die
CRM-Felder sind freiwillig. „Werte prüfen" zeigt, was gelesen wird, ohne ein
Dokument zu erzeugen; „Offerte erzeugen" liefert Offerte und Prüfprotokoll zum
Download.

Bricht der Generator ab, erscheint der Fehlercode im Klartext und es entsteht
keine Datei.

### Was auf dem Server liegenbleibt

Nichts Dauerhaftes. Kalktools enthalten Marge, CIF und Kundendaten — genau das,
was die Sperrliste nie ins Dokument lässt. Deshalb:

- Jeder Auftrag lebt in einem eigenen temporären Verzeichnis.
- Die hochgeladenen Kalktools werden **direkt nach der Generierung** gelöscht.
- Das Ergebnis bleibt 30 Minuten abholbar und wird dann gelöscht; über den
  Knopf im Browser oder `DELETE /api/holen/<id>` auch sofort.
- Beim Herunterfahren des Servers bleibt nichts zurück.
- Es gibt keine Datenbank, kein Archiv und kein Zugriffsprotokoll mit Inhalten.

Eine Anmeldung bringt die App **nicht** mit. Sie gehört ins interne Netz, nicht
ins Internet; wer sie weiter öffnen will, stellt einen Reverse Proxy mit
Authentisierung davor.

### Grenzen

| Grenze | Wert | Wo geändert |
|---|---|---|
| Dateigrösse je Kalktool | 15 MB | `MAX_DATEIGROESSE` in `offerttool/web/app.py` |
| Kalktools je Offerte | 20 | `MAX_DATEIEN` ebenda |
| Gleichzeitige Generierungen | 2 | `MAX_PARALLEL` in `offerttool/web/jobs.py` |
| Aufbewahrung des Ergebnisses | 30 Minuten | `LEBENSDAUER_SEKUNDEN` ebenda |

Die Parallelitätsgrenze schützt vor LibreOffice: Schritt 8 startet je Auftrag
einen eigenen Prozess.

### Schnittstelle

| Weg | Zweck |
|---|---|
| `POST /api/pruefen` | gelesene Werte, ohne ein Dokument zu erzeugen |
| `POST /api/erzeugen` | Offerte erzeugen, liefert Auftragskennung und Zusammenfassung |
| `GET /api/holen/<id>/offerte` | fertige `.docx` |
| `GET /api/holen/<id>/protokoll` | Prüfprotokoll |
| `DELETE /api/holen/<id>` | Ergebnis sofort löschen |
| `GET /api/gesundheit` | Version, laufende Aufträge, ob Seitenzahlen möglich sind |

Ein Abbruch kommt als HTTP 422 mit `{"fehler": {"code": "E401", …}}`.

---

## Befehle

| Befehl | Zweck |
|---|---|
| `offerttool generate KALKTOOL... -o ZIEL.docx` | Offerte erzeugen |
| `offerttool inspect KALKTOOL [--json]` | zeigt alle gelesenen Werte, Schalter und Warnungen |
| `offerttool check [-t VORLAGE]` | prüft eine Vorlage gegen den Ankerkatalog |
| `offerttool prepare` | erzeugt die ankerbasierte Vorlage aus den Rohvorlagen |
| `offerttool mappings` | listet die hinterlegten Kalktool-Versionen |
| `offerttool serve` | startet die Web-Oberfläche |

Wichtige Optionen von `generate`:

| Option | Bedeutung |
|---|---|
| `-c, --crm` | CRM-Datensatz (JSON). Fehlt er, greifen die Ersatzregeln aus Abschnitt 4.4 (`W305`, `W306`). |
| `-t, --template` | andere ankerbasierte Vorlage |
| `-m, --mapping` | Mapping erzwingen statt es über `KM!C1` zu wählen |
| `--ohne-seitenzahlen` | Inhaltsverzeichnis ohne PDF-Rendervorgang (schneller, Seitenzahlen fehlen) |
| `-v` | Pipeline-Schritte mitloggen |

Ein Abbruch liefert Rückgabewert `2` und **keine Datei** – nie eine halbe Offerte.

---

## Was wo passiert

```
1  LOAD_TEMPLATE     Vorlage öffnen, Ankerkatalog validieren   prepare.validate_template   E10x
2  LOAD_SOURCES      n Kalktools + CRM-Datensatz einlesen      workbook.Kalktool, crm.CRM  E20x
3  EXTRACT           Zellen → Rohwerte                         extract.extract             E21x
4  PARSE             Freitextfelder zerlegen                   parsers                     W30x
5  DERIVE            Schalter und Rechenwerte                  derive.derive               E40x
6  VALIDATE_INPUT    Abbruchregeln                             validate.validate_input     E4xx
7  RENDER            Anker füllen, Standort-Blöcke klonen      render.render               E50x
8  POSTPROCESS       TOC, Feldwerte einfrieren                 docxutil.toc / .fields
9  VALIDATE_OUTPUT   Sperrliste, Restplatzhalter               validate.validate_output    E6xx
```

Die Schritte 1–6 sind seiteneffektfrei und erzeugen nur ein Kontextobjekt.
Erst Schritt 7 berührt das Dokument, erst nach bestandenem Schritt 9 wird geschrieben.

| Datei | Inhalt |
|---|---|
| `offerttool/resources/mapping_q4_2025.yaml` | **jede** Zelladresse, Positionslisten, Sperrliste, Style-IDs |
| `offerttool/anchors.py` | Ankerkatalog (Abschnitt 3.2) |
| `offerttool/textblocks.py` | alle Textbausteine (Abschnitt 8) |
| `offerttool/formatters.py` | `chf`, `rate`, `int_ch`, `monate`, `date_de`, `label_clean` (Abschnitt 7) |
| `offerttool/validate.py` | Abbruchregeln und Sperrlistenprüfung (Abschnitt 13) |
| `offerttool/prepare.py` | einmalige Präparation der Vorlage |

**Im Code steht keine einzige Zelladresse.** Eine neue Kalktool-Version bedeutet:
`mapping_q4_2025.yaml` kopieren, Adressen anpassen, `version:` setzen. Die Auswahl
erfolgt automatisch über `KM!C1` (`"Version: Q4 2025"`).

---

## Die Vorlage

Der Generator adressiert ausschliesslich über `w:tag` von Inhaltssteuerelementen –
nie über Textsuche. Die gelieferten Dateien `Offerte_deCH_Miete.docx` und
`Offerte_deCH_Kauf.docx` sind ausgefüllte Beispieldokumente **ohne** solche Anker.
`offerttool prepare` erzeugt daraus einmalig `offerttool/resources/Offerte_anchored.docx`:

- setzt die 24 Anker aus Abschnitt 3.2,
- reduziert jede Tabelle auf Kopfzeile und **eine** Musterzeile (Abschnitt 10.1),
- stellt die fehlenden Tabellen `TBL.DIENSTLEISTUNG` und `TBL.GESAMTTOTAL` durch
  Klonen einer bestehenden `graphax100`-Tabelle her – nie durch Neuaufbau, sonst
  gingen `tblGrid` und Rahmen verloren,
- baut Kapitel 1.3 „Total" nach Abschnitt 9 (die Rohvorlage stellt die Summe direkt
  unter die Geräteliste),
- fasst Kauf- und Miettext zum SWITCH-Block `SW.VERTRAGSTEXT` zusammen.

Die unvermeidbare Strukturerkennung passiert damit **offline, überprüfbar und genau
einmal**. Jede Suche in `prepare.py` ist eine Behauptung: trifft sie nicht zu, bricht
die Präparation mit `E101` ab – eine geänderte Vorlage schlägt hier auf, nicht später
still im fertigen Dokument. `offerttool/resources/Offerte_anchored.docx` ist eingecheckt;
`tests/test_template.py` prüft, dass eine frische Präparation dieselbe Struktur ergibt.

Die ausgelieferte Vorlage neu erzeugen:

```bash
offerttool prepare        # schreibt offerttool/resources/Offerte_anchored.docx und prüft sie
offerttool check          # prüft sie erneut gegen den Ankerkatalog
```

### Ankerkatalog

Die 24 Anker aus Abschnitt 3.2 plus drei dokumentierte Erweiterungen, ohne die sich
Abschnitt 8.4 und 12.1 nicht ankerbasiert umsetzen lassen:

| Tag | Typ | Grund |
|---|---|---|
| `KOND.ABRECHNUNG` | BLOCK | die Zeile „Abrechnungsintervall" der sonst statischen Konditionentabelle |
| `KOND.RECHNUNG` | BLOCK | die Zeile „Rechnungsstellung" derselben Tabelle |
| `SYS.TOC` | SYSTEM | das Inhaltsverzeichnis, das Schritt 8 neu aufbaut |

Ein Anker aus dem Katalog, der in der Vorlage fehlt → `E101`.
Ein Anker in der Vorlage, den der Katalog nicht kennt → `E102`.

---

## Inhaltsverzeichnis und Seitenzahlen

Nach dem Rendern stimmen weder Einträge noch Seitenzahlen des zwischengespeicherten
Verzeichnisses. Schritt 8 baut es neu auf (Abschnitt 12.1): Überschriften einsammeln,
`n.0` / `n.m` / `n.m.k` nummerieren, `_Toc`-Lesezeichen neu setzen, das Dokument nach
PDF rendern und die Seitenzahl je Überschrift aus dem PDF-Text lesen.

Dafür braucht es **LibreOffice** (`soffice`) und einen PDF-Textextraktor
(`pdftotext` aus poppler-utils, sonst `pypdf`, sonst LibreOffice selbst):

```bash
apt-get install libreoffice-writer poppler-utils    # empfohlen
pip install offerttool[pdf]                          # Alternative: pypdf
```

Fehlt beides, entstehen Einträge ohne Seitenzahl und die Warnung `W321` –
die Generierung läuft durch. Mit `--ohne-seitenzahlen` wird der Rendervorgang
bewusst übersprungen.

`w:updateFields = true` wird gesetzt, damit Word beim Öffnen nachrechnet.
Die `TIME`-Felder im Fliesstext werden eingefroren, damit sie das Offertdatum nicht
überschreiben; das Feld in der **Fusszeile** bleibt – es ist das Druckdatum
(Abschnitt 12.2).

---

## Sperrliste

Marge, CIF, Kalkulationsart, Finanzierungsfaktoren und provisionsrelevante Umsätze
werden nie gelesen und nie ausgegeben (Abschnitt 13.2). `workbook.Kalktool.cell()`
verweigert den Zugriff auf diese Zellen; Schritt 9 hält den Text des fertigen
Dokuments zusätzlich gegen ihre formatierten Werte.

Verglichen wird auf ganzen **Zahltoken**, nicht auf Teilzeichenketten, und nur gegen
Werte, die der Renderer nicht selbst gesetzt hat. Beides ist nötig: `300` aus der
gesperrten Zelle `KM!M74` fände sonst einen Treffer in dem völlig legitimen
`CHF 300.00` des Dienstleistungstotals. Ein Treffer verwirft die Datei mit `E601`.

Einzige Ausnahme: `KM!C53` darf zur Plausibilisierung der Stückzahl gelesen
(Abschnitt 5.5), aber nicht ausgegeben werden.

---

## CRM-Datensatz

```json
{
  "crm": {
    "offertnummer": "OF-2026-04768",
    "offertversion": "1.0",
    "kontakt": { "anrede": "Herr", "vorname": "Tom", "nachname": "Wiedmer" },
    "vk": {
      "funktion": "Account Manager",
      "email": "thomas.steiner@graphax.ch",
      "telefon": "+41 58 551 11 22"
    }
  }
}
```

Alle Felder sind optional. Ein leeres Kann-Feld erzeugt **keine** leere Zeile im
Dokument – der Absatz wird gelöscht (Abschnitt 4.4). Fehlt die Offertnummer, tritt die
Verkaufschance an ihre Stelle (`W305`); fehlt die Version, wird `1.0` gesetzt (`W306`).

---

## Prüfprotokoll

Neben der Offerte entsteht `<offerte>.pruefprotokoll.md` mit Eingaben, abgeleiteten
Werten, allen Schaltern und allen Warnungen. Warnungen erscheinen im Log und in dieser
Datei – **nie im Dokument selbst** (Abschnitt 13.3).

---

## Tests

```bash
python -m pytest -q      # 89 Tests
```

`tests/test_golden_birsfelden.py` prüft den Referenzfall aus Abschnitt 14 Wert für
Wert: Variante `MIETE`, Laufzeit 60 Monate, `CHF 0.0320` / `CHF 0.0050`,
`CHF 43.50` / `CHF 47.00`, Dienstleistungen 120 + 180 = `CHF 300.00` ohne die
finanzierten Positionen 200 und 115, sowie die Abwesenheit von `2’645`, `1’587`,
`2’024.75` und `2’339.75`. Weicht ein Wert ab, ist der Generator defekt.

`tests/test_pipeline.py` erzeugt vollständige Dokumente (ein Standort, zwei Standorte,
Kauf) und prüft die Abbruchregeln `E401`, `E402`, `E403`, `E404`, `E413` sowie den
Determinismus. `tests/test_web.py` prüft die Web-Schnittstelle, besonders dass keine
Kalktools auf dem Server liegenbleiben und ein Abbruch als lesbarer Code ankommt.

---

## Bekannte Grenzen des Kalktools

Diese Punkte begrenzen, was der Generator ausgeben kann (Abschnitt 16). Ohne sie
bleibt die Offerte korrekt, aber weniger detailliert.

| Fehlt im Kalktool | Auswirkung heute |
|---|---|
| Artikelnummer, Menge, Netto-Zeilenpreis in `A27:E52` | Hardwaretabelle ohne Art.-Nr. (`–`), Stück fix `1`, keine Zeilenpreise; das Total steht in Kapitel 1.3 |
| Offertnummer und Offertversion | `W305` / `W306`, Verkaufschance als Ersatz |
| Gültig bis | rechnerisch `datum + 60 Tage` |
| `M9` = `=TODAY()` | `W308`; das Datum wird beim Export eingefroren |
| Kontakt, PLZ/Ort und Vertragsbeginn als Freitext | Parser nötig, `W301`–`W304` möglich |

Die Reihenfolge der Behebung: eine Eingabezelle statt `=TODAY()` und eine Zelle
„gültig bis" beheben zwei Warnungen sofort. Getrennte Zellen für PLZ/Ort und
Vertragsbeginn entfernen zwei Parser. Die drei Hardwarespalten sind die einzige
Änderung, die den Inhalt der Offerte sichtbar erweitert – `show.hardware_preise`
schaltet dann automatisch frei.
