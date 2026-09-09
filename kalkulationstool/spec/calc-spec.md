# Rechenlogik des Kalkulationstools

Quelle: `spec/excel/Kalkulationstool_Vorlage_Q42025_rev1_D.xlsx`, Version Q4 2025 rev. 1.
Bei Zweifel gilt das Excel, nicht dieses Dokument und nicht der Code.

Jede Regel nennt die Excel-Zelle. Die Reihenfolge der Abschnitte ist die
Rechenreihenfolge: Hardware → Solutions → Vertragswert → Finanzierung →
Amortisation → Pauschalen → Provision.

Begriffe: `spec/glossary.md`. Erwartete Zahlen: `spec/fixtures/*.json`.

---

## 0. Konventionen

| Regel | Bedeutung |
|---|---|
| `round5(x)` | `ROUND(x*20,0)/20` – Rundung auf 5 Rappen. Excel rundet bei `.5` vom Nullpunkt weg. |
| `iferror(x)` | Ein Ausdruck, der im Excel `#DIV/0!` ergäbe, liefert dort `""` und hier `null`. |
| Leere Zelle | In jeder Rechnung 0. Eine leere Faktorzelle ergibt also Faktor 0, keinen Fehler. |
| `istMiete` | `I16 = 2 oder 5`. Rund zwanzig Formeln lauten `IF($I$16=2,x,IF($I$16=5,x,0))`. |
| Geldbeträge | Als IEEE-754-Doubles gerechnet, genau wie Excel. Ausgegeben wird auf 5 Rappen gerundet. Siehe «Abweichung 4». |

**Vertragsart `I16`** (Optionsgruppe, verknüpfte Zelle):

| Wert | Vertragsart | Finanzierungsfaktor aus |
|---|---|---|
| 1 | Kauf | – (Anzeige 2.5 %) |
| 2 | Miete | Blatt `Miete Graphax` |
| 3 | Leasing | Blatt `GE-Leasing` |
| 4 | Spezial Leasing | frei gesetzt, `H16` |
| 5 | Spezial Miete | frei gesetzt, `G16` |

---

## 1. Hardware

| Regel | Eingaben | Formel | Zelle |
|---|---|---|---|
| CIF je Zeile | Listenpreis, Kalkulationsart | `E = C * D` | `E27:E52` |
| Supportzeile Listenpreis | CIF-Summe der Zeilen 27–46, `B66` Satz, `B67` fix, `D47` | `C47 = -((SUM(E27:E46)*B66)+B67)/D47` | `C47` |
| Supportzeile CIF | | `E47 = C47*D47` | `E47` |
| Total Listenpreis | alle Hardwarezeilen inkl. Supportzeile | `C53 = SUM(C47:C52, C27:C46)` | `C53` |
| Total CIF | | `E53 = SUM(E27:E52)` | `E53` |
| Netto Verkaufspreis | `E21` Rabattsatz | `E54 = C53 - C53*E21` | `E54` |
| Marge | | `C54 = E54 - E53` | `C54` |
| Marge in % | | `B54 = iferror(C54/(C54+E53))` | `B54` |
| Marge «alt» | | `C55 = E54 - E53*(1/1.08*1.23)` | `C55`, `D55` |

Die Supportzeile liegt zwischen zwei Blöcken von Hardwarezeilen: 27–46 zählen in
die Bemessungsgrundlage des Supportabzugs, 48–52 nicht. `D47` ist im Excel eine
Formel `=D27`, übernimmt also die Kalkulationsart der ersten Hardwarezeile.

Sind `B66` und `B67` beide 0, ist `C47` ebenfalls 0.

---

## 2. Solutions – Software / Hardware

Erfassung auf dem Blatt `Detail Solutions`, Zeilen 21–38.

| Regel | Formel | Zelle |
|---|---|---|
| Total Listenpreis je Zeile | `E = D * A` (Preis je Artikel × Anzahl) | `E21:E38` |
| CIF je Zeile | `G = E * F` | `G21:G38` |
| Netto je Zeile | `H = E`, von Hand übersteuerbar | `H21:H38` |
| Summen des Beiblatts | `E39`, `G39`, `H39` | |

Zusammenzug auf dem Blatt `Kalkulation`, Zeilen 27–32. Zeile 27 übernimmt das
Beiblatt, die Zeilen 28–30 sind zusätzliche Positionen, die direkt hier erfasst
werden.

| Regel | Formel | Zelle |
|---|---|---|
| Total Listenpreis | `I31 = SUM(I27:I30)`, `I27 = 'Detail Solutions'!E39` | `I31` |
| Total CIF | `K31 = SUM(K27:K30)`, `K27 = 'Detail Solutions'!G39` | `K31` |
| Netto Verkaufspreis | `L32 = SUM(L27:L31)`, `L27 = 'Detail Solutions'!H39` | `L32` |
| Marge | `I32 = L32 - K31` | `I32` |
| Rabattsatz | `H32 = iferror(1 - L32/I31)` | `H32` |
| Amortisationsbasis | `M31 = round5(istMiete ? L32/J16 : 0)` | `M31` |

---

## 3. Solutions – Maintenance

Gleicher Aufbau, Beiblatt Zeilen 43–56, Zusammenzug `Kalkulation` 36–41.

| Regel | Formel | Zelle |
|---|---|---|
| Total Listenpreis | `I38 = SUM(I36:I37)` | `I38` |
| Total CIF | `K38 = K37 + K36` | `K38` |
| Netto Verkaufspreis | `L39 = SUM(L36:L38)` | `L39` |
| Marge | `I39 = L39 - K38` | `I39` |
| in Verkauf/Miete | `J41 = (I40 = "Nein") ? L39 : 0` | `J41` |
| in Monatspauschale | `L41 = (I40 = "Ja") ? L39 : 0` | `L41` |
| Amortisationsbasis | `M39 = round5(istMiete ? L39/J16 : 0)` | `M39` |

`I40` («Maintenance in Servicepauschale») entscheidet, ob die Maintenance in den
Vertragswert fliesst oder als monatlicher Serviceanteil geführt wird.

---

## 4. Solutions – Dienstleistungen

Beiblatt Zeilen 61–70, Zusammenzug `Kalkulation` 45–52.

| Regel | Formel | Zelle |
|---|---|---|
| Total je Zeile | `H = G * A` (Ansatz × Stunden) | `H61:H70` |
| Total Stunden | `A71 = SUM(A61:A70)` | `A71` |
| Total Beiblatt | `H71 = SUM(H61:H70)` | `H71` |
| Netto Verkaufspreis | `L49 = SUM(L45:L48)`, `L45 = 'Detail Solutions'!H71` | `L49` |
| Marge | `I49 = L49 - SUM(K46:K48)` – `K46:K48` sind in der Vorlage leer, also `I49 = L49` | `I49` |
| Finanziert | `L51 = L49 - J51` | `L51` |
| CIF-Korrektur | `K52 = (J51 = 0) ? -L51 : 0` | `K52` |
| Amortisationsbasis | `M51 = round5(istMiete ? L51/J16 : 0)` | `M51` |

`J51` ist der direkt verrechnete Anteil. Wird nichts direkt verrechnet, nimmt
`K52` den finanzierten Betrag wieder aus dem Total CIF heraus.

Die Stundenzahl `I45` zählt nur die Zeilen des Beiblatts, nicht die
Zusatzzeilen 46–48.

---

## 5. Vertragswert

| Regel | Formel | Zelle |
|---|---|---|
| Total CIF | `C57 = E53 + K31 + K38 + K52` | `C57` |
| Marge total | `C58 = C54 + I32 + I39 + I49` | `C58` |
| Netto Verkaufspreis | `C59 = C58 + C57` | `C59` |
| Marge in % | `B58 = iferror(1 - C57/C59)` | `B58` |
| Restwert alter Vertrag | `M21 = D21 ? J19*J21*M19 : 0` | `M21` |
| davon aufgerechnet | `C60 = L23 ? M21 : 0` | `C60` |
| Eingerechnete Dienstleistungen | `C61 = B73+B75+B77+B79+B81+B84+B87+B90+B93 + L51` | `C61` |
| **Vertragswert** | `C62 = C59 + C60 + C61` | `C62` |
| Marge von unten | `B63 = iferror(C58/C57)` | `B63` |
| Rabatt LP Hardware | `B64 = iferror(1 - E54/C53)` | `B64` |
| Rabatt LP Software | `B65 = iferror(1 - (L32+L39)/(I31+I38))` | `B65` |

Die Zeilen 73–93 (Transport, Integration Netzwerk / Fax / LDAP und vier weitere)
haben je eine Spalte «Verrechnet» (A) und «Finanziert» (B). Nur der finanzierte
Teil erhöht den Vertragswert.

---

## 6. Finanzierung

### 6.1 Amortisationsdauer `H14`

```
H14 = J16 = 12  ? 24
    : J16 = 24  ? 24/0.95
    : J16
```

### 6.2 Mietfaktor `L83`

```
L83 = I16 = 5      ? G16
    : B17 = TRUE   ? MieteGraphax[Zeile 14][J16]      // KAM: feste Stufe «ab 250'000»
    : I16 = 2      ? MieteGraphax[Zeile 15][J16]      // Stufe nach Vertragswert C62
    : " "
```

`Miete Graphax` Zeile 15 wählt die Stufe nach `C62`:
`≥ 250 000 → Zeile 14`, `≥ 100 000 → 13`, `≥ 50 000 → 12`, `≥ 20 000 → 11`,
`≥ 10 000 → 10`, sonst `Zeile 9`. Spalten: C = 12, D = 72, E = 24, F = 36,
G = 48, H = 60 Monate.

**Die Spalte für 12 Monate ist in der Vorlage leer** («Faktor offen – noch zu
definieren»). Der Faktor wird damit 0 und die Rate ebenfalls.

### 6.3 Leasingfaktor `L84`

```
I84 = (I16 = 3 und C62 ≥ 2000 und J16 ∈ {24,36,48,60})
      ? GELeasing.quartalsweise[Stufe(C62)][J16] : " "
J84 = gleiche Bedingung, GELeasing.monatlich[Stufe(C62)][J16]

L84 = I16 = 4 ? H16
    : I15 = "Quartalsweise" ? I84 : J84
```

Stufen im Leasing: `2000, 10 000, 20 000, 30 000, 50 000, 100 000`
(`MATCH(C62,{…},1)`). Die quartalsweisen Faktoren der Stufen 1–5 sind im Excel
das Dreifache der monatlichen; die Stufe «ab 100 000» ist dort fest eingetragen.

### 6.4 Angezeigter Faktor und Zinsfaktor

```
H83 = I16 = 1 ? 0.025 : I16 = 2 ? L83 : I16 = 3 ? L84 : I16 = 4 ? H16 : G16

L89 = I16 = 1 ? MieteGraphax[Zeile 15][J16]     // auch beim Kauf
    : I16 = 2 ? L83 : I16 = 3 ? L84 : I16 = 4 ? L84 : L83
```

### 6.5 Provisionskennzeichen `G15`

```
G15 = I16 ∈ {1, 3, 4} ? 1 : 0      // Kauf und Leasing werden sofort fakturiert
```

---

## 7. Amortisation und Zinsen

Alle Werte auf 5 Rappen gerundet.

| Regel | Formel | Zelle |
|---|---|---|
| Zusatzzeilen | `D<n> = round5(istMiete ? B<n>/J16 : 0)` für n = 73,75,…,93 | `D73:D93` |
| Amort. alter Vertrag | `H86 = round5(istMiete ? C60/J16 : 0)` | `H86` |
| Amort. Diverses | `I86 = round5(istMiete ? SUM(D73:D93) : 0)` | `I86` |
| Amort. Hardware | `J86 = round5(istMiete ? E54/H14 : 0)` | `J86` |
| Amort. Sol. Software | `H88 = round5(istMiete ? L32/J16 : 0)` | `H88` |
| Amort. Sol. Maintenance | `I88 = round5((I16=1 ? L41 : L39)/J16)` – **nicht** auf Miete eingeschränkt | `I88` |
| Amort. Sol. Dienstleistungen | `J88 = round5(istMiete ? L51/J16 : 0)` | `J88` |
| Zinsen Sol. Software | `H90 = round5(istMiete ? L32*L89 - L32/J16 : 0)` | `H90` |
| Zinsen Sol. Maintenance | `I90 = round5(B*L89 - B/J16)` mit `B = (I16=1 ? L41 : L39)` | `I90` |
| Zinsen Sol. Dienstleistungen | `J90 = round5(istMiete ? L51*L89 - L51/J16 : 0)` | `J90` |
| Zinsen Solutions total | `L88 = H90+I90+J90` | `L88` |
| Amortisation Solutions total | `M88 = H88+I88+J88+L88` | `M88` |
| Zinsen Hardware | `L86 = round5(istMiete ? (L92+L93-SUM(M64:M69)) - (H86+I86+J86+H88+I88+J88+H90+I90+J90) : 0)` | `L86` |

Die Zinsen der Hardware sind eine Restgrösse: was von der Rate nach allen
Amortisationen und den Solutions-Zinsen übrig bleibt.

`I88` und `I90` sind die einzigen Amortisations- bzw. Zinsformeln ohne
`istMiete`-Schranke. Beim Leasing rechnen sie deshalb mit `L39` weiter – und
liefern `#VALUE!`, wenn kein Leasingfaktor hinterlegt ist.

---

## 8. Volumen und Monatspauschalen

| Regel | Formel | Zelle |
|---|---|---|
| Monatspauschale s/w | `H58 = H56 * H57` | `H58` |
| Monatspauschale Color | `H63 = H61 * H62` | `H63` |
| Monatspauschale Scan | `H68 = H66 * H67` | `H68` |
| Total Monatspauschalen | `M70 = SUM(M58:M69)` | `M70` |

`M58` SLA, `M59` Grundpauschale inkl. CSRC, `M60` Wartung Controller,
`M61` Wartung Münzer/Kartensystem, `M62` bizhub SECURE, `M64:M69` Solutions.

Die Mehrseitenpreise `H59`, `H64`, `H69` werden erfasst, gehen aber in keine
Summe ein.

---

## 9. Rate und Pauschalen

```
Basis = C62 - L41                       // Vertragswert ohne Maintenance-Anteil

L92 = I16 = 1 ? Basis
    : round5(
        C14 = TRUE und J16 = 12 und I16 = 2
          ? (Basis - E54)*L83 + E54 * MieteGraphax[Zeile 15][12]
          : I16 = 2 ? Basis*L83
          : I16 = 3 ? Basis*L84
          : I16 = 4 ? Basis*H16
          : Basis*G16
      )

L93 = round5(SUM(M64:M69) + L41*L89)          // Servicepauschale Solution
L94 = SUM(M58:M62) + H58 + H63 + H68          // Servicepauschale Gerät
L95 = I16 = 1 ? " " : L92 + L93 + L94         // Monatspauschale Total
```

Bezeichnung der Hauptzeile `H92` aus `lstLabelPauschale`:
Kauf → «Total Verkaufspreis», Miete/Spezial Miete → «Mietpauschale pro Monat
(ohne Service)», Leasing → «Leasingpauschale pro Monat (ohne Service)».

---

## 10. Provision

```
Solutionsumsatz = SUM(M64:M69) * J16

M72 = C14 = TRUE ? 0
    : G15 = 1 ? L49 + L32 + L39 + Solutionsumsatz
    : J51 + Solutionsumsatz
M74 = A73+A75+A77+A79+A81+A84+A87+A90+A93
J78 = C14 = TRUE ? 0 : J51 + L32 + L39 + Solutionsumsatz
K78 = C58
M78 = C14 = TRUE ? 0 : C62 + Solutionsumsatz
```

---

## 11. Bekannte Abweichungen

Diese Punkte sind im Excel so und werden hier bewusst nicht stillschweigend
korrigiert. Fixtures bilden das Excel-Verhalten ab; die Engine ergänzt eine
Meldung, wo das Excel nur einen Fehlerwert zeigt.

**1 – Kein Mietfaktor für 12 Monate.** Die Spalte C des Blatts `Miete Graphax`
ist leer, überschrieben mit «Faktor offen – noch zu definieren». Eine Miete über
12 Monate ergibt deshalb eine Rate von 0. Die Engine rechnet gleich und meldet
`W101`. *Zu klären: soll der Faktor gesetzt oder die Laufzeit gesperrt werden?*

**2 – KAM-Haken in der Vorlage gesetzt.** `B17` ist in der ausgelieferten
Vorlage `TRUE`. Damit rechnet jede neue Kalkulation mit der günstigsten
Faktorstufe «ab 250 000», unabhängig vom Vertragswert. Die Web-Maske startet mit
`false` und weist mit `W201` darauf hin, sobald der Haken gesetzt wird.
*Zu klären: ist der Haken als Standard gewollt?*

**3 – `#VALUE!` statt einer Meldung.** Fehlt ein Leasingfaktor – Vertragswert
unter 2000 oder Laufzeit ausserhalb 24/36/48/60 – liefert das Excel `#VALUE!` in
`I90`, `L88`, `M88`, `L92`, `L93` und `L95`. Die Engine gibt dort `null` zurück
und meldet `W102`. Die Fixtures halten den Excel-Fehler fest; der Test prüft,
dass die Engine an genau diesen Stellen `null` liefert.

**4 – Gerechnet wird in Doubles, nicht in Rappen.** Die Arbeitsregeln sehen
Ganzzahl-Rappen oder eine Decimal-Bibliothek vor. Solange das Excel die
Spezifikation ist, wiegt Bit-Gleichheit mit Excel schwerer: Excel rechnet in
IEEE-754-Doubles, und jede Abweichung davon würde Fixtures brechen, die richtig
sind. Jeder Betrag, der nach aussen geht, wird mit `round5` auf 5 Rappen
gerundet – an denselben Stellen wie im Excel.

**5 – `#DIV/0!` bei Kalkulationsart 0.** Ist `D27` und damit `D47` gleich 0,
zeigt das Excel `#DIV/0!` in der Supportzeile. Die Engine überspringt den
Supportabzug und meldet `W312`.

---

## 12. Nicht abgebildet

Bewusst ausserhalb dieses Machbarkeitsnachweises. Alles davon ist im Excel
vorhanden und in der Engine vorbereitet, aber nicht Teil der Web-Maske:

- Kopfdaten (Verkäufer, Kunde, CRM-Nummern, Offert-Version, Unterschriften) –
  keine rechnerische Wirkung.
- Zählerversandart `B10` mit `tblZaehler` – Stammdaten, keine Rechnung.
- Business Type `A15`, Vertragsart-Liste `A16`, Anlieferungsart `C96`,
  Fakturierungsperioden `M15`/`M16`, Fakturierung Gebühren `L98` – erfasst im
  Excel, ohne Einfluss auf ein Ergebnisfeld.
- Solutions-Zeilen direkt auf dem Blatt `Kalkulation` (`I28:L30`, `I37`,
  `I46:J48`) und Hardware-Zeilen 48–52: in der Engine implementiert und durch
  Fixtures geprüft, in der Maske nicht angeboten.
- Produkt-Datenbank, Offerten-Ausgabe, Dokumentenanbindung, Anmeldung,
  Versionierung gespeicherter Offerten – Phasen 3 bis 6 des Vorgehens.
