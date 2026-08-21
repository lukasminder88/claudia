"""Formatter (Abschnitt 7) – die Beispiele der Spezifikation sind der Test."""

from __future__ import annotations

import datetime as dt

import pytest

from offerttool import formatters as f


@pytest.mark.parametrize(
    "roh, erwartet",
    [
        (2024.7475, "CHF 2’024.75"),
        (0, "CHF 0.00"),
        (47, "CHF 47.00"),
        (43.5, "CHF 43.50"),
        (300, "CHF 300.00"),
        (1234567.891, "CHF 1’234’567.89"),
        (-5.005, "CHF -5.01"),
    ],
)
def test_chf(roh, erwartet):
    assert f.chf(roh) == erwartet


def test_chf_rundet_kaufmaennisch():
    # 2024.7475 wird zu 2’024.75, nicht zu 2’024.74 (Abschnitt 7).
    assert f.chf(2024.7475) == "CHF 2’024.75"
    assert f.chf(0.005) == "CHF 0.01"


@pytest.mark.parametrize(
    "roh, erwartet",
    [(0.032, "CHF 0.0320"), (0.005, "CHF 0.0050"), (0, "CHF 0.0000")],
)
def test_rate_ohne_tausendertrenner(roh, erwartet):
    assert f.rate(roh) == erwartet


def test_int_ch():
    assert f.int_ch(1500) == "1’500"
    assert f.int_ch(0) == "0"
    assert f.int_ch(1000000) == "1’000’000"


def test_monate():
    assert f.monate(60) == "60 Monate"


def test_date_de():
    assert f.date_de(dt.date(2026, 7, 28)) == "28.07.2026"
    assert f.date_de(dt.datetime(2026, 9, 26)) == "26.09.2026"
    assert f.date_de(None) == ""


def test_trim_zieht_mehrfachleerzeichen_zusammen():
    assert f.trim("  Museum  ") == "Museum"
    assert f.trim("Schulstrasse 29  1.OG") == "Schulstrasse 29 1.OG"


def test_klein():
    assert f.klein("Quartalsweise") == "quartalsweise"
    assert f.klein("") == ""


def test_label_clean_loest_gesperrte_schrift_auf():
    assert (
        f.label_clean("Wegpauschale - I n t e g r a t i o n - Netzwerk - Fax - Scan - LDAP")
        == "Wegpauschale Integration Netzwerk Fax Scan LDAP"
    )
    assert f.label_clean("I n t e g r a t i o n - Netzwerk") == "Integration Netzwerk"
    assert f.label_clean("T r a n s p o r t") == "Transport"


def test_tausendertrenner_ist_typografisches_apostroph():
    assert "’" in f.chf(2645)
    assert "'" not in f.chf(2645)
