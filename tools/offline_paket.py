#!/usr/bin/env python3
"""Schnürt das Offline-Paket der Browser-Fassung.

Ergebnis ist ein ZIP, das auf einem Rechner **ohne Internetzugang** entpackt
und per Doppelklick geöffnet werden kann.  Es braucht weder Python noch eine
Installation noch einen Server: die Offerte entsteht vollständig im Browser.

    python tools/browser_bauen.py && python tools/offline_paket.py
"""

from __future__ import annotations

import argparse
import shutil
import zipfile
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent

LIESMICH = """# Offerttool – Offline-Paket

Erzeugt aus einem Kalktool (`.xlsx`) eine fertige Offerte (`.docx`).
Regelbasiert, ohne KI: gleiche Eingabe ergibt gleiche Ausgabe.

## Loslegen

**`Offerttool.html` doppelklicken.** Mehr ist nicht nötig.

Es wird nichts installiert, nichts gestartet und nichts übertragen. Die Seite
rechnet vollständig im Browser; weder das Kalktool noch die Offerte verlassen
diesen Rechner. Ein Netzwerkzugang wird nicht gebraucht.

## Bedienung

1. Kalktool in das Feld ziehen (oder klicken und auswählen).
   Bei mehreren Standorten alle Kalktools wählen und die Reihenfolge mit den
   Pfeilen setzen – **die Reihenfolge ist die Reihenfolge der Standorte im
   Dokument.**
2. Die CRM-Felder sind freiwillig. Leer gelassene Felder erzeugen keine leere
   Zeile im Dokument. Fehlt die Offertnummer, tritt die Verkaufschance an ihre
   Stelle.
3. **Werte prüfen** zeigt, was aus dem Kalktool gelesen wird, ohne ein Dokument
   zu erzeugen. **Offerte erzeugen** liefert Offerte und Prüfprotokoll.

Zum Ausprobieren liegt unter `beispiel/` das Kalktool Birsfelden bei.

## Was Sie wissen sollten

**Seitenzahlen im Inhaltsverzeichnis** trägt Word beim Öffnen selbst ein – der
Browser kann sie nicht vorausberechnen. Das Verzeichnis ist vollständig und
richtig nummeriert; nur die Zahlen erscheinen erst beim ersten Öffnen in Word.
Deshalb meldet die Seite immer die Warnung `W321`.

**Abbrüche.** Stimmt etwas im Kalktool nicht, bricht der Generator mit einem
Fehlercode ab und erzeugt **keine** Datei – nie eine halbe Offerte. Der Code
steht im Klartext in der Seite, zum Beispiel `E401` für eine unbekannte
Finanzierungsart.

**Warnungen** stehen in der Seite und im Prüfprotokoll, nie im Dokument selbst.

**Marge, CIF und Kalkulationsfaktoren** aus dem Kalktool werden weder gelesen
noch ausgegeben. Vor dem Herunterladen prüft die Seite den fertigen Text noch
einmal gegen diese Werte.

## Browser

Chrome oder Edge ab Version 103, Firefox ab 113, Safari ab 16.4.
Ältere Browser meldet die Seite beim Öffnen.

## Grenzen dieses Standes

- Das Kalktool muss die Version **{version}** sein. Andere Versionen brauchen
  eine angepasste Zuordnung der Zellen.
- Die Hardwaretabelle zeigt keine Artikelnummern und keine Zeilenpreise: das
  Kalktool führt diese Spalten nicht. Die Stückzahl ist fix 1 und wird gegen
  die Summe der Listenpreise plausibilisiert.
"""


def baue(ziel: Path) -> Path:
    seite = WURZEL / "dist" / "Offerttool.html"
    if not seite.exists():
        raise SystemExit(
            "dist/Offerttool.html fehlt. Zuerst: python tools/browser_bauen.py"
        )

    import json

    mapping = json.loads(
        (WURZEL / "browser" / "src" / "30-mapping.js").read_text("utf-8")
        .split("const MAPPING = ", 1)[1].rsplit(";", 1)[0]
    )

    name = "Offerttool-PoC"
    arbeit = ziel / name
    if arbeit.exists():
        shutil.rmtree(arbeit)
    (arbeit / "beispiel").mkdir(parents=True)

    shutil.copy(seite, arbeit / "Offerttool.html")
    shutil.copy(
        WURZEL / "examples" / "Kalktool_Birsfelden_C3351i.xlsx", arbeit / "beispiel"
    )
    (arbeit / "LIESMICH.md").write_text(
        LIESMICH.format(version=mapping["version"]), encoding="utf-8"
    )

    archiv = ziel / f"{name}.zip"
    if archiv.exists():
        archiv.unlink()
    with zipfile.ZipFile(archiv, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for pfad in sorted(arbeit.rglob("*")):
            if pfad.is_file():
                eintrag = zipfile.ZipInfo(str(Path(name) / pfad.relative_to(arbeit)))
                eintrag.date_time = (2026, 1, 1, 0, 0, 0)  # gleiche Eingabe, gleiches ZIP
                eintrag.compress_type = zipfile.ZIP_DEFLATED
                eintrag.external_attr = 0o644 << 16
                z.writestr(eintrag, pfad.read_bytes())
    shutil.rmtree(arbeit)
    return archiv


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ziel", type=Path, default=WURZEL / "dist")
    args = p.parse_args()
    args.ziel.mkdir(parents=True, exist_ok=True)
    archiv = baue(args.ziel)
    print(f"{archiv.relative_to(WURZEL)}  ({archiv.stat().st_size / 1024:.0f} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
