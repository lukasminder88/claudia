# Kalkulationstool 2.0 – Vorgehen mit Claude Code

Stand: 09.09.2026. Ausgangslage: Excel-Tool Q4 2025 rev. 1 (D/F), Blatt «Listen», Korrekturauftrag mit Testfällen.

## 0. Grundsatz

Das Excel ist die Spezifikation, nicht der Code. Erst die Rechenlogik als testbare Bibliothek nachbauen, dann Oberfläche, dann Anbindungen. Jede Phase liefert etwas, das läuft. Claude Code arbeitet in kleinen Schritten mit Tests als Abnahmekriterium, nicht mit «bau mir das Tool».

## 1. Zielarchitektur

```
Browser (DE/FR umschaltbar)
   │
   ▼
Web-App  ──►  calc-engine (reine Funktionen, keine UI)
   │            ▲ Regeln + Faktoren, versioniert
   │
   ├──►  Produkt-DB (CSV-Import, Suche, Autofill)
   ├──►  Offert-Generator (DOCX/PDF aus Vorlage + Textblöcken)
   ├──►  Dokumentquelle (Adapter: lokaler Ordner | SharePoint-URL)
   └──►  Admin (Listen, Faktoren, Vorlagen pflegen; Versionen; Rollen)
```

Vier Pakete in einem Repo (Monorepo). Die Engine kennt weder Browser noch SharePoint. Das ist der Punkt, an dem die meisten Excel-Ablösungen scheitern: Logik landet in der UI und ist nicht mehr prüfbar.

## 2. Technische Entscheide

| Bereich | Entscheid | Warum |
|---|---|---|
| Sprache | TypeScript durchgehend | Ein Typensystem für Engine, API und UI. Claude Code arbeitet damit am zuverlässigsten. |
| Engine | Reines TS-Paket `packages/calc-engine`, keine Abhängigkeiten | Testbar in Millisekunden. Läuft im Browser und auf dem Server. |
| Web | Next.js (App Router) + React | Browserbasiert, Server-Routen für SharePoint/Graph-Aufrufe, ein Deployment. |
| Datenhaltung | SQLite (Dev) → Postgres (Prod) über Drizzle ORM | Offerten, Produkt-DB, Versionen brauchen Historie. Kein Excel als Datenbank mehr. |
| Auth | Microsoft Entra ID (Graphax ist M365) | Login mit Firmenkonto, Rollen «Verkauf» / «Admin». Keine eigenen Passwörter. |
| i18n | JSON-Wörterbücher `de.json` / `fr.json`, Quelle = Blatt «Listen» + Labels | Der Sprachschalter ist ein Zustand, keine zweite App. Genau das Problem der zwei Excel-Dateien. |
| Offerten | Vorlage als DOCX mit Platzhaltern (docxtemplater), PDF via LibreOffice headless | Vorlagen bleiben in Word pflegbar. Textblöcke aus DB, nach Sprache. |
| Dokumente | Adapter `DocumentSource` mit zwei Implementierungen: `LocalFolder`, `SharePointDrive` (Microsoft Graph) | Ein Interface, austauschbar. Kein SharePoint-Code in der UI. |
| Versionierung | Regelwerk mit `gueltig_ab`, jede Offerte speichert die Regelversion | Rückwirkend nachvollziehbar, womit gerechnet wurde. |
| Hosting | Container (Docker), Azure App Service oder Graphax-Server | Ein Image, überall gleich. |

Offen: Hosting-Ort (Azure vs. intern) und ob Entra-SSO möglich ist. Beides vor Phase 3 klären.

## 3. Repo-Struktur

```
kalkulationstool/
  CLAUDE.md                 ← Arbeitsregeln für Claude Code (siehe 5)
  spec/
    excel/                  ← rev1 D + F, Korrekturauftrag.md
    calc-spec.md            ← extrahierte Rechenlogik (Phase 0)
    fixtures/*.json         ← Testfälle: Eingaben + erwartete Werte aus Excel
    glossary.md             ← CIF, LP, Netto VP, Zins, Amort, H14 usw.
  packages/
    calc-engine/            ← Rechenlogik + Tests
    i18n/                   ← de.json, fr.json, Listen
    product-db/             ← CSV-Import, Schema, Suche
    offer-gen/              ← DOCX/PDF
    doc-source/             ← LocalFolder, SharePointDrive
  apps/
    web/                    ← Next.js
  db/                       ← Drizzle-Schema, Migrationen, Seed
  scripts/
    extract-fixtures.py     ← Excel → fixtures (LibreOffice headless)
```

## 4. Phasen

Jede Phase = eigener Branch, eigener Prompt-Satz, Abnahme durch dich.

| Phase | Ergebnis | Abnahme |
|---|---|---|
| 0 Spezifikation | `calc-spec.md`: jede Formel als Regel in Prosa + Pseudocode, Reihenfolge, Sonderfälle (H14, B17, 12 Monate). `glossary.md`. 30–50 Fixtures aus dem Excel generiert. | Du liest die Spec und findest keine Abweichung zum Excel. |
| 1 Engine | `calc-engine` rechnet alle Fixtures korrekt. Regelwerk als Datei mit Version. | `npm test` grün, 100 % Fixtures. |
| 2 Web-Basis | Eingabemaske wie Excel-Blatt, live-Berechnung, DE/FR-Schalter, Login. | Ein Verkäufer rechnet eine echte Offerte nach. |
| 3 Produkt-DB | CSV-Import mit Schema-Prüfung, Suche nach Art.-Nr./Text, Autofill in Positionen. | CSV der aktuellen Preisliste importiert, 5 Artikel geprüft. |
| 4 Offerten | Offerte als DOCX/PDF aus Vorlage, Textblöcke nach Sprache, Speicherung mit Regelversion. | Offerte D und F aus derselben Kalkulation, Layout freigegeben. |
| 5 Dokumente | Ergänzende Dokumente aus Ordner oder SharePoint-URL laden und der Offerte anhängen. | Testordner + Test-Site funktionieren. |
| 6 Admin | Listen, Faktoren, Textblöcke, Vorlagen pflegen. Versionen mit Gültig-ab. Rollen. | Admin ändert einen Faktor, alte Offerte bleibt unverändert. |

Phase 0 und 1 sind das Fundament. Hier nicht sparen. Der Rest ist Standard-Webentwicklung.

## 5. CLAUDE.md (Startfassung)

```markdown
# Kalkulationstool 2.0

## Was das ist
Web-Ablösung des Excel-Kalkulationstools von Graphax für MFP-Offerten
(Kauf / Miete / Leasing, Solutions, Servicepauschalen). DE und FR.

## Wahrheit
- Rechenlogik: spec/calc-spec.md. Bei Zweifel gilt spec/excel/*_rev1_D.xlsx.
- Erwartete Zahlen: spec/fixtures/*.json. Nie ändern, um Tests grün zu machen.
  Abweichung → mir melden, nicht wegtesten.
- Begriffe: spec/glossary.md. Keine eigenen Begriffe erfinden.

## Regeln
- Engine bleibt rein: keine I/O, kein React, keine DB in packages/calc-engine.
- Jede Änderung an der Engine braucht einen Fixture-Test.
- Geldbeträge: Rappen als Integer oder Decimal-Bibliothek. Kein Float.
  Rundung wie Excel: ROUND(x*20,0)/20 = auf 5 Rappen.
- Texte nur über i18n. Kein deutscher oder französischer String im Code.
- Listen (Dropdowns) kommen aus packages/i18n/lists.*.json, nie hart codiert.
- Kleine Commits, ein Thema pro Commit. Conventional Commits.
- Vor jedem Commit: npm run lint && npm test.
- Nichts installieren, ohne es im PR zu begründen.

## Arbeitsweise
- Erst Plan in 5–10 Punkten zeigen, dann bauen.
- Bei Unklarheit in der Spec: fragen, nicht raten.
- Keine Features, die nicht in spec/ oder im Auftrag stehen.

## Befehle
npm run dev | npm test | npm run lint | npm run fixtures (Excel → JSON)
```

## 6. Konkrete Prompts (Reihenfolge)

**Phase 0, Prompt 1**
> Lies spec/excel/Kalkulationstool_Vorlage_Q4-2025_rev1_D.xlsx mit openpyxl (Formeln, nicht Werte). Erstelle spec/calc-spec.md: jede Formelzelle der Blätter Kalkulation, Detail Solutions, Miete Graphax, GE-Leasing als Regel mit Name, Eingaben, Formel in Pseudocode, Excel-Zelle als Referenz. Gruppiere nach Themen: Hardware, Solutions, Dienstleistungen, Finanzierung, Pauschalen, Provision. Sonderfälle explizit: H14, B17, I16-Werte 1–5, 12 Monate. Zeig mir zuerst die Gliederung.

**Phase 0, Prompt 2**
> Schreibe scripts/extract-fixtures.py: setzt definierte Eingaben in eine Kopie des Excel, rechnet mit LibreOffice headless neu, liest die Ergebniszellen aus und schreibt spec/fixtures/NAME.json. Erzeuge 40 Fälle: Kauf/Miete/Leasing × Laufzeiten 24/36/48/60 × mit/ohne Solutions × Vertragswerte 5'000 bis 300'000. Eingabe- und Ergebniszellen laut calc-spec.md.

**Phase 1, Prompt 1**
> Lege packages/calc-engine an. Typen für Eingabe (Input) und Ergebnis (Result) laut calc-spec.md. Implementiere zuerst nur den Block «Hardware» und lass fixtures/kauf_*.json laufen. Zeig mir die Typen, bevor du rechnest.

Weiter Block für Block. Nie «implementiere die ganze Engine».

**Phase 2, Prompt 1**
> Lege apps/web an (Next.js, TypeScript, Tailwind). Eine Seite /kalkulation mit dem Eingabeformular nach dem Layout des Excel-Blatts Kalkulation. Berechnung im Browser über calc-engine bei jeder Eingabe. Sprachschalter DE/FR oben rechts, Texte aus packages/i18n. Noch kein Login, keine DB.

## 7. Produkt-DB und Autofill

- CSV-Schema fix definieren: `artikel_nr, bezeichnung_de, bezeichnung_fr, listenpreis, kalkulationsart, kategorie (HW|SW|Maintenance|DL), function_code, gueltig_ab`.
- Import prüft mit zod: Pflichtfelder, Zahlenformat, Duplikate. Fehlerliste zurück an den Admin, nichts halb importieren.
- Jeder Import = Preislisten-Version mit Datum. Offerte speichert, welche Version galt.
- Autofill: Tippen in Art.-Nr. oder Bezeichnung → Vorschlagsliste → Übernahme füllt Bezeichnung, Listenpreis, Kalkulationsart, Function Code. Manuelles Überschreiben bleibt möglich, wird markiert.

## 8. Offertenerstellung

- Vorlagen als DOCX mit Platzhaltern `{kunde.name}`, `{positionen}`, `{pauschale.monat}`. Pro Sprache eine Vorlage, gleiche Platzhalter.
- Textblöcke in DB: Schlüssel, Sprache, Text, Version. Zuordnung über Regeln (Miete → Block «Mietbedingungen», Leasing → «ZKB-Leasing»).
- Ausgabe: DOCX (bearbeitbar) und PDF (versandfertig). Beide werden mit der Offerte gespeichert.
- Ergänzende Dokumente (Lösungsbeschreibung, SLA, AGB) aus `DocumentSource` anhängen: entweder Unterordner `/<Kunde>/<Offerte>/` oder SharePoint-Ordner-URL, die der Verkäufer in der Offerte hinterlegt.

## 9. Moderation und Versionssicherheit

- Drei Rollen: Verkauf (rechnen, Offerten), Admin (Listen, Faktoren, Texte, Vorlagen, CSV), Read-only (Controlling).
- Alles, was das Rechenergebnis beeinflusst, ist versioniert mit `gueltig_ab` und Bearbeiter: Faktoren, Listen, Kalkulationsarten, Preislisten.
- Offerte = Snapshot: Eingaben + Ergebnis + Versionen aller Regeln. Änderung an Regeln ändert alte Offerten nie.
- Kein Passwortschutz im alten Sinn. Rollen über Entra-Gruppen. Falls kein SSO: einfache Benutzertabelle mit Passwort-Hash, aber nur als Übergang.
- Audit-Log: wer hat wann welchen Faktor geändert. Reicht als Tabelle, kein Framework nötig.

## 10. Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Engine weicht vom Excel ab | Fixtures aus dem Excel, nicht von Hand. Abweichung ist ein Fehler, bis du sie freigibst. |
| Excel-Logik enthält Fehler, die niemand will (B17, 12 Monate) | In calc-spec.md als «bekannte Abweichung» führen, im Code bewusst korrigieren, Fixture anpassen und dokumentieren. |
| SharePoint-Zugriff scheitert an Berechtigungen | Adapter-Muster: LocalFolder zuerst, SharePoint später. App-Registrierung früh bei IT beantragen. |
| Claude Code baut zu viel auf einmal | CLAUDE.md-Regel «Plan zuerst», ein Block pro Prompt, PR-Grösse unter 400 Zeilen. |
| Verkauf akzeptiert die Web-Maske nicht | Phase 2 zeigt das Excel-Layout 1:1. Erst wenn die Zahlen stimmen, das Layout verbessern. |

## 11. Nächste Schritte

1. Repo anlegen, `spec/` mit rev1-Dateien und Korrekturauftrag füllen, CLAUDE.md aus Abschnitt 5 einlegen.
2. Hosting und Entra-SSO mit Graphax-IT klären.
3. Phase 0 starten (Prompt 1). Ergebnis: calc-spec.md zur Durchsicht an dich.
4. Aktuelle Preisliste als CSV beschaffen, Schema aus Abschnitt 7 prüfen.
5. Eine bestehende Offerte als Word-Vorlage D und F auswählen.
