# KAM-Tool im Browser – Analyse und Vorschlag

**Grundlage:** `KAM_Tool_31.08.2026.zip` mit `Kalkulations-_und_Preisblätter.xlsm`,
`Stammdaten.xlsx` und `Mietfaktoren.xls`.
**Prüfwerkzeug:** [`tools/kam_migrieren.py`](../tools/kam_migrieren.py) – alle Zahlen
in Abschnitt 2 lassen sich damit nachstellen.

---

## 1. Kurzfassung

Das KAM-Tool ist eine einzige Rechenregel, die 38-mal kopiert wurde. Jedes Gerät hat ein
Kalkulationsblatt und ein Preisblatt, zusammen rund 560 bis 3 500 Formeln je Gerät. Die
Formeln sind in allen Blättern **zeilenweise identisch**. Was ein Gerät wirklich
ausmacht, ist nur die **Liste seiner Artikelnummern** und die Angabe, welche davon mit
Anzahl im Preisblatt stehen.

Daraus folgt der Vorschlag:

- **Ein Gerät ist ein Datensatz, keine Seite.** Die Web-Fassung hat eine einzige,
  generische Geräteseite. Ein neues Gerät ist eine neue Gerätedatei (Artikelliste und
  Gerätedaten). Die „neue Seite“ unter `/geraete/<modell>` entsteht daraus von selbst,
  ohne kopierte Formeln.
- **Ein Rechenkern** statt 76 Blättern. Er rechnet bereits heute alle 19 818 Werte des
  Excels nach, und zwar ohne eine einzige Abweichung (Abschnitt 2.3).
- **Export als `.xlsx`**, wie beim Kalktool: Preisblatt für den Kunden, Kalkulation
  für intern, ohne Makros und ohne externe Verknüpfungen (Abschnitt 5).
- **Betrieb wie das Offerttool:** gleicher Server, gleiches Repo, gleiche
  Arbeitsweise mit Golden Record.

---

## 2. Analyse des heutigen Tools

### 2.1 Aufbau

| Teil | Inhalt |
|---|---|
| `Ausfüllen!!!!` | Sprache (DE/FR), Major Account Support ja/nein, eigene Mietfaktoren ja/nein |
| `Allgemeine Faktoren` | Wechselkurs EUR→CHF 0.97, CIF-Handlinggebühr 2 % |
| `Miet- und Leasing-Faktoren` | 36/48/60 Monate, verknüpft mit `Mietfaktoren.xls` |
| `Übersetzungen` | 89 Texte DE/FR (Spaltenköpfe, Hinweise) |
| `Anpassungen des KAM-Tools` | Änderungsprotokoll von Hand, letzter Eintrag 14.06.2025 |
| 38 × `Kalkulationsblatt <Gerät>` | 17–98 Artikel je Gerät, 252 verschiedene Artikelnummern |
| 38 × `Preisblatt <Gerät>` | Kundenansicht: Gerätedaten, Optionen mit Anzahl, Dienstleistungen, Totale |
| VBA | Doppelklick „Preis aktualisieren?“ (38 Kopien), Logo-Makro |
| `Stammdaten.xlsx` (extern) | 15 627 Artikel: Bezeichnung DE/FR, EK, Währung, Kreditor, Listenpreis, vRB; Gerätedaten; Major-Account-Support-Sätze |

9 der 38 Geräte sind ausgeblendet (z. B. C360i, 226, die Refresh-Modelle). Faktisch
sind sie ausgelaufen.

### 2.2 Rechenweg je Artikelzeile

Die Spalten des Kalkulationsblatts, in Klartext:

| Spalte | Bedeutung | Regel |
|---|---|---|
| B | Anzahl | Eingabe |
| C, D, F, G, H, P, U | Bezeichnung, Bemerkung, EK, Währung, Kreditor, Listenpreis, vRB | aus Stammdaten |
| I | Major Account Support % | nur bei `MAS = ja`, Kreditor `K100135`, nicht für 2 Ausnahmeartikel; Satz je Gerätemodell |
| J, K | Global Account / Mega Tender Support (% bzw. EUR je Artikel) | Eingabe, J meist aus `J2` übernommen |
| M | CIF (Einstand CHF) | EUR: `round2((EK − EK·I − EK·J − K) · Kurs · (1 + CIF%))`, sonst `round2(EK · (1 + CIF%))` |
| N / O / Q / R | CIF + x % / Zielmarge / Rabatt auf LP / Zuschlag | Eingabe, in dieser Rangfolge |
| S | Netto-Kaufpreis | `round2(M·(1+N)+R)`, sonst `round2(M/(1−O)+R)`, sonst `round2(LP·(1−Q)+R)` |
| T | Marge | `(S − M) / S` |
| V | Brutto | `S + vRB` |
| W–Y | Miete 36/48/60 | `S · Mietfaktor` (Standard oder eigene) |
| Z–AB | Leasing 36/48/60 | `S · Leasingfaktor` (heute gleich den Mietfaktoren) |

Das Preisblatt rundet Miete und Leasing auf 10 Rappen und bildet die Summen
`Anzahl × Preis` für Kauf, vRB, Miete und Leasing. Dienstleistungen erscheinen dort nur
mit Stückpreis, ohne Anzahl.

### 2.3 Nachrechnung

`tools/kam_migrieren.py` rechnet jede Artikelzeile aller 38 Geräte nach der Tabelle oben
nach und vergleicht mit den Werten, die Excel zuletzt gespeichert hat:

| | Werte |
|---|---|
| geprüft | 19 818 |
| identisch | **19 796** |
| abweichend | **0** |
| in Excel gar nicht berechnet (Formel fehlt) | 22 |

Eine Feinheit ist für die Umsetzung wichtig: Excel rundet auf der Dezimaldarstellung.
Mit der Binärrundung von Python oder JavaScript lägen sechs Einstandspreise
(Refresh-Modelle) einen Rappen daneben. Der Rechenkern muss deshalb mit der
Excel-Rundung arbeiten (`runde()` im Skript).

### 2.4 Gefundene Fehler

Alle Fehler sind aus der Datei selbst belegt und entstehen beim Kopieren von Blättern
und Formeln. Genau dieses Kopieren entfällt im Vorschlag.

| # | Befund | Wirkung | Umfang |
|---|---|---|---|
| F1 | Das Makro „Preis aktualisieren?“ (Doppelklick in Spalte A) schreibt in **Spalte 18 = R (Zuschlag)**. Seine Formel passt aber auf Spalte S (Nettopreis). Die Spalte „Support in EUR“ wurde offenbar nachträglich eingefügt (als einzige ohne Übersetzung), das Makro wurde nicht nachgezogen. | Der Preis wird nicht eingefroren. Stattdessen wird ein erfasster Zuschlag mit einem sinnlosen Wert überschrieben. | alle 38 Geräte |
| F2 | 12 bepreiste Artikel stehen im Kalkulationsblatt, fehlen aber im Preisblatt, weil dessen Zeilenbereiche von Hand gesetzt sind. Beispiele: PC-417 Grossraumkassette (CHF 1 170) bei 258i/328i, bizhub SECURE Ultimate (CHF 385) bei C268i, EK-P11 bei C3321i/C3351i/C4051i/C4751i. | Bestellbare Optionen erscheinen nicht im Kundenpreisblatt; eine erfasste Anzahl fliesst in kein Total. | 8 Geräte |
| F3 | Miete 60 Monate verwendet bei „eigene Mietfaktoren = ja“ den **48-Monats-Faktor**. | Miete 60 Monate zu hoch, wenn eigene Faktoren gelten. | 4201i, 5001i, 4000i/5000i Barcode (66 Zeilen) |
| F4 | 22 Preise werden gar nicht berechnet: Leasing beim DK-P06x-Unterschrank (C3351i, C4051i, C4751i) und mehrere Dienstleistungen beim 226. | leere Felder im Preisblatt | 4 Geräte |
| F5 | Der Name `Stammdaten` deckt nur die Zeilen 3–15 001 ab, die Datei hat 15 627 Artikel. | Ein neuer Artikel am Tabellenende ergibt `#NV`. Heute betrifft es noch keinen Geräteartikel; beim nächsten neuen Gerät kann es passieren. | Vorlage |
| F6 | Beide externen Verknüpfungen zeigen auf den **persönlichen OneDrive-Desktop** einer einzelnen Person. | Fällt aus, sobald die Datei verschoben wird oder die Person wechselt. Jeder Nutzer braucht Zugriff darauf. | Vorlage |
| F7 | Zwei abweichende Faktorensätze: das KAM-Tool rechnet mit Kurs **0.97** und CIF **2 %**, `Stammdaten.xlsx` enthält **1.03** und **3 %**. | Unklar, welcher Satz gilt. | – |
| F8 | Global Account Support (J) ist in 269 bepreisten Zeilen nicht mit `J2` verknüpft, darunter Artikel des Kreditors `K100135` (z. B. USB-Kartenleser, MK-P08). | Wer `J2` setzt, erhält den Support nur auf einem Teil der Artikel. Ob das so gewollt ist, muss geklärt werden. | 38 Geräte |
| F9 | Sprachumschaltung lückenhaft: `Support in EUR`, `Netto-Kaufpreis exkl. MwSt. x Anzahl`, `Total vRB` und `exkl. MwSt.` sind fest deutsch. | Französisches Preisblatt mit deutschen Zeilen | alle |
| F10 | Nur EUR wird umgerechnet. Jede andere Währung wird als CHF behandelt. | Im Gerätebestand heute ohne Wirkung (alle Artikel in EUR oder ohne Währung). Gefährlich für neue Lieferanten in USD/GBP. | Vorlage |

**Sofortmassnahmen im Excel**, unabhängig vom Webprojekt: F1 (Makro auf Spalte 19
setzen oder entfernen), F2, F3 und F4 korrigieren, F5 (Bereich bis Zeile 50 000) und
F7 entscheiden.

### 2.5 Was ein neues Gerät heute kostet

Laut Änderungsprotokoll kommt mehrmals im Jahr ein Gerät dazu oder wird ersetzt
(C4751i, 4751i/4701i, 551i, 361i, C4001i …). Heute heisst das: zwei Blätter
duplizieren, alle Blattverweise im Preisblatt umbiegen, Artikelzeilen einfügen und die
festen Zeilenbereiche (`SUM(F11:F43)`, Dienstleistungsblock) von Hand nachziehen.
Dazu kommen ein Eintrag in `Gerätedaten`, der Major-Account-Support-Satz, das
Änderungsprotokoll und das Verteilen der neuen Datei. Die Fehler F2 bis F4 zeigen,
dass dieser Ablauf regelmässig etwas vergisst.

---

## 3. Zielbild

```
                   ┌───────────────────────────────────────────────┐
  Admin (PM)       │  KAM-Web  (FastAPI, intern, wie Offerttool)   │       Verkauf (KAM)
  ───────────      │                                               │       ─────────────
  Stammdaten.xlsx ─┼─► Stammdaten-Versionen (Stand 31.08.2026, …)  │
  Mietfaktoren    ─┼─► Parameter-Versionen                         │
  Gerät anlegen   ─┼─► Gerätekatalog  geraete/*.yaml ──┐           │
                   │                                   ▼           │
                   │                     Rechenkern (Abschnitt 4) ◄┼── Gerät wählen, Anzahl,
                   │                                   │           │   Marge/Rabatt/Zuschlag,
                   │                                   ▼           │   Sprache, MAS, Faktoren
                   │                         xlsx-Export (Abschn. 5)┼──► Preisblatt.xlsx (Kunde)
                   │                                               │──► Kalkulation.xlsx (intern)
                   └───────────────────────────────────────────────┘
```

### 3.1 Ein Gerät = eine Datei = eine Seite

Die Gerätedatei ist die einzige Stelle, an der ein Gerät beschrieben wird. Die
Rechenregeln stehen dort nicht, die gibt es nur einmal. `tools/kam_migrieren.py --ziel`
erzeugt die 38 Dateien aus dem heutigen Excel. Gekürztes Beispiel:

```yaml
# geraete/c3351i.yaml
id: c3351i
modell: bizhub C3351i            # Schlüssel in Gerätedaten und Major Account Support
status: aktiv                    # aktiv | ausgelaufen  (ersetzt das Ausblenden)
gruppen:
  - art: optionen                # mit Anzahl, zählt ins Total
    artikel:
      - nr: A93E027              # bizhub C3351i (Grundgerät)
      - nr: ACCNWY1              # UK-P19 Kit für Doppeleinzugserkennung
      - nr: ACCGWY1
        hinweis: {de: "nicht mit WT-P03 kompatibel", fr: "pas compatible avec WT-P03"}
  - art: dienstleistungen        # nur Stückpreis
    artikel:
      - nr: C3300                # Bereitstellung C332xi, C335xi, C405xi
      - nr: C3310                # Transport
  - art: intern                  # gerechnet, aber nie im Preisblatt (CS Remote Care)
    artikel:
      - nr: CSRCHTTPS
```

Bezeichnung, Preise und Bemerkungen kommen immer aus den Stammdaten. Eine
Artikelnummer in der Datei genügt. Die Bezeichnungen, die das Skript mitschreibt,
dienen nur der Lesbarkeit.

Die Web-App liest beim Start alle Gerätedateien und bietet jedes aktive Gerät unter
`/geraete/<id>` an. **Das ist die neue Seite.** Sie sieht für jedes Gerät gleich aus und
rechnet für jedes Gerät gleich, und das Preisblatt umfasst immer alle Artikel der
Gruppen. F2 bis F4 können damit nicht mehr entstehen.

### 3.2 Ablauf „Neues Gerät“

Im Admin-Bereich, ohne Excel und ohne Entwickler:

1. **„Neues Gerät“ → „Vorlage: bizhub C3351i“.** Ein Nachfolger übernimmt meist einen grossen
   Teil der Optionen seines Vorgängers (siehe „Abtausch 360i → 361i“).
2. Modellname eingeben, Artikelnummern ergänzen, entfernen oder ersetzen (Einfügen aus
   der Zwischenablage geht auch). Jede Nummer wird sofort gegen die Stammdaten geprüft:
   Bezeichnung, EK, Listenpreis und Marge erscheinen direkt daneben.
3. Gerätedaten (Druckgeschwindigkeit, Scan-to, Lieferumfang DE/FR) und den
   Major-Account-Support-Satz im selben Formular erfassen.
4. **Prüfungen**, die das Speichern blockieren: unbekannte Artikelnummer, doppelte
   Nummer, Hardware mit EK 0 oder ohne Listenpreis, Währung ohne Kurs, fehlende
   Gerätedaten. Hinweise ohne Sperre: Marge unter Schwelle, Artikel nur in DE übersetzt.
5. Vorschau des Preisblatts in DE und FR, danach speichern. Die Seite ist sofort für
   alle Verkäufer da. Das Änderungsprotokoll schreibt sich selbst (wer, wann, welche
   Artikel), damit entfällt das Blatt „Anpassungen des KAM-Tools“.
6. Ein auslaufendes Gerät wird auf `ausgelaufen` gesetzt, nicht gelöscht. Alte
   Kalkulationen bleiben damit lesbar.

Wie gespeichert wird, lässt sich in zwei Stufen lösen: zuerst als YAML im Repo (Review
über Pull Request, volle Historie über Git), später, falls gewünscht, durch das
Admin-Formular direkt auf dem Server mit Versionsablage.

### 3.3 Stammdaten statt externer Verknüpfungen

- Der Admin lädt `Stammdaten.xlsx` und die Mietfaktoren hoch, sobald es neue gibt. Der
  Server prüft sie (Pflichtspalten, Duplikate, gültige Währungen, ob jeder Artikel
  aller aktiven Geräte vorhanden ist) und legt sie als Version mit Stichtag ab.
- Jede Kalkulation merkt sich den Stand, mit dem sie gerechnet wurde. **Das ersetzt das
  Makro „Preis aktualisieren?“:** Eine gespeicherte oder exportierte Kalkulation behält
  ihre Preise. „Auf aktuelle Stammdaten heben“ ist ein bewusster Knopf, der die
  Differenzen anzeigt.
- Kurs, CIF-Gebühr und Faktoren gibt es genau einmal, damit ist F7 gelöst.
- Später ist eine direkte Anbindung an das ERP möglich. Am Rechenkern ändert das nichts.

---

## 4. Rechenkern

Eine Funktion `kalkuliere(gerät, eingaben, stammdaten, parameter)` setzt Abschnitt 2.2
um und liefert je Artikel M, S, T, U, V, W–AB sowie die Totale des Preisblatts.
Festlegungen gegenüber Excel:

| Punkt | Festlegung |
|---|---|
| Rundung | Excel-kompatibel: kaufmännisch auf der Dezimaldarstellung (2 Stellen in der Kalkulation, 1 Stelle im Preisblatt) |
| Global Account Support | Vorschlag: gilt auf **allen** Artikeln des Kreditors `K100135`, sofern F8 nicht anders entschieden wird |
| Währung | Kurs je Währung aus den Parametern, unbekannte Währung = Fehler statt stillschweigend CHF (F10) |
| Marge bei Preis 0 | „–“ statt `#DIV/0!` |
| Eigene Mietfaktoren 60 Monate | eigener 60-Monats-Faktor (F3 behoben) |

Die Abnahme folgt dem Muster des Offerttools mit einem **Golden Record**. Die 19 796
heute übereinstimmenden Werte werden als Erwartung festgeschrieben, die Korrekturen
F3 und F4 als bewusste, dokumentierte Abweichung. Wird der Kern später auch im Browser
gebraucht, prüft derselbe Golden Record beide Fassungen, wie heute
`browser/test/golden.js`.

---

## 5. Export als `.xlsx`

Wie beim Kalktool soll das Ergebnis eine Excel-Datei sein, die man weitergeben,
ablegen und in Excel weiterbearbeiten kann. Vorgeschlagen werden zwei Exporte aus
derselben Kalkulation:

| | **Preisblatt (Kunde)** | **Kalkulation (intern)** |
|---|---|---|
| Dateiname | `Preisblatt_<Kunde>_<Modell>_<Datum>.xlsx` | `KAM_<Kunde>_<Modell>_<Datum>.xlsx` |
| Blätter | `Preisblatt` | `Preisblatt`, `Kalkulation`, `Parameter`, `_kam` (ausgeblendet) |
| Inhalt | Kopf mit Logo und Gerätedaten, Optionen mit Anzahl/Netto/Total, vRB, Miete und Leasing 36/48/60, Dienstleistungen, Klickpreise und Service-Pauschale, „exkl. MwSt.“ | zusätzlich EK, Währung, Kreditor, Support, CIF, Marge je Artikel, Stammdaten-Stand, Faktoren |
| Zahlen | Werte | **lebende Formeln**: `Kalkulation` rechnet aus `Parameter`, `Preisblatt` verweist auf `Kalkulation`. Excel rechnet nach, wenn jemand Anzahl oder Marge ändert. |
| Nicht enthalten | EK, CIF, Marge, Kreditor, Support | Makros, externe Verknüpfungen, fremde Geräte |
| Sprache | DE oder FR, vollständig (F9) | wie gewählt |

- Mehrere Geräte in einem Export sind möglich, je ein Preisblatt pro Gerät und ein
  Übersichtsblatt. Das passt zum Offerttool, wo ein Kalktool einem Standort entspricht.
- Das ausgeblendete Blatt `_kam` enthält Gerät, Eingaben und Stammdaten-Stand als JSON.
  Lädt man die Datei wieder in die Web-App, ist die Kalkulation wiederhergestellt.
  Ein Speichern auf dem Server ist dafür nicht nötig.
- Der Export entsteht serverseitig mit `openpyxl`, wie es das Repo schon verwendet.
  Die Formeln je Zeile sind einheitlich (Abschnitt 2.2), der Generator schreibt also
  eine Zeilenvorlage n-mal. Der interne Export lässt sich mit LibreOffice
  (`--convert-to xlsx` mit Neuberechnung) gegen den Rechenkern prüfen. Damit stimmen
  Datei und Web-Anzeige nachweislich überein.

---

## 6. Technische Umsetzung

### 6.1 Varianten

| | **A: Server im Firmennetz** (empfohlen) | B: Einzelne HTML-Datei offline | C: Power Apps / SharePoint |
|---|---|---|---|
| Neues Gerät für alle sichtbar | sofort | neue Datei an alle verteilen | sofort |
| Einkaufspreise | bleiben auf dem Server | 15 627 EK-Preise in jeder verschickten Datei | in SharePoint-Liste |
| xlsx-Export mit Formeln | `openpyxl`, bewährt | möglich (ZIP-Schreiber existiert), aufwendiger | nur über Zusatzdienste |
| Passt zum Repo | gleiche Pipeline wie `offerttool/web` | wie `browser/` | fremd |
| Offline nutzbar | nein | ja | nein |

Variante B passt nicht zur Anforderung „neue Seite bei neuem Gerät“, und sie würde die
vollständige Einkaufspreisliste in eine Datei packen, die per Mail kursiert. Variante A
nutzt die vorhandene Infrastruktur (`Dockerfile`, `compose.yaml`, systemd-Unit) mit.

### 6.2 Aufbau im Repo

```
kamtool/                     # neues Paket neben offerttool/
  katalog.py                 # Gerätedateien laden und prüfen
  stammdaten.py              # Upload, Prüfung, Versionen
  rechnen.py                 # Rechenkern (Abschnitt 4)
  export.py                  # xlsx Kunde / intern (Abschnitt 5)
  web/app.py                 # FastAPI: /geraete, /geraete/{id}, /api/kalkulation, /api/export, /admin
  web/static/                # Oberfläche ohne Build-Kette, wie offerttool/web/static
geraete/*.yaml               # Gerätekatalog
tests/test_kam_*.py          # Golden Record, Katalogprüfung, Export
tools/kam_migrieren.py       # einmalige Überführung aus dem Excel (vorhanden)
```

Anmeldung über einen Reverse Proxy mit Login (z. B. Microsoft Entra ID), wie es das
README des Offerttools für den Betrieb empfiehlt. Rollen: **Verkauf** (rechnen, exportieren) und **Admin**
(Geräte, Stammdaten, Faktoren).

### 6.3 Oberfläche Verkauf

1. Gerät wählen (Suche, gruppiert A3 Farbe / A3 SW / A4, ausgelaufene Geräte nicht
   sichtbar).
2. Kopf: Kunde, Sprache, Major Account Support, eigene Mietfaktoren, Global Account
   Support %.
3. Tabelle wie heute, aber nur mit den bearbeitbaren Spalten: Anzahl, CIF + x % /
   Zielmarge / Rabatt / Zuschlag. Netto, Marge (farbig unter Schwelle), Miete und
   Leasing rechnen live. Die internen Spalten lassen sich einklappen.
4. Hinweise und Abhängigkeiten aus den Übersetzungen („UK-204 ist Pflicht“, „nicht
   mit JS-602 kompatibel“) erscheinen als Warnung, sobald die Kombination gewählt ist.
   Heute stehen sie nur als Text in der Bemerkungsspalte. Das ist eine spätere Stufe;
   dafür braucht die Gerätedatei Regeln wie `benoetigt` und `ausgeschlossen_mit`.
5. „Export Kunde“ und „Export intern“.

---

## 7. Vorgehen

| Phase | Inhalt | Ergebnis |
|---|---|---|
| 0 | Offene Punkte (Abschnitt 8) klären, Sofortmassnahmen im Excel (2.4) | korrigiertes Excel als Referenz |
| 1 | Gerätekatalog mit `kam_migrieren.py` erzeugen und von PM prüfen lassen; Rechenkern und Golden Record | 38 Gerätedateien, Rechenkern mit 0 Abweichungen |
| 2 | Verkaufsoberfläche und xlsx-Export (Kunde und intern) | Pilot mit 2–3 KAM parallel zum Excel |
| 3 | Admin: Stammdaten-Upload, Gerät anlegen/duplizieren, Änderungsprotokoll | Excel wird abgelöst |
| 4 | Abhängigkeitsregeln; Übergabe an das Offerttool (KAM-Export als Eingabe) | durchgängiger Weg Kalkulation → Offerte |

---

## 8. Offene Punkte

1. **Faktoren (F7):** Gilt Kurs 0.97 / CIF 2 % (KAM-Tool) oder 1.03 / 3 % (Stammdaten)?
   Wer pflegt den Wert, und wie oft?
2. **Global Account Support (F8):** Gilt er auf allen Artikeln oder bewusst nur auf
   einem Teil? Falls nur auf einem Teil: nach welcher Regel (Kreditor, Artikelgruppe)?
3. **F2:** Sollen die 12 fehlenden Artikel ins Preisblatt, oder sind sie absichtlich
   versteckt? Wenn absichtlich, kommen sie in die Gruppe `intern`.
4. **Leasing:** Die Leasingfaktoren sind heute identisch mit den Mietfaktoren. Bleibt
   das so, oder kommen eigene Werte?
5. **Klickpreise und Service-Pauschale:** Im Preisblatt werden sie von Hand eingetragen.
   Gibt es dafür eine Quelle oder Regel, oder bleibt es eine Eingabe?
6. **Wer legt Geräte an?** Nur das Produktmanagement oder auch KAM? Braucht es eine
   Freigabe im Vier-Augen-Prinzip?
7. **Ablage:** Reicht „Export + Wiederladen“ (Abschnitt 5), oder sollen Kalkulationen auf
   dem Server gespeichert und je Kunde auffindbar sein?
8. **Anmeldung:** Ist Microsoft Entra ID als Login verfügbar?
