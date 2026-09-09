#!/usr/bin/env python3
"""Fixtures aus dem Excel erzeugen (Phase 0, Prompt 2 des Vorgehens).

Setzt definierte Eingaben in eine Kopie von
spec/excel/Kalkulationstool_Vorlage_Q42025_rev1_D.xlsx, laesst LibreOffice
headless neu rechnen, liest die Ergebniszellen aus und schreibt
spec/fixtures/NAME.json.

Die erwarteten Zahlen stammen damit aus dem Excel und nie aus der Engine.
Weicht die Engine ab, ist die Engine falsch - nicht die Fixture.

Voraussetzung: libreoffice-calc, python3 mit openpyxl.
Aufruf:        python3 scripts/extract_fixtures.py
"""

from __future__ import annotations

import csv
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
VORLAGE = ROOT / "spec" / "excel" / "Kalkulationstool_Vorlage_Q42025_rev1_D.xlsx"
FIXTURES = ROOT / "spec" / "fixtures"

# CSV-Export von LibreOffice: alle Blaetter, Rohwerte statt formatierter Anzeige.
# Reihenfolge der Token siehe LibreOffice-Filteroptionen "Text - txt - csv (StarCalc)".
CSV_FILTER = (
    "csv:Text - txt - csv (StarCalc):"
    "44,"      # Feldtrenner ,
    "34,"      # Texttrenner "
    "76,"      # Zeichensatz UTF-8
    "1,"       # erste Zeile
    ","        # Zellformate
    "0,"       # Sprache
    "false,"   # Feld in Anfuehrungszeichen als Text
    "true,"    # Sonderzahlen erkennen
    "false,"   # Zellinhalt wie angezeigt  -> false = volle Genauigkeit
    "false,"   # Formeln exportieren
    "false,"   # Leerzeichen entfernen
    "-1"       # alle Blaetter
)

# ---------------------------------------------------------------- Zelladressen


def spalte_zu_index(spalte: str) -> int:
    idx = 0
    for zeichen in spalte:
        idx = idx * 26 + (ord(zeichen) - ord("A") + 1)
    return idx - 1


def zelle_zerlegen(adresse: str) -> tuple[int, int]:
    """'L92' -> (Zeilenindex 91, Spaltenindex 11), beide 0-basiert."""
    buchstaben = "".join(z for z in adresse if z.isalpha())
    ziffern = "".join(z for z in adresse if z.isdigit())
    return int(ziffern) - 1, spalte_zu_index(buchstaben)


# ------------------------------------------------------------- Ergebniszellen
# Jede Ergebniszelle bekommt den Namen, unter dem die Engine sie fuehrt.
# Referenz: spec/calc-spec.md

ERGEBNISZELLEN: dict[str, dict[str, str]] = {
    "Kalkulation": {
        # Hardware
        "hardware.totalListenpreis": "C53",
        "hardware.totalCif": "E53",
        "hardware.nettoVerkaufspreis": "E54",
        "hardware.marge": "C54",
        "hardware.margeProzent": "B54",
        "hardware.margeAlt": "C55",
        "hardware.margeAltProzent": "B55",
        "hardware.supportListenpreis": "C47",
        # Solutions Software / Hardware
        "solutions.software.totalListenpreis": "I31",
        "solutions.software.totalCif": "K31",
        "solutions.software.nettoVerkaufspreis": "L32",
        "solutions.software.marge": "I32",
        "solutions.software.amortisationBasis": "M31",
        # Solutions Maintenance
        "solutions.maintenance.totalListenpreis": "I38",
        "solutions.maintenance.totalCif": "K38",
        "solutions.maintenance.nettoVerkaufspreis": "L39",
        "solutions.maintenance.marge": "I39",
        "solutions.maintenance.inVerkaufMiete": "J41",
        "solutions.maintenance.inMonatspauschale": "L41",
        "solutions.maintenance.amortisationBasis": "M39",
        # Solutions Dienstleistungen
        "solutions.dienstleistungen.totalStunden": "I45",
        "solutions.dienstleistungen.nettoVerkaufspreis": "L49",
        "solutions.dienstleistungen.marge": "I49",
        "solutions.dienstleistungen.finanziert": "L51",
        "solutions.dienstleistungen.korrekturCif": "K52",
        "solutions.dienstleistungen.amortisationBasis": "M51",
        # Vertragswert
        "total.cif": "C57",
        "total.marge": "C58",
        "total.margeProzent": "B58",
        "total.nettoVerkaufspreis": "C59",
        "total.restwertAltvertrag": "C60",
        "total.eingerechneteDienstleistungen": "C61",
        "total.vertragswert": "C62",
        "total.margeVonUnten": "B63",
        "total.rabattLpHardware": "B64",
        "total.rabattLpSoftware": "B65",
        "altvertrag.restwert": "M21",
        # Finanzierung
        "finanzierung.faktor": "H83",
        "finanzierung.faktorMiete": "L83",
        "finanzierung.faktorLeasing": "L84",
        "finanzierung.zinsfaktor": "L89",
        "finanzierung.amortisationsdauer": "H14",
        "finanzierung.provisionSofortFakturiert": "G15",
        # Amortisation und Zinsen
        "amortisation.altvertrag": "H86",
        "amortisation.diverses": "I86",
        "amortisation.hardware": "J86",
        "amortisation.solutionSoftware": "H88",
        "amortisation.solutionMaintenance": "I88",
        "amortisation.solutionDienstleistungen": "J88",
        "zinsen.hardware": "L86",
        "zinsen.solutionSoftware": "H90",
        "zinsen.solutionMaintenance": "I90",
        "zinsen.solutionDienstleistungen": "J90",
        "zinsen.solutionTotal": "L88",
        "amortisation.solutionTotal": "M88",
        # Monatspauschalen
        "pauschalen.sw": "H58",
        "pauschalen.color": "H63",
        "pauschalen.scan": "H68",
        "pauschalen.totalMonatspauschalen": "M70",
        "ergebnis.grundpauschale": "L92",
        "ergebnis.servicepauschaleSolution": "L93",
        "ergebnis.servicepauschaleGeraet": "L94",
        "ergebnis.monatspauschaleTotal": "L95",
        # Provision
        "provision.umsatzSolutionFakturiert": "M72",
        "provision.umsatzDienstleistungFakturiert": "M74",
        "provision.umsatzSolution": "J78",
        "provision.margeTotal": "K78",
        "provision.umsatzTotal": "M78",
    },
    "Detail Solutions": {
        "detail.software.totalListenpreis": "E39",
        "detail.software.totalCif": "G39",
        "detail.software.nettoPreis": "H39",
        "detail.maintenance.totalListenpreis": "E57",
        "detail.maintenance.totalCif": "G57",
        "detail.maintenance.nettoPreis": "H57",
        "detail.dienstleistungen.totalStunden": "A71",
        "detail.dienstleistungen.total": "H71",
    },
}


# ------------------------------------------------------------------ Ausfuehren


def excel_rechnen(eingaben: dict[str, dict[str, object]], arbeitsordner: Path) -> dict[str, list[list[str]]]:
    """Eingaben setzen, LibreOffice rechnen lassen, Blaetter als Raster zurueck.

    openpyxl speichert ohne zwischengespeicherte Ergebnisse. LibreOffice muss
    deshalb jede Formel neu rechnen - unabhaengig von der Einstellung
    "Berechnung beim Laden".
    """
    ziel = arbeitsordner / "fall.xlsx"
    shutil.copyfile(VORLAGE, ziel)

    mappe = openpyxl.load_workbook(ziel)
    for blattname, zellen in eingaben.items():
        blatt = mappe[blattname]
        for adresse, wert in zellen.items():
            blatt[adresse] = wert
    # Prozent- und Waehrungsformate zurueckstellen: der CSV-Export von
    # LibreOffice schreibt sonst "34.5455%" statt des vollen Zahlenwerts.
    for blattname, zuordnung in ERGEBNISZELLEN.items():
        blatt = mappe[blattname]
        for adresse in zuordnung.values():
            blatt[adresse].number_format = "General"
    mappe.save(ziel)

    ausgabe = arbeitsordner / "csv"
    ausgabe.mkdir(exist_ok=True)
    profil = arbeitsordner / "loprofil"
    ergebnis = subprocess.run(
        [
            "soffice", "--headless", "--norestore",
            f"-env:UserInstallation=file://{profil}",
            "--convert-to", CSV_FILTER,
            "--outdir", str(ausgabe), str(ziel),
        ],
        capture_output=True, text=True, timeout=300,
    )
    if "Error" in ergebnis.stdout or "Error" in ergebnis.stderr:
        raise RuntimeError(f"LibreOffice: {ergebnis.stdout}{ergebnis.stderr}")

    raster: dict[str, list[list[str]]] = {}
    for datei in ausgabe.glob("fall-*.csv"):
        blattname = datei.stem[len("fall-"):]
        with datei.open(encoding="utf-8", newline="") as fh:
            raster[blattname] = list(csv.reader(fh))
    return raster


def wert_lesen(raster: list[list[str]], adresse: str) -> float | str | None:
    zeile, spalte = zelle_zerlegen(adresse)
    if zeile >= len(raster) or spalte >= len(raster[zeile]):
        return None
    roh = raster[zeile][spalte].strip()
    if roh == "":
        return None
    try:
        return float(roh)
    except ValueError:
        pass
    # Einzelne Zellen exportiert LibreOffice trotz zurueckgesetztem Format als
    # Prozenttext ("2.3393%"). Zurueck auf den Zahlenwert.
    if roh.endswith("%"):
        try:
            return float(roh[:-1]) / 100.0
        except ValueError:
            pass
    return roh


def fixture_erzeugen(name: str, beschreibung: str, eingaben: dict, arbeitsordner: Path) -> dict:
    raster = excel_rechnen(eingaben, arbeitsordner)
    erwartet: dict[str, float | str | None] = {}
    for blattname, zuordnung in ERGEBNISZELLEN.items():
        for schluessel, adresse in zuordnung.items():
            erwartet[schluessel] = wert_lesen(raster[blattname], adresse)
    return {
        "name": name,
        "beschreibung": beschreibung,
        "quelle": VORLAGE.name,
        "eingabezellen": eingaben,
        "erwartet": erwartet,
    }


def main() -> int:
    from faelle import FAELLE  # noqa: PLC0415 - liegt neben diesem Skript

    if not VORLAGE.exists():
        print(f"Vorlage fehlt: {VORLAGE}", file=sys.stderr)
        return 1
    FIXTURES.mkdir(parents=True, exist_ok=True)

    nur = sys.argv[1:] or None
    with tempfile.TemporaryDirectory() as tmp:
        arbeitsordner = Path(tmp)
        for nummer, (name, beschreibung, eingaben) in enumerate(FAELLE, start=1):
            if nur and name not in nur:
                continue
            fixture = fixture_erzeugen(name, beschreibung, eingaben, arbeitsordner)
            ziel = FIXTURES / f"{name}.json"
            ziel.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"[{nummer:2d}/{len(FAELLE)}] {name}")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    raise SystemExit(main())
