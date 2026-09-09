#!/usr/bin/env python3
"""Dropdown-Listen aus dem Blatt "Listen" nach src/i18n/listen.de.json ziehen.

Die Listen sind im Excel als benannte Bereiche definiert. Sie werden nicht von
Hand abgeschrieben, damit eine Aenderung im Excel hier sichtbar wird.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
VORLAGE = ROOT / "spec" / "excel" / "Kalkulationstool_Vorlage_Q42025_rev1_D.xlsx"
ZIEL = ROOT / "src" / "i18n" / "listen.de.json"

# Listen, die die Web-Maske braucht. Der Rest des Blatts bleibt vorerst aussen vor.
GEBRAUCHT = [
    "lstJaNein", "lstFaktLeasing", "lstFakturierung", "lstLaufzeit",
    "lstKalkHW", "lstKalkSW", "lstClickType", "lstSLA", "lstFleet",
    "lstBusinessType", "lstVertragsart", "lstAnlieferung", "lstFaktGebuehren",
    "lstMehrseitenColor", "lstMehrseitenSW", "lstMehrscan", "lstLabelPauschale",
]

BEREICH = re.compile(r"^Listen!\$([A-Z]+)\$(\d+):\$([A-Z]+)\$(\d+)$")


def main() -> int:
    mappe = openpyxl.load_workbook(VORLAGE)
    blatt = mappe["Listen"]
    listen: dict[str, list] = {}

    for name in GEBRAUCHT:
        treffer = BEREICH.match(mappe.defined_names[name].value)
        if treffer is None:
            raise ValueError(f"Unerwarteter Bereich fuer {name}")
        spalte, von, _, bis = treffer.group(1), int(treffer.group(2)), treffer.group(3), int(treffer.group(4))
        werte = []
        for zeile in range(von, bis + 1):
            wert = blatt[f"{spalte}{zeile}"].value
            if wert is not None:
                werte.append(wert)
        listen[name] = werte

    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    ZIEL.write_text(json.dumps(listen, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for name, werte in listen.items():
        print(f"{name:22s} {werte}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
