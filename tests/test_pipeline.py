"""Pipeline von Ende zu Ende (Abschnitt 1) und die Abbruchregeln (13.1)."""

from __future__ import annotations

import shutil

import openpyxl
import pytest

from offerttool.errors import OfferteError
from offerttool.pipeline import generiere

from .conftest import CRM_JSON, KALKTOOL, VORLAGE


def dokumenttext(pfad) -> str:
    import docx

    from offerttool.docxutil.xmlutil import W, paragraph_text

    d = docx.Document(str(pfad))
    return "\n".join(paragraph_text(p) for p in d.element.body.iter(W("w:p")))


@pytest.fixture(scope="module")
def offerte(tmp_path_factory):
    ziel = tmp_path_factory.mktemp("out") / "Offerte.docx"
    return generiere([KALKTOOL], VORLAGE, ziel, CRM_JSON, toc_seitenzahlen=False)


def test_dateien_entstehen(offerte):
    assert offerte.offerte.exists()
    assert offerte.protokoll.exists()
    assert offerte.protokoll.name.endswith(".pruefprotokoll.md")


def test_kernwerte_im_dokument(offerte):
    text = dokumenttext(offerte.offerte)
    for erwartet in (
        "Gemeindeverwaltung Birsfelden",
        "Standort 1: Museum",
        "Installationsadresse: Schulstrasse 29 1.OG, 4127 Birsfelden",
        "bizhub C3351i",
        "CHF 0.0320",
        "CHF 0.0050",
        "CHF 3.50",
        "CHF 43.50",
        "CHF 47.00",
        "CHF 300.00",
        "28.07.2026",
        "26.09.2026",
        "01.08.2026",
    ):
        assert erwartet in text, erwartet


def test_gesperrte_werte_fehlen(offerte):
    """Abschnitt 14: insbesondere 2’645, 1’587, 2’024.75, 2’339.75 fehlen."""
    text = dokumenttext(offerte.offerte)
    for verboten in ("2’645", "1’587", "23.45", "2’024.75", "2’339.75"):
        assert verboten not in text, verboten


def test_keine_restplatzhalter(offerte):
    text = dokumenttext(offerte.offerte)
    assert "%%" not in text
    assert "{" not in text


def test_kein_vorlagentext_ueberlebt(offerte):
    """Steuerelemente in Zellen werden aufgelöst (Abschnitt 10.3)."""
    text = dokumenttext(offerte.offerte)
    for rest in ("bizhub C257i", "CHF 5.00", "Standort A", "36 Monaten"):
        assert rest not in text, rest


def test_kaufvariante_fehlt_bei_miete(offerte):
    text = dokumenttext(offerte.offerte)
    assert "Der Mietvertrag tritt am 01.08.2026 in Kraft" in text
    assert "beim Kauf" not in text


def test_gesamttotal_entfaellt_bei_einem_standort(offerte):
    text = dokumenttext(offerte.offerte)
    assert "alle Standorte" not in text


def test_protokoll_nennt_warnungen(offerte):
    inhalt = offerte.protokoll.read_text(encoding="utf-8")
    assert "W308" in inhalt
    assert "W312" in inhalt
    assert "MIETE" in inhalt


def test_determinismus(tmp_path):
    """Gleiche Eingabe -> gleiche Ausgabe (Grundsatz der Spezifikation)."""
    a = generiere([KALKTOOL], VORLAGE, tmp_path / "a.docx", CRM_JSON, toc_seitenzahlen=False)
    b = generiere([KALKTOOL], VORLAGE, tmp_path / "b.docx", CRM_JSON, toc_seitenzahlen=False)
    assert dokumenttext(a.offerte) == dokumenttext(b.offerte)


def _variiere(quelle, ziel, **zellen):
    """Abwandlung des Referenz-Kalktools als Testvorlage.

    ``data_only=True`` friert die zwischengespeicherten Formelergebnisse als
    Literale ein – sonst ginge beim Speichern der Wert jeder Formelzelle
    verloren und schon ``KM!M9`` wäre leer.
    """
    shutil.copy(quelle, ziel)
    wb = openpyxl.load_workbook(ziel, data_only=True)
    ws = wb.worksheets[0]
    for adresse, wert in zellen.items():
        ws[adresse] = wert
    wb.save(ziel)
    return ziel


def test_zwei_standorte(tmp_path):
    zweit = _variiere(KALKTOOL, tmp_path / "Kalktool_Standort2.xlsx", B7="Werkhof")

    ergebnis = generiere(
        [KALKTOOL, zweit], VORLAGE, tmp_path / "zwei.docx", CRM_JSON, toc_seitenzahlen=False
    )
    text = dokumenttext(ergebnis.offerte)
    assert "Standort 1: Museum" in text
    assert "Standort 2: Werkhof" in text
    # Bei mehr als einem Standort erscheint das Gesamttotal (Abschnitt 9).
    assert "Monatspauschale total – alle Standorte" in text
    assert "CHF 94.00" in text  # 2 x 47.00
    assert "CHF 600.00" in text  # 2 x 300.00


def test_kaufvariante(tmp_path):
    kauf = _variiere(KALKTOOL, tmp_path / "kauf.xlsx", I16=1)
    ergebnis = generiere(
        [kauf], VORLAGE, tmp_path / "kauf.docx", CRM_JSON, toc_seitenzahlen=False
    )
    text = dokumenttext(ergebnis.offerte)
    assert "Total Kauf" in text
    assert "CHF 2’339.75" in text  # C62, bei KAUF legitim
    assert "Laufzeit und Kündigungsfrist für Serviceverträge beim Kauf" in text
    assert "Mietpauschale" not in text


def test_e401_bei_unbekannter_finanzierungsart(tmp_path):
    datei = _variiere(KALKTOOL, tmp_path / "e401.xlsx", I16=9)
    with pytest.raises(OfferteError) as exc:
        generiere([datei], VORLAGE, tmp_path / "x.docx", toc_seitenzahlen=False)
    assert exc.value.code == "E401"


def test_e402_bei_verletzter_summenregel(tmp_path):
    datei = _variiere(KALKTOOL, tmp_path / "e402.xlsx", L95=99)
    with pytest.raises(OfferteError) as exc:
        generiere([datei], VORLAGE, tmp_path / "x.docx", toc_seitenzahlen=False)
    assert exc.value.code == "E402"


def test_e413_bei_miete_ohne_pauschale(tmp_path):
    datei = _variiere(KALKTOOL, tmp_path / "e413.xlsx", L92=0, L95=3.5)
    with pytest.raises(OfferteError) as exc:
        generiere([datei], VORLAGE, tmp_path / "x.docx", toc_seitenzahlen=False)
    assert exc.value.code == "E413"


def test_e403_bei_gemischten_varianten(tmp_path):
    zweit = _variiere(KALKTOOL, tmp_path / "e403.xlsx", I16=1)
    with pytest.raises(OfferteError) as exc:
        generiere([KALKTOOL, zweit], VORLAGE, tmp_path / "x.docx", toc_seitenzahlen=False)
    assert exc.value.code == "E403"


def test_e404_bei_verschiedenen_kunden(tmp_path):
    zweit = _variiere(KALKTOOL, tmp_path / "e404.xlsx", B5="Andere Firma AG")
    with pytest.raises(OfferteError) as exc:
        generiere([KALKTOOL, zweit], VORLAGE, tmp_path / "x.docx", toc_seitenzahlen=False)
    assert exc.value.code == "E404"


def test_keine_datei_bei_abbruch(tmp_path):
    """Bricht ein Schritt ab, entsteht keine Datei – nie eine halbe Offerte."""
    datei = _variiere(KALKTOOL, tmp_path / "abbruch.xlsx", I16=9)
    ziel = tmp_path / "nichts.docx"
    with pytest.raises(OfferteError):
        generiere([datei], VORLAGE, ziel, toc_seitenzahlen=False)
    assert not ziel.exists()
