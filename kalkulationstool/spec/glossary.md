# Glossar

Begriffe aus dem Excel-Kalkulationstool. Im Code werden genau diese Begriffe
verwendet; neue Begriffe werden nicht erfunden.

| Begriff | Bedeutung | Excel |
|---|---|---|
| **Listenpreis (LP)** | Bruttopreis eines Artikels vor jedem Rabatt. | Kalkulation C27:C52, `Detail Solutions` D |
| **Kalkulationsart** | Faktor, mit dem aus dem Listenpreis der CIF wird. Hardware 60 / 100 / 25 / 35 %, Software 70 / 100 / 50 / 30 %. | Listen `lstKalkHW`, `lstKalkSW` |
| **CIF** | Einstandswert einer Position: Listenpreis × Kalkulationsart. Nicht der Zollbegriff, sondern die interne Kostenbasis. | Kalkulation E27:E52 |
| **Netto Verkaufspreis** | Was der Kunde zahlt: Listenpreis abzüglich Rabatt. Bei Solutions standardmässig gleich dem Listenpreis, von Hand übersteuerbar. | Kalkulation E54, L32, L39 |
| **Marge** | Netto Verkaufspreis minus CIF. | Kalkulation C54, C58 |
| **Marge «alt»** | Marge nach der früheren Berechnungsweise: CIF wird mit 1/1.08 × 1.23 hochgerechnet. Reine Vergleichsgrösse. | Kalkulation C55, D55 |
| **Vertragswert** | Netto Verkaufspreis + Restwert aus altem Vertrag + im Vertrag eingerechnete Dienstleistungen. Bemessungsgrundlage für den Finanzierungsfaktor. | Kalkulation C62 |
| **Finanzierungsfaktor** | Monatsfaktor, mit dem der Vertragswert in eine Rate umgerechnet wird. Quelle: Blatt `Miete Graphax` oder `GE-Leasing`. | Kalkulation H83, L83, L84 |
| **Zinsfaktor** | Faktor für die Zinsanteile der Amortisationsrechnung. Meist gleich dem Finanzierungsfaktor; beim Kauf der Mietfaktor nach Vertragswert. | Kalkulation L89 |
| **Amortisation** | Teil der Monatsrate, der Kapital zurückzahlt: Betrag geteilt durch Laufzeit. Nur bei Miete und Spezial Miete. | Kalkulation H86:J88 |
| **Amortisationsdauer** | Dauer für die Hardware-Amortisation. Weicht bei 12 Monaten (→ 24) und 24 Monaten (→ 24/0.95) von der Laufzeit ab. | Kalkulation H14 |
| **Grundpauschale / Rate** | Monatliche Miet- bzw. Leasingrate ohne Service. Beim Kauf steht hier der Total-Verkaufspreis. | Kalkulation L92 |
| **Servicepauschale** | Monatlicher Serviceanteil, getrennt nach Gerät (L94) und Solution (L93). | Kalkulation L93, L94 |
| **Monatspauschale Total** | Rate + Servicepauschale Solution + Servicepauschale Gerät. Beim Kauf nicht definiert. | Kalkulation L95 |
| **Mehrseitenpreis** | Preis je Seite über dem vereinbarten Volumen. Wird erfasst, geht aber nicht in die Monatspauschale ein. | Kalkulation H59, H64, H69 |
| **KAM** | Haken «Key Account Management». Setzt die Mietfaktorstufe fest auf «ab 250 000». | Kalkulation B17 |
| **Verlängerung/New** | Haken für Vertragsverlängerungen. Nullt die Provisionsumsätze und löst bei 12 Monaten Laufzeit eine Sonderrechnung aus. | Kalkulation C14 |
| **Fakt. Leasing** | Fakturierungsrhythmus des Leasingfaktors: monatlich oder quartalsweise. Der quartalsweise Faktor ist das Dreifache. | Kalkulation I15 |
| **Function Code** | Artikelschlüssel für die Auftragsabwicklung, z. B. `MIETESOFT`, `MIETESWM`, `IMPLTRAI`. Rechnerisch ohne Wirkung. | Listen `lstFCSoftware` usw. |
| **H14** | Zelle der Amortisationsdauer. Steht im Auftrag stellvertretend für den Sonderfall kurzer Laufzeiten. | Kalkulation H14 |
| **B17** | Zelle des KAM-Hakens. In der Vorlage ist er gesetzt – siehe «Bekannte Abweichungen» in `calc-spec.md`. | Kalkulation B17 |
| **I16** | Verknüpfte Zelle der Vertragsart-Optionsgruppe: 1 Kauf, 2 Miete, 3 Leasing, 4 Spezial Leasing, 5 Spezial Miete. | Kalkulation I16 |
