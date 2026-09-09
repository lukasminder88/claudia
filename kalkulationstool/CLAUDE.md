# Kalkulationstool 2.0

## Was das ist

Web-Ablösung des Excel-Kalkulationstools für MFP-Offerten (Kauf / Miete /
Leasing, Solutions, Servicepauschalen). Deutsch und Französisch.

Stand: Machbarkeitsnachweis. Umgesetzt sind Phase 0 (Spezifikation und
Fixtures), Phase 1 (Rechenkern) und Phase 2 (Eingabemaske mit Live-Berechnung
und Sprachschalter) aus `spec/Vorgehen.md`. Produkt-Datenbank, Offerten-Ausgabe,
Dokumentenanbindung, Anmeldung und Admin sind nicht gebaut.

## Wahrheit

- Rechenlogik: `spec/calc-spec.md`. Bei Zweifel gilt
  `spec/excel/Kalkulationstool_Vorlage_Q42025_rev1_D.xlsx`.
- Erwartete Zahlen: `spec/fixtures/*.json`. Nie ändern, um Tests grün zu machen.
  Die Dateien werden aus dem Excel erzeugt, nicht von Hand geschrieben:
  `npm run fixtures` (braucht `libreoffice-calc` und `openpyxl`).
  Abweichung → melden, nicht wegtesten.
- Begriffe: `spec/glossary.md`. Keine eigenen Begriffe erfinden.
- Faktoren: `src/engine/regelwerk.ts`, versioniert mit `gueltigAb`.

## Regeln

- `src/engine` bleibt rein: keine I/O, kein DOM, keine Datenbank, keine
  Abhängigkeiten.
- Jede Änderung an der Engine braucht einen Fixture-Test.
- Rundung wie Excel: `aufFuenfRappen(x)` = `ROUND(x*20,0)/20`. Gerechnet wird in
  Doubles wie im Excel – Begründung in `spec/calc-spec.md`, Abweichung 4.
- Texte nur über `src/i18n`. Kein deutscher oder französischer String im Code.
- Dropdown-Listen kommen aus `src/i18n/listen.de.json`, erzeugt aus dem Blatt
  «Listen» über `python3 scripts/extract_listen.py`. Nie hart codiert.
- Kleine Commits, ein Thema pro Commit.
- Vor jedem Commit: `npm run lint && npm test`.
- Nichts installieren, ohne es zu begründen.

## Arbeitsweise

- Erst Plan in 5–10 Punkten zeigen, dann bauen.
- Bei Unklarheit in der Spezifikation: fragen, nicht raten.
- Keine Features, die nicht in `spec/` oder im Auftrag stehen.

## Befehle

```
npm run dev        Entwicklungsserver
npm test           Fixtures gegen die Engine
npm run lint       Typprüfung
npm run build      Produktionsbau nach dist/
npm run fixtures   Excel → spec/fixtures/*.json (LibreOffice headless)
```
