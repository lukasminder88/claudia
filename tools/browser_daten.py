#!/usr/bin/env python3
"""Erzeugt die generierten Quelldateien der Browser-Fassung.

Mapping und Vorlage haben genau eine Quelle: die YAML und die präparierte
.docx.  Beides wird hier nach JavaScript übersetzt, damit die Browser-Fassung
nicht auseinanderläuft.  Die erzeugten Dateien werden nicht von Hand bearbeitet.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

import yaml

WURZEL = Path(__file__).resolve().parent.parent
QUELLE = WURZEL / "browser" / "src"

KOPF = "/* Erzeugt von tools/browser_daten.py – nicht von Hand bearbeiten. */\n"


def mapping_schreiben() -> Path:
    daten = yaml.safe_load(
        (WURZEL / "offerttool" / "resources" / "mapping_q4_2025.yaml").read_text("utf-8")
    )
    ziel = QUELLE / "30-mapping.js"
    ziel.write_text(
        KOPF
        + "/* Mapping der Kalktool-Version "
        + daten["version"]
        + " (Abschnitt 15).\n"
        + "   Im Code steht keine Zelladresse; sie stehen alle hier. */\n"
        + "const MAPPING = "
        + json.dumps(daten, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    return ziel


def vorlage_schreiben() -> Path:
    docx = WURZEL / "offerttool" / "resources" / "Offerte_anchored.docx"
    if not docx.exists():
        raise SystemExit("Die ankerbasierte Vorlage fehlt. Zuerst 'offerttool prepare'.")
    b64 = base64.b64encode(docx.read_bytes()).decode("ascii")
    zeilen = [b64[i : i + 100] for i in range(0, len(b64), 100)]
    ziel = QUELLE / "50-vorlage.js"
    ziel.write_text(
        KOPF
        + "/* Die ankerbasierte Vorlage, eingebettet – damit die Seite ohne\n"
        + "   Netzwerkzugriff auskommt und als einzelne Datei funktioniert. */\n"
        + "const VORLAGE_BASE64 = [\n"
        + ",\n".join(f'  "{z}"' for z in zeilen)
        + "\n].join('');\n",
        encoding="utf-8",
    )
    return ziel


def main() -> int:
    for pfad in (mapping_schreiben(), vorlage_schreiben()):
        print(f"{pfad.relative_to(WURZEL)}  ({pfad.stat().st_size / 1024:.0f} kB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
