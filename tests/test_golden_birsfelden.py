"""Golden Record – Referenzfall Birsfelden (Spezifikation V3, Abschnitt 14).

Weicht ein Wert ab, ist der Generator defekt.
"""

from __future__ import annotations

import datetime as dt

import pytest

from offerttool import textblocks as T
from offerttool.formatters import chf, date_de, rate


def test_variante_ist_miete(birsfelden):
    ctx, d, _w, _m = birsfelden
    assert ctx.get("finanzierungsart") == 2
    assert d.variante == "MIETE"
    assert d.vertragsart_wort == "Mietvertrag"


def test_laufzeit(birsfelden):
    ctx, _d, _w, _m = birsfelden
    assert int(ctx.num("laufzeit")) == 60


def test_kunde(birsfelden):
    ctx, _d, _w, _m = birsfelden
    assert ctx.text("kunde.firma") == "Gemeindeverwaltung Birsfelden"
    assert ctx.get("kunde.plz_ort") == {"plz": "4127", "ort": "Birsfelden"}


def test_kontakt(birsfelden):
    ctx, _d, _w, _m = birsfelden
    k = ctx.get("kunde.kontakt")
    assert k["vorname"] == "Tom"
    assert k["nachname"] == "Wiedmer"
    assert k["email"] == "tom.wiedmer@birsfelden.ch"
    assert k["telefon"] == "061 317 33 48"


def test_standort(birsfelden):
    ctx, _d, _w, _m = birsfelden
    assert ctx.index == 1
    assert ctx.text("standort.name") == "Museum"
    assert T.head_standort(ctx) == "Standort 1: Museum"
    assert (
        T.line_adresse(ctx)
        == "Installationsadresse: Schulstrasse 29 1.OG, 4127 Birsfelden"
    )


def test_datum_und_gueltigkeit(birsfelden):
    ctx, d, _w, _m = birsfelden
    assert date_de(ctx.get("datum")) == "28.07.2026"
    assert date_de(d.gueltig_bis) == "26.09.2026"
    assert d.gueltig_bis == dt.date(2026, 9, 26)


def test_hardware_ohne_preise(birsfelden):
    ctx, d, _w, _m = birsfelden
    hardware = ctx.listen["hardware"]
    assert [p.bezeichnung for p in hardware] == ["bizhub C3351i", "PF-P27", "DK-P04"]
    assert {p.stueck for p in hardware} == {"1"}
    assert {p.artnr for p in hardware} == {"–"}
    # Das Kalktool Q4 2025 führt keine Zeilenpreise (Abschnitt 5.5).
    assert d.show["hardware_preise"] is False


def test_schalter_color_und_sw(birsfelden):
    ctx, d, _w, _m = birsfelden
    # volumen.color = 0, preis.color = 0.032: die V2-Regel hätte den
    # Farbklickpreis unterschlagen (Abschnitt 5.2).
    assert ctx.num("volumen.color") == 0
    assert d.show["color"] is True
    assert d.show["sw"] is True


def test_klickpreise(birsfelden):
    ctx, _d, _w, _m = birsfelden
    assert rate(ctx.num("preis.color")) == "CHF 0.0320"
    assert rate(ctx.num("preis.sw")) == "CHF 0.0050"


def test_servicepreis_geraet(birsfelden):
    ctx, _d, _w, _m = birsfelden
    assert chf(ctx.num("service.geraet")) == "CHF 3.50"


def test_sla_ohne_betrag(birsfelden):
    ctx, d, _w, _m = birsfelden
    assert d.sla_kurz == "Premium"
    assert ctx.num("sla.preis") == 0
    # Ist sla.preis 0, erscheint kein Betrag – der SLA steckt in service.geraet.
    zeilen = T.service_zeilen(ctx, d)
    sla_zeile = [t for t in zeilen[0][0] if t.startswith("Service Level Agreement")]
    assert sla_zeile == ["Service Level Agreement: Premium"]
    assert zeilen[0][1] == ["CHF 3.50"]


def test_dienstleistung_nur_verrechnete_spalte(birsfelden):
    ctx, d, _w, _m = birsfelden
    positionen = ctx.listen["dienstleistung"]
    betraege = sorted(float(p.betrag) for p in positionen)
    assert betraege == [120.0, 180.0]
    assert chf(d.dienstleistung_total) == "CHF 300.00"


def test_dienstleistung_ohne_finanzierte_positionen(birsfelden):
    """200.00 Transport und 115.00 Bereitstellung stehen in Spalte B."""
    ctx, _d, _w, _m = birsfelden
    betraege = {float(p.betrag) for p in ctx.listen["dienstleistung"]}
    assert 200.0 not in betraege
    assert 115.0 not in betraege
    bezeichnungen = " ".join(p.bezeichnung for p in ctx.listen["dienstleistung"])
    assert "Transport" not in bezeichnungen
    assert "Bereitstellung" not in bezeichnungen


def test_total_zeilen(birsfelden):
    ctx, d, _w, _m = birsfelden
    zeilen = T.total_zeilen(ctx, d)
    assert zeilen[0] == (
        "Mietpauschale pro Monat (ohne Service) bei einer Laufzeit von 60 Monaten",
        "CHF 43.50",
    )
    assert zeilen[1] == ("Monatspauschale total inkl. Service", "CHF 47.00")


def test_doppelzaehlungssperre(birsfelden):
    """L95 = L92 + L93 + L94 (Abschnitt 5.4)."""
    ctx, _d, _w, _m = birsfelden
    summe = (
        ctx.num("pauschale_ohne_service")
        + ctx.num("service.solution")
        + ctx.num("service.geraet")
    )
    assert abs(ctx.num("monatspauschale_total") - summe) <= 0.01


def test_vertragsbeginn(birsfelden):
    ctx, _d, _w, _m = birsfelden
    assert ctx.get("vertragsbeginn") == dt.date(2026, 8, 1)


def test_fakturierung(birsfelden):
    ctx, _d, _w, _m = birsfelden
    assert ctx.text("fakt.pauschale") == "Quartalsweise"
    assert ctx.text("fakt.mehrseiten") == "Halbjährlich"


def test_warnungen_des_referenzfalls(birsfelden):
    """W308 und W312 stammen aus dem Kalktool, W305/W306 aus dem fehlenden CRM."""
    _ctx, _d, w, _m = birsfelden
    assert "W308" in w.codes()
    assert "W312" in w.codes()


def test_warnungen_ohne_crm():
    from offerttool.crm import CRM
    from offerttool.errors import WarningCollector

    w = WarningCollector()
    crm = CRM({})
    assert crm.offertnummer("V-2026-04768", w) == "V-2026-04768"
    assert crm.offertversion(w) == "1.0"
    assert "W305" in w.codes()
    assert "W306" in w.codes()


@pytest.mark.parametrize("gesperrt", ["2’645", "1’587", "2’024.75", "2’339.75"])
def test_sperrliste_kennt_die_kritischen_werte(birsfelden, gesperrt):
    from offerttool.validate import blocked_strings

    ctx, d, _w, _m = birsfelden
    assert gesperrt in blocked_strings([(ctx, d)])
