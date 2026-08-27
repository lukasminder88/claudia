from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
KALKTOOL = ROOT / "examples" / "Kalktool_Birsfelden_C3351i.xlsx"
CRM_JSON = ROOT / "examples" / "crm_birsfelden.json"
MAPPING = ROOT / "offerttool" / "resources" / "mapping_q4_2025.yaml"
VORLAGE = ROOT / "offerttool" / "resources" / "Offerte_anchored.docx"
ROH_MIETE = ROOT / "templates" / "Offerte_deCH_Miete.docx"
ROH_KAUF = ROOT / "templates" / "Offerte_deCH_Kauf.docx"


@pytest.fixture(scope="session")
def mapping():
    from offerttool.mapping import load_mapping

    return load_mapping(MAPPING)


@pytest.fixture
def warn():
    from offerttool.errors import WarningCollector

    return WarningCollector()


@pytest.fixture(scope="session")
def birsfelden():
    """Kontext und Ableitung des Referenzfalls (Abschnitt 14)."""
    from offerttool.derive import derive
    from offerttool.errors import WarningCollector
    from offerttool.extract import extract
    from offerttool.mapping import load_mapping
    from offerttool.workbook import Kalktool

    m = load_mapping(MAPPING)
    w = WarningCollector()
    with Kalktool(KALKTOOL, m, w) as kt:
        ctx = extract(kt, m, w)
    ctx.index = 1
    return ctx, derive(ctx, w), w, m


@pytest.fixture
def abweichendes_kalktool(tmp_path):
    """Baut aus dem Referenzfall ein Kalktool mit kleinen Abweichungen.

    Die Vorlagen im Feld unterscheiden sich in Kleinigkeiten: eine ältere
    Versionsangabe, leere Standortfelder, Kontaktdaten mit Komma statt
    Leerzeichen, „dito“ als Standortname.  Der Fixture erzeugt genau solche
    Abweichungen, damit dafür keine echten Kundendateien im Repository
    liegen müssen.

    Aufruf: ``abweichendes_kalktool({"KM!C1": "Version: 2024.03"})``.
    """
    import openpyxl

    def bauen(zellen: dict) -> Path:
        # data_only: die Formeln werden durch ihre zwischengespeicherten Werte
        # ersetzt, sonst läse der Generator nach dem Speichern nur noch None.
        wb = openpyxl.load_workbook(KALKTOOL, data_only=True)
        for adresse, wert in zellen.items():
            blatt, a1 = adresse.split("!")
            index = {"KM": 0, "SOL": 1}[blatt]
            wb[wb.sheetnames[index]][a1] = wert
        ziel = tmp_path / "Kalktool_abweichend.xlsx"
        wb.save(ziel)
        return ziel

    return bauen
