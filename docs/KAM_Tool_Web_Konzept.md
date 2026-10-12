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
| F2 | 11 bepreiste Artikel stehen im Kalkulationsblatt, fehlen aber im Preisblatt, weil dessen Zeilenbereiche von Hand gesetzt sind. Einzeln aufgeführt und bewertet in **Abschnitt 2.6**. | Bestellbare Optionen erscheinen nicht im Kundenpreisblatt; eine erfasste Anzahl fliesst in kein Total. | 7 Geräte |
| F3 | Miete 60 Monate verwendet bei „eigene Mietfaktoren = ja“ den **48-Monats-Faktor**. | Miete 60 Monate zu hoch, wenn eigene Faktoren gelten. | 4201i, 5001i, 4000i/5000i Barcode (66 Zeilen) |
| F4 | 22 Preise werden gar nicht berechnet: Leasing beim DK-P06x-Unterschrank (C3351i, C4051i, C4751i) und mehrere Dienstleistungen beim 226. | leere Felder im Preisblatt | 4 Geräte |
| F5 | Der Name `Stammdaten` deckt nur die Zeilen 3–15 001 ab, die Datei hat 15 627 Artikel. | Ein neuer Artikel am Tabellenende ergibt `#NV`. Heute betrifft es noch keinen Geräteartikel; beim nächsten neuen Gerät kann es passieren. | Vorlage |
| F6 | Beide externen Verknüpfungen zeigen auf den **persönlichen OneDrive-Desktop** einer einzelnen Person. | Fällt aus, sobald die Datei verschoben wird oder die Person wechselt. Jeder Nutzer braucht Zugriff darauf. | Vorlage |
| F7 | Zwei abweichende Faktorensätze: das KAM-Tool rechnet mit Kurs 0.97 und CIF 2 %, `Stammdaten.xlsx` enthält 1.03 und 3 %. **Entschieden: 0.97 / 2 %**, das KAM-Tool rechnet also richtig. | Das Blatt `Allgemeine Faktoren` in `Stammdaten.xlsx` ist veraltet und kann irreführen. In der Web-Fassung gibt es nur noch einen Satz. | – |
| F8 | Global Account Support (J) ist in 269 bepreisten Zeilen nicht mit `J2` verknüpft, darunter Artikel des Kreditors `K100135` (z. B. USB-Kartenleser, MK-P08). **Entschieden: bleibt unverändert.** | Wer `J2` setzt, erhält den Support nur auf den verknüpften Artikeln. Die Web-Fassung übernimmt das je Artikel (`global_support: false`). | 38 Geräte |
| F9 | Sprachumschaltung lückenhaft: `Support in EUR`, `Netto-Kaufpreis exkl. MwSt. x Anzahl`, `Total vRB` und `exkl. MwSt.` sind fest deutsch. | Französisches Preisblatt mit deutschen Zeilen | alle |
| F10 | Nur EUR wird umgerechnet. Jede andere Währung wird als CHF behandelt. | Im Gerätebestand heute ohne Wirkung (alle Artikel in EUR oder ohne Währung). Gefährlich für neue Lieferanten in USD/GBP. | Vorlage |
| F11 | Zwei Artikel stehen doppelt im Kalkulationsblatt: MK-748 beim C268i (Zeilen 17 und 19), PK-524 beim 361i (Zeilen 16 und 19). | Die zweite Zeile erscheint nicht im Preisblatt, ist also harmlos, aber irreführend. | 2 Geräte |

**Sofortmassnahmen im Excel**, unabhängig vom Webprojekt: F1 (Makro auf Spalte 19
setzen oder entfernen), F3 und F4 korrigieren, F5 (Bereich bis Zeile 50 000), das veraltete
Blatt `Allgemeine Faktoren` in `Stammdaten.xlsx` entfernen (F7) und F2 nach der Prüfung
in 2.6 nachziehen.

### 2.5 Was ein neues Gerät heute kostet

Laut Änderungsprotokoll kommt mehrmals im Jahr ein Gerät dazu oder wird ersetzt
(C4751i, 4751i/4701i, 551i, 361i, C4001i …). Heute heisst das: zwei Blätter
duplizieren, alle Blattverweise im Preisblatt umbiegen, Artikelzeilen einfügen und die
festen Zeilenbereiche (`SUM(F11:F43)`, Dienstleistungsblock) von Hand nachziehen.
Dazu kommen ein Eintrag in `Gerätedaten`, der Major-Account-Support-Satz, das
Änderungsprotokoll und das Verteilen der neuen Datei. Die Fehler F2 bis F4 zeigen,
dass dieser Ablauf regelmässig etwas vergisst.

### 2.6 Die 11 Artikel ohne Preisblatt

Ursprünglich wurden 12 Fälle gemeldet. Einer davon (MK-748 beim C268i) ist eine doppelte
Zeile, deren erste Ausgabe im Preisblatt steht; er ist unter F11 erfasst. Für die
übrigen 11 hilft ein Muster bei der Einschätzung:

- Fehlt ein Artikel **am Ende eines Blocks**, wurde der Zeilenbereich meist nicht
  verlängert. Das spricht für vergessen.
- Fehlt er **mitten in der Liste**, hat ihn jemand gezielt ausgelassen. Das kann
  Absicht sein, etwa bei einer fehlenden Kompatibilität.
- **Bei anderen Geräten gezeigt** gibt an, bei wie vielen Geräten mit demselben
  Artikel er im Preisblatt steht.

| Gerät | Artikel | Netto CHF | Marge | Position im Kalkulationsblatt | Bei anderen Geräten gezeigt | Einschätzung |
|---|---|---:|---:|---|---|---|
| C3321i | EK-P11 Schnittstellenkabel für GPRS Modem (`ACCUWY1`) | 29.50 | 41 % | letzte Option vor „Bereitstellung“ | 3 von 6 (C4001i, 4701i, 4751i) | **vermutlich vergessen**: Optionsbereich eine Zeile zu kurz |
| C3351i | EK-P11 (`ACCUWY1`) | 29.50 | 41 % | letzte Option vor „Bereitstellung“ | 3 von 6 | vermutlich vergessen, gleiches Muster |
| C4051i | EK-P11 (`ACCUWY1`) | 29.50 | 41 % | letzte Option vor „Bereitstellung“ | 3 von 6 | vermutlich vergessen, gleiches Muster |
| C4751i | EK-P11 (`ACCUWY1`) | 29.50 | 41 % | letzte Option vor „Bereitstellung“ | 3 von 6 | vermutlich vergessen, gleiches Muster |
| C268i | MK-735 Montage-Kit für IC-Karten (`A4NMWY1`), Bemerkung „Nicht zwingend notwendig“ | 44.50 | 40 % | mitten in der Liste (nach USB-Kartenlesern, vor LK-105) | 19 von 19 | **unklar**: gezielt ausgelassen, aber überall sonst angeboten. PM prüfen |
| C268i | bizhub SECURE Ultimate, Konfiguration inhouse (`C8106`), Bemerkung „LK-116 zwingend notwendig“ | 385.00 | 100 % | direkt nach SECURE Platinum, dem letzten gezeigten Security-Artikel | 18 von 18 | **vermutlich vergessen**: Security-Block endet eine Stufe zu früh; LK-116 ist beim C268i bestellbar |
| C268i | Secure Standard-Beratungsmodul von Graphax (`C8200`) | 350.00 | 100 % | direkt nach SECURE Ultimate | 26 von 26 | vermutlich vergessen, gleicher Block |
| C751i | LDAP-Anbindung (`N2205`) | 100.00 | 100 % | mitten in den Dienstleistungen (nach Scan-to-Einbindung) | 30 von 30 | **vermutlich vergessen**: Standard-Dienstleistung, überall sonst angeboten |
| 258i | PC-417 Grossraumkassette 1000+1500 Seiten (`AAV5WY6`) | 1 170.00 | 40 % | mitten in der Liste (direkt nach PC-416) | 12 von 13 | **unklar**: gezielt ausgelassen, nur bei 258i und 328i. Kompatibilität prüfen |
| 328i | PC-417 Grossraumkassette (`AAV5WY6`) | 1 170.00 | 40 % | mitten in der Liste (direkt nach PC-416) | 12 von 13 | unklar, wie 258i |
| 227 Refresh | LK-108 i-Option License Kit OCR Font printing (`A0PD02G`) | 200.00 | 29 % | mitten in den i-Options | 4 von 4 | **ohne Belang**: Gerät ist ausgeblendet (ausgelaufen) |

Netto und Marge sind die Werte, die Excel zuletzt gespeichert hat (Listenpreis ohne
Rabatt, CIF 2 %). Bei Dienstleistungen ohne Einkaufspreis steht die Marge
systembedingt auf 100 %.

**Vorschlag:** EK-P11 (4×), SECURE Ultimate, Secure-Beratungsmodul und LDAP-Anbindung
ins Preisblatt aufnehmen. MK-735 beim C268i und PC-417 bei 258i/328i vom PM auf
Kompatibilität prüfen lassen. Je nach Ergebnis kommen sie in die Gruppe `optionen`
oder fliegen ganz aus der Gerätedatei. LK-108 entfällt mit dem 227 Refresh.

---

## 3. Zielbild

```
                   ┌───────────────────────────────────────────────┐
  IT (vom PM)      │  KAM-Web  (FastAPI, intern, wie Offerttool)   │       Verkauf (KAM)
  ───────────      │                                               │       ─────────────
  Stammdaten.xlsx ─┼─► Stammdaten-Versionen (Stand 31.08.2026, …)  │
  Mietfaktoren    ─┼─► Parameter (Kurs 0.97, CIF 2 %, Faktoren)    │
  PM → IT (PR)    ─┼─► Gerätekatalog  geraete/*.yaml ──┐           │
                   │                                   ▼           │
                   │                     Rechenkern (Abschnitt 4) ◄┼── Gerät wählen, Anzahl,
                   │                                   │           │   Marge/Rabatt/Zuschlag,
                   │                                   ▼           │   Sprache, MAS, Kurs/CIF
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
      - nr: 9967014794           # USB CR YSF MF-X+ Lite
        global_support: false    # wie im Excel: J nicht mit J2 verknüpft (F8)
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

### 3.2 Ablauf „Neues Gerät“: PM legt an, IT stellt bereit

Die Gerätedateien liegen im Repo unter `geraete/`. Neue Geräte kommen auf demselben
Weg in den Betrieb wie jede andere Änderung an der App. Die Web-App selbst speichert
keine Geräte.

**Produktmanagement: Gerät vorbereiten.** Dafür gibt es eine Seite „Gerät vorbereiten“
in der App. Sie speichert nichts, sie prüft nur und erzeugt eine Datei.

1. Vorlage wählen, z. B. „bizhub C3351i“. Ein Nachfolger übernimmt meist einen grossen
   Teil der Optionen seines Vorgängers (siehe „Abtausch 360i → 361i“).
2. Modellname eingeben, Artikelnummern ergänzen, entfernen oder ersetzen (Einfügen aus
   der Zwischenablage geht auch). Jede Nummer wird sofort gegen die aktuellen
   Stammdaten geprüft: Bezeichnung, EK, Listenpreis und Marge erscheinen direkt daneben.
3. Gerätedaten (Druckgeschwindigkeit, Scan-to, Lieferumfang DE/FR) und den
   Major-Account-Support-Satz im selben Formular erfassen.
4. **Prüfungen**, die den Download sperren: unbekannte Artikelnummer, doppelte Nummer
   (F11), Hardware mit EK 0 oder ohne Listenpreis, Währung ohne Kurs, fehlende
   Gerätedaten. Hinweise ohne Sperre: Marge unter Schwelle, Artikel nur in DE übersetzt.
5. Vorschau des Preisblatts in DE und FR. Danach die Gerätedatei herunterladen und mit
   einem Satz zur Änderung an die IT geben (Ticket oder Mail).

**IT: bereitstellen.**

6. Datei als Pull Request ins Repo übernehmen. Die automatischen Tests prüfen den
   Aufbau der Gerätedatei (Pflichtfelder, doppelte Nummern, gültige Gruppen). Die
   Stammdaten liegen wegen der Einkaufspreise nicht im Repo, deshalb prüft die CI
   nicht gegen sie.
7. Mergen und deployen. Beim Start prüft der Server jede Gerätedatei gegen die
   aktuellen Stammdaten. Ein Gerät mit unbekannten Artikeln wird nicht freigeschaltet
   und erscheint in der Admin-Ansicht als Fehler, statt mit Lücken live zu gehen. Ist
   alles in Ordnung, ist die Seite `/geraete/<id>` für alle Verkäufer da.
8. Die Git-Historie ist das Änderungsprotokoll (wer, wann, welche Artikel). Das Blatt
   „Anpassungen des KAM-Tools“ entfällt.

Bringt ein neues Gerät neue Artikelnummern mit, lädt die IT **zuerst** die neuen
Stammdaten hoch (3.3) und stellt danach die Gerätedatei bereit.

Ein auslaufendes Gerät setzt das PM auf `status: ausgelaufen`; der Weg ist derselbe.
Die Datei bleibt bestehen, alte Kalkulationen und Exporte lassen sich damit weiter
öffnen.

Mit dieser Trennung bleibt die fachliche Pflege beim PM. Die IT entscheidet nur über
den Zeitpunkt des Livegangs und braucht kein Fachwissen über die Geräte.

### 3.3 Stammdaten statt externer Verknüpfungen

- **Ablauf (rund 4× im Jahr):** Das PM gibt `Stammdaten.xlsx` und die Mietfaktoren
  an die IT. Die IT lädt sie auf einer Admin-Seite hoch. Ins Repo kommen sie nicht,
  weil sie Einkaufspreise enthalten.
- Vor dem Übernehmen prüft der Server die Dateien: Pflichtspalten, doppelte
  Artikelnummern, gültige Währungen, und ob jeder Artikel aller aktiven Geräte
  vorhanden ist. Fehlt ein Geräteartikel, wird der Upload abgelehnt und die
  betroffenen Geräte und Artikel werden aufgelistet. Die IT gibt diese Liste ans PM
  zurück und braucht dafür kein Fachwissen.
- Vor dem Freischalten zeigt der Server einen Vergleich mit dem bisherigen Stand:
  neue und entfallene Artikel sowie Preisänderungen je Gerät, z. B. „C3351i: 14
  Artikel teurer, Grundgerät +3.2 %“. Die IT schickt den Vergleich dem PM zur Freigabe
  und schaltet erst danach frei. Bei vier Lieferungen im Jahr ist dieser Schritt
  wenig Aufwand und fängt falsche Dateien ab.
- Jede Version wird mit Stichtag abgelegt. Die Vorversion bleibt erhalten, damit
  ältere Kalkulationen nachvollziehbar sind und ein Rückgriff möglich ist.
- Jede Kalkulation merkt sich den Stand, mit dem sie gerechnet wurde. **Das ersetzt das
  Makro „Preis aktualisieren?“:** Eine gespeicherte oder exportierte Kalkulation behält
  ihre Preise. „Auf aktuelle Stammdaten heben“ ist ein bewusster Knopf, der die
  Differenzen anzeigt.
- **Kurs und CIF-Gebühr:** Die Standardwerte (Kurs 0.97, CIF 2 %) gibt es genau einmal.
  Sie werden zentral gepflegt, und damit ist F7 gelöst. Der Verkäufer kann beide Werte
  **je Kalkulation überschreiben**, im Kopf der Geräteseite. Abweichende Werte sind
  farbig markiert, mit „Standard“ zurückzusetzen und werden im internen Export und im
  Blatt `_kam` festgehalten. Der Kundenexport zeigt sie nicht.
- Später ist eine direkte Anbindung an das ERP möglich. Am Rechenkern ändert das nichts.

---

## 4. Rechenkern

Eine Funktion `kalkuliere(gerät, eingaben, stammdaten, parameter)` setzt Abschnitt 2.2
um und liefert je Artikel M, S, T, U, V, W–AB sowie die Totale des Preisblatts.
Festlegungen gegenüber Excel:

| Punkt | Festlegung |
|---|---|
| Rundung | Excel-kompatibel: kaufmännisch auf der Dezimaldarstellung (2 Stellen in der Kalkulation, 1 Stelle im Preisblatt) |
| Global Account Support | unverändert wie im Excel: gilt je Artikel, ausser die Gerätedatei setzt `global_support: false` (F8) |
| Kurs und CIF-Gebühr | Standard 0.97 / 2 %, je Kalkulation vom Verkäufer überschreibbar (F7) |
| Währung | Kurs je Währung aus den Parametern, unbekannte Währung = Fehler statt stillschweigend CHF (F10) |
| Marge bei Preis 0 | „–“ statt `#DIV/0!` |
| Eigene Mietfaktoren 60 Monate | eigener 60-Monats-Faktor (F3 behoben) |

Die Abnahme folgt dem Muster des Offerttools mit einem **Golden Record**. Die 19 796
heute übereinstimmenden Werte werden als Erwartung festgeschrieben. Die Standardfaktoren
sind dieselben wie im Excel. Bewusste, dokumentierte Abweichungen sind nur die
Korrekturen F3 und F4. Wird der Kern später auch im Browser
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
| Inhalt | Kopf mit Logo und Gerätedaten, Optionen mit Anzahl/Netto/Total, vRB, Miete und Leasing 36/48/60, Dienstleistungen, Klickpreise und Service-Pauschale, „exkl. MwSt.“ | zusätzlich EK, Währung, Kreditor, Support, CIF, Marge je Artikel, Stammdaten-Stand, verwendete Faktoren (vom Standard abweichende markiert) |
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
  web/app.py                 # FastAPI: /geraete, /geraete/{id}, /api/kalkulation, /api/export,
                             #          /geraet-vorbereiten, /admin (Stammdaten)
  web/static/                # Oberfläche ohne Build-Kette, wie offerttool/web/static
geraete/*.yaml               # Gerätekatalog
tests/test_kam_*.py          # Golden Record, Aufbau jeder Gerätedatei (läuft im Pull Request der IT), Export
tools/kam_migrieren.py       # einmalige Überführung aus dem Excel (vorhanden)
```

Anmeldung über einen Reverse Proxy mit Login (z. B. Microsoft Entra ID), wie es das
README des Offerttools für den Betrieb empfiehlt. Rollen:

- **Verkauf:** rechnen, exportieren.
- **PM:** „Gerät vorbereiten“ (nur lesend, Abschnitt 3.2) und Einsicht in den
  Stammdatenvergleich.
- **IT:** Stammdaten hochladen und freischalten, Standardfaktoren pflegen,
  Gerätedateien bereitstellen.

Alles Fachliche liefert das PM, die IT führt aus.

### 6.3 Oberfläche Verkauf

1. Gerät wählen (Suche, gruppiert A3 Farbe / A3 SW / A4, ausgelaufene Geräte nicht
   sichtbar).
2. Kopf: Kunde, Sprache, Major Account Support, eigene Mietfaktoren, Global Account
   Support %, Kurs und CIF-Gebühr (vorbelegt mit dem Standard, überschreibbar).
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
| 0 | Prüfung der Artikel aus 2.6 durch das PM, Sofortmassnahmen im Excel (2.4), restliche offene Punkte (Abschnitt 8) | korrigiertes Excel als Referenz |
| 1 | Gerätekatalog mit `kam_migrieren.py` erzeugen und von PM prüfen lassen; Rechenkern und Golden Record | 38 Gerätedateien, Rechenkern mit 0 Abweichungen |
| 2 | Verkaufsoberfläche und xlsx-Export (Kunde und intern) | Pilot mit 2–3 KAM parallel zum Excel |
| 3 | Stammdaten-Upload mit Prüfung und Vergleich für die IT; „Gerät vorbereiten“ für das PM; Prüfung der Gerätedateien im Pull Request und beim Start | Excel wird abgelöst |
| 4 | Abhängigkeitsregeln; Übergabe an das Offerttool (KAM-Export als Eingabe) | durchgängiger Weg Kalkulation → Offerte |

---

## 8. Offene Punkte

Entschieden: Kurs 0.97 / CIF 2 %, vom Verkäufer anpassbar (F7). Global Account
Support bleibt unverändert (F8). Neue Geräte legt das PM an, die IT stellt sie bereit
(3.2). Stammdaten und Mietfaktoren gibt das PM rund 4× im Jahr an die IT, die sie
hochlädt (3.3).

1. **F2:** Prüfung der Artikel aus Abschnitt 2.6 durch das PM, vor allem MK-735
   (C268i) und PC-417 (258i/328i).
2. **Leasing:** Die Leasingfaktoren sind heute identisch mit den Mietfaktoren. Bleibt
   das so, oder kommen eigene Werte?
3. **Klickpreise und Service-Pauschale:** Im Preisblatt werden sie von Hand eingetragen.
   Gibt es dafür eine Quelle oder Regel, oder bleibt es eine Eingabe?
4. **Überschreiben der Faktoren:** Gibt es Grenzen, z. B. eine CIF-Gebühr nicht unter
   einem Mindestwert, oder einen Hinweis an die Verkaufsleitung?
5. **Ablage:** Reicht „Export + Wiederladen“ (Abschnitt 5), oder sollen Kalkulationen auf
   dem Server gespeichert und je Kunde auffindbar sein?
6. **Anmeldung:** Ist Microsoft Entra ID als Login verfügbar?
