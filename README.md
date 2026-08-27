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

## Gerätedatenblätter

Zu jedem Gerätemodell gibt es eine Word-Vorlage mit Beschreibung, technischen
Daten und einer Optionsliste. Liegen sie in `datenblaetter/`, hängt der
Generator zum angebotenen Gerät das passende Datenblatt als eigenes Kapitel
**Hardware** an – zwischen Preisen und Konditionen, mit fortlaufender
Nummerierung und Eintrag im Inhaltsverzeichnis.

```bash
offerttool generate k.xlsx -o o.docx -d datenblaetter/
offerttool generate k.xlsx -o o.docx -d datenblaetter/ --ohne-spezifikation
```

`--ohne-spezifikation` lässt die Optionsliste am Schluss weg; Beschreibung und
Technikdaten bleiben. In der Web-Oberfläche stehen dafür zwei Kästchen.

**Das Verzeichnis liegt nicht im Repository** (`.gitignore`): Datenblätter sind
Geschäftsunterlagen. Ohne sie entsteht die Offerte unverändert, nur ohne das
Kapitel – kein leerer Abschnitt, keine Überschrift.

### Zuordnung ohne Raten

Gesucht wird zum **Gerät**, nicht zum Zubehör: ein Kalktool ist ein Standort
ist ein Gerät (Abschnitt 2.2), das Gerät ist die erste Hardwareposition. Für
Papierkassetten gibt es keine Datenblätter, sie erzeugten nur Fehlmeldungen.

Verglichen wird der normalisierte Modellname, also ohne Sprachkürzel, Version
und Trennzeichen: `bizhub C3351i` findet `bizhub C3351i de.dotx`. Passen
mehrere Vorlagen, wird **keine** gewählt (`W330`); passt keine, `W331`. Beides
sind Warnungen, keine Abbrüche – die Offerte bleibt ohne das Kapitel gültig.
Steht dasselbe Modell an mehreren Standorten, erscheint sein Datenblatt einmal.

### Was beim Übernehmen passiert

Ein Absatz lässt sich nicht einfach kopieren. Die Datenblätter und die
Offertvorlage teilen sich **keine einzige** Formatvorlage – die Datenblätter
nennen ihre Überschriften `berschrift1`, die Offerte `Heading1`.
`docxutil/uebernehmen.py` führt darum Buch über drei Arten von Verweisen:

| Verweis | Behandlung |
|---|---|
| Formatvorlagen | Überschriften werden zugeordnet, alle übrigen aus dem Datenblatt ergänzt. Vorlagen, die es im Ziel schon gibt, bleiben unangetastet – die Offertvorlage ist verbindlich. |
| Nummerierungen | Listendefinitionen werden unter neuen Bezeichnern übernommen; sonst zeigte eine Aufzählung auf eine beliebige Liste der Offerte. |
| Bilder | Der Bildteil wandert samt neuer Beziehung ins Zieldokument. |

Ohne die Zuordnung der Überschriften fände das Inhaltsverzeichnis das Kapitel
nicht – deshalb prüft ein Test genau das.

### In der Browser-Fassung

Die Datenblätter werden **nicht** in die HTML-Datei eingebettet – sie bliebe
sonst nicht bei 434 kB, sondern wüchse auf rund 7 MB, und auf einer
öffentlichen Seite lägen alle Geschäftsunterlagen offen. Stattdessen liegen sie
neben der Seite; geladen wird nur das eine gebrauchte:

```bash
python tools/datenblaetter_bereitstellen.py     # nach public/datenblaetter/
```

Das Werkzeug legt die Dateien samt `index.json` ab. `netlify.toml` erlaubt der
Seite dafür `connect-src 'self'` – sie darf vom eigenen Server laden, sonst
nichts. **Damit sind die Datenblätter über den Webserver abrufbar**; wer das
nicht will, schützt das Netlify-Projekt unter *Site configuration → Access
control*. `public/datenblaetter/` steht in der `.gitignore`.

Läuft die Seite als Datei (Offline-Paket, Doppelklick), gibt es keinen Server.
Dann meldet sie das und man wählt das Datenblatt von Hand – wie das Kalktool.
Beide Wege erzeugen dasselbe Dokument; ein Vergleich mit der Python-Fassung
ergab 195 Absätze ohne Unterschied.

### Noch nicht enthalten

Die Datenblätter führen rund 1300 **Artikelnummern**, die dem Kalktool fehlen.
Sie automatisch in die Geräteliste zu übernehmen wäre nicht zuverlässig: das
Kalktool nennt `PF-P27`, die Vorlage kennt darunter zwei Artikel
(`AAJUWY4` Papierkassette und `AAJUWY2` Höhenverstellungseinheit), und
`DK-P04` steht dort als `DK-P04x`. Über alle Vorlagen betrifft das 56 Kürzel.
Zu raten wäre das Gegenteil dessen, wofür dieser Generator gebaut ist; eine
Zuordnungsdatei wie beim Mapping wäre der Weg.

---

## Formulierungen ändern

Alle Texte der Offerte stehen in `offerttool/resources/textbausteine.yaml` –
49 Bausteine, gruppiert nach Kapitel. Im Code steht kein Wortlaut mehr, so wie
dort auch keine Zelladresse steht.

```yaml
head_standort:
  titel: "Standortüberschrift"
  hinweis: "Überschrift über der Geräteliste und über der Servicetabelle."
  platzhalter: [index, name]
  text: "Standort {index}: {name}"
```

Was in geschweiften Klammern steht, wird beim Erzeugen ersetzt. Je Baustein
sind **nur die unter `platzhalter` genannten** erlaubt; alles andere bricht mit
einer Meldung ab, die die zulässigen aufzählt:

```
ABBRUCH E801: Baustein «Standortüberschrift» (head_standort) verwendet den
unbekannten Platzhalter {naem}. Erlaubt: {index}, {name}
```

Geprüft wird in Schritt 1 der Pipeline – **bevor** irgendetwas geschrieben
wird. Eine geschweifte Klammer als Zeichen schreibt man doppelt: `{{`.

```bash
offerttool bausteine                    # alle Bausteine prüfen und auflisten
offerttool bausteine -b meine.yaml      # eine eigene Fassung prüfen
offerttool generate k.xlsx -o o.docx -b meine.yaml
```

Das Prüfprotokoll hält fest, welche Bausteine galten.

### Im Browser, ohne Datei

Die Browser-Fassung hat dafür einen eigenen Reiter **Textbausteine**: jeder
Baustein mit Titel, Erklärung, Eingabefeld, den erlaubten Platzhaltern zum
Anklicken und einer Vorschau mit Beispielwerten. Geprüft wird bei jedem
Tastendruck; ein unzulässiger Platzhalter wird sofort gemeldet und nicht
gespeichert.

Änderungen wirken sofort, bleiben im Browser erhalten und lassen sich einzeln
oder gesamt zurücksetzen. Über **Sichern** entsteht eine `Textbausteine.json`,
die sich weitergeben und über **Laden** wieder einspielen lässt – so gelten im
Firmennetz dieselben Texte wie im PoC.

Beide Fassungen lesen dieselbe Quelle: `tools/browser_daten.py` erzeugt aus der
YAML die Datei `browser/src/26-bausteine-standard.js`. Ein Test vergleicht
beide, damit die Browser-Fassung nicht veraltet.

---

## Browser-Fassung (Offline-PoC)

Eine **einzelne HTML-Datei**, die per Doppelklick funktioniert – ohne Python,
ohne Installation, ohne Server und ohne Netzwerk. Die Offerte entsteht
vollständig im Browser; weder Kalktool noch Offerte verlassen den Rechner.

```bash
python tools/browser_bauen.py --test    # public/index.html und dist/pruefung.html
python tools/offline_paket.py           # public/Offerttool-PoC.zip zum Weitergeben
```

Das ZIP enthält `Offerttool.html`, ein Beispiel-Kalktool und eine Kurzanleitung.

### Veröffentlichung

`public/` wird als fertiges Ergebnis mit eingecheckt und von Netlify
ausgeliefert (`netlify.toml`, Projekt `kalktoolxlsx`). Es gibt bewusst **keinen
Build-Schritt auf dem Server**: so kann der Deploy nicht an fehlenden
Abhängigkeiten scheitern. Wird die Seite von einem Server geladen, bietet sie
zusätzlich das Offline-Paket zum Herunterladen an; lokal geöffnet entfällt der
Verweis.

Weil `public/index.html` eingecheckt ist, kann es veralten. `tests/test_browser.py`
baut die Datei neu und vergleicht – nach einer Änderung unter `browser/src/`
muss `python tools/browser_bauen.py --test` laufen, sonst schlägt der Test fehl.

Die Prüfseite landet unter `dist/` und wird **nicht** veröffentlicht.

**Die Seite ist öffentlich erreichbar.** In der Einzeldatei steckt die
Offertvorlage mit den Graphax-Konditionen, darunter die Stundensätze für
Technikereinsätze. Wer das nicht im offenen Netz haben will, schützt das
Netlify-Projekt unter *Site configuration → Access control* mit einem Passwort
oder SSO.
Voraussetzung ist nur ein aktueller Browser: Chrome/Edge ab 103, Firefox ab 113,
Safari ab 16.4 – dort gibt es `DecompressionStream`, mit dem sich ein `.xlsx`
ohne Fremdbibliothek entpacken lässt. Ältere Browser meldet die Seite beim Öffnen.

### Aufbau

`file://` blockiert ES-Module, deshalb muss für den Doppelklick alles in einer
Datei liegen. Entwickelt wird trotzdem getrennt unter `browser/src/`; das
Ladepräfix im Dateinamen bestimmt die Reihenfolge, `tools/browser_bauen.py`
fügt zusammen.

| Datei | Inhalt |
|---|---|
| `10-zip.js` | ZIP lesen und schreiben über `DecompressionStream` |
| `11-xlsx.js` | Kalktool lesen (nur Zellwerte, wie `data_only=True`) |
| `20-formatters.js`, `21-parsers.js` | Abschnitte 7 und 6 |
| `30-mapping.js` | **erzeugt** aus `mapping_q4_2025.yaml` |
| `31-extract.js` … `43-toc.js` | Abschnitte 4, 5, 8, 10, 12, 13 |
| `50-vorlage.js` | **erzeugt**: die ankerbasierte Vorlage als Base64 |
| `60-app.js` | Oberfläche |

Ergebnis ist `public/index.html`; `dist/` ist nur lokaler Arbeitsstand.

Die beiden erzeugten Dateien schreibt `tools/browser_daten.py`; sie werden nicht
von Hand bearbeitet. Mapping und Vorlage haben damit **eine** Quelle, die beide
Fassungen teilen.

### Zwei Implementierungen

Die Regeln liegen jetzt in Python **und** in JavaScript vor. Für einen PoC ist
das vertretbar, produktiv ist es eine Quelle für Abweichungen. Abgesichert wird
das über denselben Golden Record: `browser/test/golden.js` prüft 103 Punkte im
Browser, gestartet über `dist/pruefung.html` oder `npm run pruefen`.
`tests/test_browser.py` prüft zusätzlich, dass Mapping, Vorlage und Einzeldatei
aktuell sind und dass die Seite nichts nachlädt.

Der Fliesstext beider Fassungen wurde für den Referenzfall Zeichen für Zeichen
verglichen – 112 Absätze, kein Unterschied.

### Was die Browser-Fassung nicht kann

**Seitenzahlen im Inhaltsverzeichnis** vorausberechnen: dafür bräuchte es einen
PDF-Rendervorgang. Das Verzeichnis wird vollständig neu aufgebaut und richtig
nummeriert (Abschnitt 12.1, Schritte 1–3, 5 und 6); nur die Zahlen trägt Word
beim Öffnen selbst nach, weil `updateFields` gesetzt ist. Die Fassung meldet
deshalb immer `W321`.

---

## Betrieb im Intranet

Zwei Wege, je nachdem, was im Netz stehen soll. Beide erzeugen dasselbe
Dokument – der Unterschied liegt in Betriebsaufwand und Seitenzahlen.

| | Statische Seite | Anwendungsserver |
|---|---|---|
| Was läuft | ein Webserver, sonst nichts | Python und LibreOffice |
| Auszuliefern | `public/` | `offerttool[web]` als Dienst oder Container |
| Wo gerechnet wird | im Browser des Anwenders | auf dem Server |
| Seitenzahlen im Verzeichnis | Word trägt sie beim Öffnen ein | vorberechnet |
| Textbausteine | je Browser, teilbar als Datei | zentral in einer YAML |
| Kalktool verlässt den Rechner | nein | ja, für die Dauer der Generierung |

**Die statische Seite genügt in den meisten Fällen** – sie braucht keinen
Python-Unterhalt, und die Kalktools mit Marge und CIF verlassen den Rechner
des Verkäufers gar nicht. Der Anwendungsserver lohnt sich, wenn die Texte
zentral gelten sollen oder das Verzeichnis auch ohne Word korrekte Seitenzahlen
tragen muss.

### Statische Seite

```bash
python tools/browser_bauen.py --test            # public/index.html
python tools/datenblaetter_bereitstellen.py     # public/datenblaetter/
```

Den Inhalt von `public/` auf den Webserver legen. Fertige Konfigurationen mit
denselben Sicherheitskopfzeilen wie auf Netlify liegen bei:

| Datei | Für |
|---|---|
| `deploy/nginx-offerttool.conf` | nginx |
| `deploy/web.config` | IIS |

Beide setzen die Kopfzeilen und die MIME-Typen für `.dotx` und `.json` – ohne
letztere liefert IIS die Datenblätter gar nicht aus. Die nginx-Fassung wurde
gegen einen laufenden nginx geprüft: Seite, `index.json` und Datenblätter
kommen mit den erwarteten Kopfzeilen, und die Offerte entsteht vollständig.

### Anwendungsserver

Siehe [Web-Oberfläche im Firmennetz](#web-oberfläche-im-firmennetz) – Dockerfile,
`compose.yaml` und ein systemd-Beispiel liegen bereit.

### Zugriff

Im Intranet ist die Netzgrenze meist der Schutz. Beide Fassungen bringen
**keine Anmeldung** mit. Soll der Zugriff enger sein, gehört eine Authentisierung
davor – in `deploy/nginx-offerttool.conf` ist ein `auth_basic`-Block für das
Verzeichnis der Datenblätter vorbereitet und auskommentiert.

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
| `offerttool bausteine` | prüft und listet die Textbausteine |

Wichtige Optionen von `generate`:

| Option | Bedeutung |
|---|---|
| `-c, --crm` | CRM-Datensatz (JSON). Fehlt er, greifen die Ersatzregeln aus Abschnitt 4.4 (`W305`, `W306`). |
| `-t, --template` | andere ankerbasierte Vorlage |
| `-m, --mapping` | Mapping erzwingen statt es über `KM!C1` zu wählen |
| `-b, --bausteine` | eigene Textbausteine (YAML) statt der mitgelieferten |
| `-d, --datenblaetter` | Verzeichnis mit den Gerätedatenblättern |
| `--ohne-spezifikation` | Datenblätter ohne die Optionsliste am Schluss |
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
| `offerttool/resources/textbausteine.yaml` | **jede** Formulierung der Offerte |
| `offerttool/textblocks.py` | welcher Baustein wann gebraucht wird (Abschnitt 8) |
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
Werte, die der Generator selbst eingebracht hat. Drei Quellen sind unverdächtig,
weil sie nicht vom Kalktool abhängen:

| Quelle | Warum kein Leck |
|---|---|
| Vom Renderer gesetzte Beträge | `300` steht in der gesperrten Zelle `KM!M74` *und* legitim als Dienstleistungstotal |
| Statischer Text der Vorlage | die Konditionen nennen `180.- CHF pro Stunde`; die Zahl stand dort, bevor ein Kalktool gelesen wurde |
| Inhalt der Gerätedatenblätter | Technikdaten und Artikelnummern, unabhängig vom Kalktool |

Der Inhalt der **Blattanker** gehört ausdrücklich nicht dazu: was dort steht,
soll der Renderer überschreiben. Bleibt eine Zahl von dort stehen, ist das ein
Vorlagenrest und wird weiterhin erkannt. Ein Treffer verwirft die Datei mit `E601`.

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
python -m pytest -q      # 135 Tests
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
`tests/test_browser.py` deckt die Browser-Fassung ab und startet deren Golden
Record in einem echten Browser.

---

## Kleine Abweichungen zwischen Kalktools

Kein Kalktool gleicht dem anderen: eine ältere Versionsangabe, leere Standortfelder,
Kontaktdaten mit Komma statt Leerzeichen, `dito` als Standortname. Solche
Kleinigkeiten kosten eine Warnung, nicht die Offerte.

| Abweichung | Verhalten |
|---|---|
| `KM!C1` nennt eine Version ohne eigene YAML | Layout wird gegen die bekannten Mappings geprüft; passt genau eines, wird es mit `W313` verwendet |
| Eine erwartete Beschriftung steht woanders | `W314` bei bekannter Version, Abbruch `E202` bei unbekannter |
| Standortadresse (`D7`/`G7`) leer | Die Zeile „Installationsadresse" entfällt ganz, `W315` |
| Weder Offertnummer noch Verkaufschance | `–` auf dem Deckblatt statt einer leeren Zelle, `W316` |
| `dito` als Standortname | Kundenname wird eingesetzt, `W317` |
| `J5` mit Kommas: `Name, Telefon, Mail` | Trennzeichen fallen weg, der Name bleibt sauber |

Abgebrochen wird nur, wo ein Weiterarbeiten raten hiesse: `E202` (Layout passt zu
keinem Mapping) und `E212` (ein echtes Pflichtfeld ist leer). In beiden Fällen
entsteht keine Datei.

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
