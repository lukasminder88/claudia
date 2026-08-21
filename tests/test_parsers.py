"""Parser (Abschnitt 6) – jeder Fallback erzeugt eine Warnung."""

from __future__ import annotations

import datetime as dt

from offerttool import parsers


def test_parse_plz_ort(warn):
    assert parsers.parse_plz_ort("4127 Birsfelden", warn) == {"plz": "4127", "ort": "Birsfelden"}
    assert warn.codes() == []


def test_parse_plz_ort_fallback_warnt(warn):
    assert parsers.parse_plz_ort("Birsfelden", warn) == {"plz": "", "ort": "Birsfelden"}
    assert "W301" in warn.codes()


def test_parse_kontakt_referenzfall(warn):
    got = parsers.parse_kontakt(
        "Tom Wiedmer   tom.wiedmer@birsfelden.ch    061 317 33 48", warn
    )
    assert got == {
        "vorname": "Tom",
        "nachname": "Wiedmer",
        "email": "tom.wiedmer@birsfelden.ch",
        "telefon": "061 317 33 48",
    }
    assert warn.codes() == []


def test_parse_kontakt_ohne_telefon_warnt(warn):
    got = parsers.parse_kontakt("Tom Wiedmer  tom@x.ch", warn)
    assert got["email"] == "tom@x.ch"
    assert got["telefon"] == ""
    assert "W302" in warn.codes()


def test_parse_kontakt_mehrdeutiger_name_warnt(warn):
    got = parsers.parse_kontakt("Tom von Wiedmer  t@x.ch  +41 61 317 33 48", warn)
    assert got["vorname"] == "Tom"
    assert got["nachname"] == "von Wiedmer"
    assert "W303" in warn.codes()


def test_parse_vertragsbeginn(warn):
    assert parsers.parse_vertragsbeginn("Vertragsbeginn 01.08.2026", warn) == dt.date(2026, 8, 1)
    assert warn.codes() == []


def test_parse_vertragsbeginn_fallback_warnt(warn):
    assert parsers.parse_vertragsbeginn("wird noch vereinbart", warn) is None
    assert "W304" in warn.codes()


def test_sla_type_kurz():
    assert parsers.sla_type_kurz("Premium - CHF 50.00") == "Premium"
    assert parsers.sla_type_kurz("Standard") == "Standard"
