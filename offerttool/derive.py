"""Schritt DERIVE: Schalter und Rechenwerte (Abschnitt 5).

Alle Regeln sind Boolesche oder arithmetische Ausdrücke über Abschnitt 4.
Keine Regel liest eine Zelle, die nicht im Feldkatalog steht.
"""

from __future__ import annotations

import datetime as _dt
from dataclasses import dataclass, field
from decimal import Decimal

from .errors import OfferteError, WarningCollector
from .extract import StandortContext, _num
from .parsers import sla_type_kurz

# Abschnitt 5.1
VARIANTE_MAP = {
    1: ("KAUF", None),
    2: ("MIETE", "Mietvertrag"),
    3: ("LEASING", "Leasingvertrag"),
    4: ("LEASING", "Leasingvertrag"),
    5: ("MIETE", "Mietvertrag"),
}

PAUSCHALE_WORT = {
    "MIETE": "Miet- und Servicepauschalen",
    "LEASING": "Leasing- und Servicepauschalen",
    "KAUF": "Servicepauschalen",
}

GUELTIGKEIT_TAGE = 60


@dataclass
class Derived:
    """Abgeleitete Werte eines Standorts."""

    variante: str = ""
    vertragsart_wort: str | None = None
    show: dict[str, bool] = field(default_factory=dict)
    ab_seite: dict[str, int] = field(default_factory=dict)
    geraet: str = ""
    sla_kurz: str = ""
    dienstleistung_total: Decimal = Decimal(0)
    solutions_total: Decimal = Decimal(0)
    gueltig_bis: _dt.date | None = None


def variante_of(finanzierungsart) -> tuple[str, str | None]:
    """Finanzierungsart 1–5 in Variante und Vertragswort übersetzen."""
    try:
        key = int(_num(finanzierungsart))
    except (TypeError, ValueError):
        raise OfferteError("E401", repr(finanzierungsart)) from None
    if key not in VARIANTE_MAP:
        raise OfferteError("E401", f"finanzierungsart={finanzierungsart!r}")
    return VARIANTE_MAP[key]


def derive(ctx: StandortContext, warn: WarningCollector) -> Derived:
    """Schalter und Rechenwerte eines Standorts bilden."""
    d = Derived()
    d.variante, d.vertragsart_wort = variante_of(ctx.get("finanzierungsart"))

    vol_sw, pr_sw = ctx.num("volumen.sw"), ctx.num("preis.sw")
    vol_col, pr_col = ctx.num("volumen.color"), ctx.num("preis.color")
    vol_scan, pr_scan = ctx.num("volumen.scan"), ctx.num("preis.scan")

    d.dienstleistung_total = sum(
        (p.betrag for p in ctx.listen.get("dienstleistung", [])), Decimal(0)
    )
    d.solutions_total = (
        _num(ctx.probes.get("solutions.sw_tot"))
        + _num(ctx.probes.get("solutions.mnt_tot"))
        + _num(ctx.probes.get("solutions.dl_tot"))
    )

    # Abschnitt 5.2 – Schalter
    d.show = {
        "sw": vol_sw > 0 or pr_sw > 0,
        "color": vol_col > 0 or pr_col > 0,
        "scan": vol_scan > 0 or pr_scan > 0,
        "fleet": bool(ctx.text("fleet.level")),
        "solutions": (
            _num(ctx.probes.get("solutions.sw_tot")) > 0
            or _num(ctx.probes.get("solutions.mnt_tot")) > 0
            or _num(ctx.probes.get("solutions.dl_tot")) > 0
        ),
        "dienstleistung": d.dienstleistung_total > 0,
        "altvertrag": ctx.num("restwert_altvertrag") > 0,
        "sla": bool(ctx.text("sla.type")),
        "zaehlerversand": bool(ctx.text("zaehlerversand")),
        # Das Kalktool Q4 2025 führt weder Artikelnummer noch Zeilenpreis
        # (Abschnitt 5.5) – daher bleibt der Schalter bis zur Erweiterung falsch.
        "hardware_preise": d.variante == "KAUF" and bool(ctx.probes.get("hardware_spalten")),
    }

    # Abschnitt 5.3 – Rechenwerte
    d.ab_seite = {
        "sw": int(vol_sw) + 1,
        "color": int(vol_col) + 1,
        "scan": int(vol_scan) + 1,
    }

    datum = ctx.get("datum")
    if isinstance(datum, _dt.datetime):
        datum = datum.date()
    if isinstance(datum, _dt.date):
        d.gueltig_bis = datum + _dt.timedelta(days=GUELTIGKEIT_TAGE)

    hardware = ctx.listen.get("hardware", [])
    d.geraet = hardware[0].bezeichnung if hardware else ""
    d.sla_kurz = sla_type_kurz(ctx.get("sla.type"))

    if not ctx.text("standort.name"):
        warn.add("W309", ctx.quelle)
    if not ctx.probes.get("stueck_belegbar", True):
        # Stückzahl wird leer gerendert statt geraten (Abschnitt 5.5).
        for p in hardware:
            p.stueck = ""
    return d


@dataclass
class Gesamt:
    """Summen über alle Standorte (Abschnitt 5.3)."""

    einmalig: Decimal = Decimal(0)
    monatlich: Decimal = Decimal(0)
    kauf: Decimal = Decimal(0)


def gesamttotal(standorte: list[tuple[StandortContext, Derived]]) -> Gesamt:
    g = Gesamt()
    for ctx, d in standorte:
        g.einmalig += d.dienstleistung_total
        g.monatlich += ctx.num("monatspauschale_total")
        g.kauf += ctx.num("vertragswert")
    return g
