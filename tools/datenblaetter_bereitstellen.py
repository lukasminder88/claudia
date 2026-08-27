#!/usr/bin/env python3
"""Gerätedatenblätter für die Browser-Fassung neben der Seite bereitstellen.

Die Seite lädt dann nur das eine gebrauchte Datenblatt statt aller – die
HTML-Datei bleibt klein, und die 4,8 MB liegen nicht in ihr drin.

    python tools/datenblaetter_bereitstellen.py            # aus datenblaetter/
    python tools/datenblaetter_bereitstellen.py --quelle X

**Die Dateien werden damit über den Webserver abrufbar.** Datenblätter sind
Geschäftsunterlagen; wer sie nicht offen im Netz haben will, schützt das
Netlify-Projekt unter «Site configuration → Access control». Das Zielverzeichnis
steht in der .gitignore, es landet also nicht versehentlich im Repository.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WURZEL))

from offerttool.hardware import Bibliothek  # noqa: E402


def bereitstellen(quelle: Path, ziel: Path) -> int:
    bibliothek = Bibliothek.laden(quelle)
    if not len(bibliothek):
        raise SystemExit(f"Keine Datenblätter in {quelle}")

    if ziel.exists():
        shutil.rmtree(ziel)
    ziel.mkdir(parents=True)

    eintraege = []
    for blatt in bibliothek.blaetter:
        # Flacher Dateiname: die Seite holt sie über einen einfachen Pfad.
        name = blatt.pfad.name
        shutil.copy(blatt.pfad, ziel / name)
        eintraege.append({"modell": blatt.modell, "datei": name})

    (ziel / "index.json").write_text(
        json.dumps({"datenblaetter": eintraege}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return len(eintraege)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--quelle", type=Path, default=WURZEL / "datenblaetter")
    p.add_argument("--ziel", type=Path, default=WURZEL / "public" / "datenblaetter")
    args = p.parse_args()

    anzahl = bereitstellen(args.quelle, args.ziel)
    groesse = sum(f.stat().st_size for f in args.ziel.rglob("*") if f.is_file())
    print(f"{anzahl} Datenblätter nach {args.ziel} ({groesse / 1024 / 1024:.1f} MB)")
    print("Hinweis: über den Webserver abrufbar – Zugriffsschutz prüfen.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
