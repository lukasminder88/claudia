#!/usr/bin/env python3
"""Fügt die Browser-Fassung zu einer einzelnen HTML-Datei zusammen.

``file://`` blockiert ES-Module, deshalb muss alles in einer Datei liegen,
damit ein Doppelklick genügt.  Entwickelt wird in ``browser/src``; hier
entsteht daraus ``dist/Offerttool.html``.

    python tools/browser_bauen.py
"""

from __future__ import annotations

import argparse
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
QUELLE = WURZEL / "browser" / "src"


def teile() -> list[Path]:
    """Quelldateien in ihrer Ladereihenfolge (Präfix im Dateinamen)."""
    return sorted(QUELLE.glob("*.js"), key=lambda p: p.name)


def bauen(ziel: Path, rahmen: Path, skripte: list[Path]) -> Path:
    seite = rahmen.read_text(encoding="utf-8")
    css = (QUELLE.parent / "stil.css").read_text(encoding="utf-8")

    code = []
    for pfad in skripte:
        code.append(f"/* ===== {pfad.name} ===== */")
        code.append(pfad.read_text(encoding="utf-8"))
    js = "\n\n".join(code)

    # In einem <script>-Block darf "</script>" nicht vorkommen.
    js = js.replace("</script>", "<\\/script>")

    seite = seite.replace("/*STIL*/", css)
    seite = seite.replace("/*SKRIPT*/", js)

    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(seite, encoding="utf-8")
    return ziel


def _kurz(pfad: Path) -> str:
    try:
        return str(pfad.relative_to(WURZEL))
    except ValueError:
        return str(pfad)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--ziel", type=Path, default=WURZEL / "dist" / "Offerttool.html")
    p.add_argument("--rahmen", type=Path, default=WURZEL / "browser" / "rahmen.html")
    p.add_argument("--test", action="store_true", help="zusätzlich die Prüfseite bauen")
    args = p.parse_args()

    skripte = teile()
    ziel = bauen(args.ziel, args.rahmen, skripte)
    print(f"{_kurz(ziel)}  ({ziel.stat().st_size / 1024:.0f} kB, "
          f"{len(skripte)} Quelldateien)")

    if args.test:
        # Die Prüfseite bringt ihre eigene Oberfläche mit und lädt darum
        # 60-app.js nicht.
        ohne_oberflaeche = [s for s in skripte if s.name != "60-app.js"]
        pruef = bauen(
            args.ziel.parent / "Pruefung.html",
            WURZEL / "browser" / "test" / "rahmen.html",
            ohne_oberflaeche + [WURZEL / "browser" / "test" / "golden.js"],
        )
        print(f"{_kurz(pruef)}  ({pruef.stat().st_size / 1024:.0f} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
