"""Textbausteine zusammensetzen (Spezifikation V3, Abschnitt 8).

Die Formulierungen selbst stehen nicht hier, sondern in
``resources/textbausteine.yaml``.  Dieses Modul entscheidet nur, **welcher**
Baustein wann gebraucht wird und mit welchen Werten er gefüllt wird – die
Regeln also, nicht der Wortlaut.

So lässt sich der Wortlaut ohne Programmierkenntnisse ändern, und beide
Fassungen des Offerttools teilen sich eine Quelle.
"""

from __future__ import annotations

from decimal import Decimal

from .bausteine import Bausteine, lade
from .derive import Derived
from .extract import StandortContext
from .formatters import chf, date_de, int_ch, klein, rate

_standard: Bausteine | None = None


def standard() -> Bausteine:
    """Die mitgelieferten Bausteine, einmal geladen."""
    global _standard
    if _standard is None:
        _standard = lade()
    return _standard


# --- Abschnitt 8.1 ---------------------------------------------------------


def head_standort(ctx: StandortContext, b: Bausteine | None = None) -> str:
    b = b or standard()
    name = ctx.text("standort.name")
    if not name:
        return b.text("head_standort_ohne_name", index=ctx.index)
    return b.text("head_standort", index=ctx.index, name=name)


def head_dl(ctx: StandortContext, b: Bausteine | None = None) -> str:
    b = b or standard()
    name = ctx.text("standort.name")
    if not name:
        return b.text("head_dienstleistung_ohne_name", index=ctx.index)
    return b.text("head_dienstleistung", index=ctx.index, name=name)


def line_adresse(ctx: StandortContext, b: Bausteine | None = None) -> str:
    b = b or standard()
    ort = ctx.get("standort.plz_ort") or {}
    text = b.text(
        "line_adresse",
        strasse=ctx.text("standort.strasse"),
        plz=ort.get("plz", ""),
        ort=ort.get("ort", ""),
    )
    return text.replace(" ,", ",").replace("  ", " ").strip().rstrip(",")


# --- Abschnitt 8.2 ---------------------------------------------------------


def service_kopf(d: Derived, b: Bausteine | None = None) -> str:
    return (b or standard()).text("tabelle_service_kopf", geraet=d.geraet)


def service_zeilen(
    ctx: StandortContext, d: Derived, b: Bausteine | None = None
) -> list[tuple[list[str], list[str]]]:
    """Zeilen der Servicetabelle in fester Reihenfolge.

    Zeilen 1–1b, 2–3 und 5–5a liegen jeweils in einer Tabellenzelle.
    """
    b = b or standard()
    zeilen: list[tuple[list[str], list[str]]] = []

    block1 = [b.text("service_geraet", geraet=d.geraet)]
    if d.show["sla"]:
        # Ist sla.preis 0, wird kein Betrag ausgegeben – der SLA steckt in
        # service.geraet und würde sonst doppelt wirken.
        block1.append(b.text("service_sla", sla=d.sla_kurz))
    block1.append(
        b.text(
            "service_inklusiv",
            volumen_color=int_ch(ctx.num("volumen.color")),
            volumen_sw=int_ch(ctx.num("volumen.sw")),
        )
    )
    zeilen.append((block1, [chf(ctx.num("service.geraet"))]))

    klick_texte, klick_betraege = [], []
    if d.show["color"]:
        klick_texte.append(b.text("service_color", ab_seite_color=d.ab_seite["color"]))
        klick_betraege.append(rate(ctx.num("preis.color")))
    if d.show["sw"]:
        klick_texte.append(b.text("service_sw", ab_seite_sw=d.ab_seite["sw"]))
        klick_betraege.append(rate(ctx.num("preis.sw")))
    if klick_texte:
        zeilen.append((klick_texte, klick_betraege))

    if d.show["scan"]:
        zeilen.append(
            ([b.text("service_scan", ab_scan=d.ab_seite["scan"])], [rate(ctx.num("preis.scan"))])
        )

    fleet_texte, fleet_betraege = [], []
    if d.show["fleet"]:
        fleet_texte.append(b.text("service_fleet", fleet=ctx.text("fleet.level")))
        fleet_betraege.append(chf(ctx.num("fleet.preis")) if ctx.num("fleet.preis") > 0 else "")
    if d.show["zaehlerversand"]:
        fleet_texte.append(b.text("service_zaehlerversand", zaehlerversand=ctx.text("zaehlerversand")))
        fleet_betraege.append("")
    if fleet_texte:
        zeilen.append((fleet_texte, fleet_betraege if any(fleet_betraege) else [""]))

    return zeilen


# --- Abschnitt 5.4 ---------------------------------------------------------


def total_zeilen(
    ctx: StandortContext, d: Derived, b: Bausteine | None = None
) -> list[tuple[str, str]]:
    b = b or standard()
    if d.variante == "KAUF":
        return [(b.text("total_kauf"), chf(ctx.num("vertragswert")))]
    label = b.text(
        "total_pauschale",
        summenlabel=ctx.text("summenlabel"),
        laufzeit=int_ch(ctx.num("laufzeit")),
    )
    return [
        (label, chf(ctx.num("pauschale_ohne_service"))),
        (b.text("total_monatspauschale"), chf(ctx.num("monatspauschale_total"))),
    ]


def gesamt_zeilen(
    einmalig: Decimal, monatlich: Decimal, kauf: Decimal, variante: str,
    b: Bausteine | None = None,
) -> list[tuple[str, str]]:
    b = b or standard()
    zeilen = []
    if einmalig > 0:
        zeilen.append((b.text("gesamt_einmalig"), chf(einmalig)))
    if variante == "KAUF":
        zeilen.append((b.text("gesamt_kauf"), chf(kauf)))
    else:
        zeilen.append((b.text("gesamt_monatlich"), chf(monatlich)))
    return zeilen


# --- Abschnitt 8.3 ---------------------------------------------------------


def vertragstext(
    ctx: StandortContext, d: Derived, b: Bausteine | None = None
) -> tuple[str, list[str]]:
    b = b or standard()
    if d.variante == "KAUF":
        return b.text("vertrag_kauf_titel"), b.absaetze("vertrag_kauf")

    beginn = ctx.get("vertragsbeginn")
    phrase = (
        b.text("vertrag_beginn_datum", vertragsbeginn=date_de(beginn))
        if beginn
        else b.text("vertrag_beginn_offen")
    )
    kopf = b.text("vertrag_miete_titel", vertragsart=d.vertragsart_wort)
    absaetze = b.absaetze(
        "vertrag_miete",
        vertragsart=d.vertragsart_wort,
        beginn=phrase,
        laufzeit=int_ch(ctx.num("laufzeit")),
    )
    return kopf, absaetze


# --- Abschnitt 8.4 ---------------------------------------------------------

PAUSCHALE_BAUSTEIN = {
    "MIETE": "pauschale_wort_miete",
    "LEASING": "pauschale_wort_leasing",
    "KAUF": "pauschale_wort_kauf",
}


def konditionen_abrechnung(ctx: StandortContext, b: Bausteine | None = None) -> list[str]:
    b = b or standard()
    zeilen = [
        b.text("kondition_pauschale", fakt_pauschale=ctx.text("fakt.pauschale")),
        b.text("kondition_mehrseiten", fakt_mehrseiten=ctx.text("fakt.mehrseiten")),
    ]
    if ctx.text("fakt.gebuehren"):
        zeilen.append(b.text("kondition_gebuehren", fakt_gebuehren=ctx.text("fakt.gebuehren")))
    return zeilen


def konditionen_rechnung(
    ctx: StandortContext, d: Derived, b: Bausteine | None = None
) -> list[str]:
    b = b or standard()
    return [
        b.text("rechnung_einmalig"),
        b.text(
            "rechnung_pauschale",
            pauschale_wort=b.text(PAUSCHALE_BAUSTEIN[d.variante]),
            fakt_pauschale=klein(ctx.text("fakt.pauschale")),
        ),
        b.text("rechnung_seitenpreise", fakt_mehrseiten=klein(ctx.text("fakt.mehrseiten"))),
    ]


# --- Abschnitt 8.5 ---------------------------------------------------------


def nachweis(standorte: list[StandortContext], b: Bausteine | None = None) -> str:
    """Fehlt ein Teil, entfällt das jeweilige Segment samt Trennzeichen."""
    b = b or standard()
    erste = standorte[0]
    versionen = list(dict.fromkeys(c.text("kalktool.version") for c in standorte if c.text("kalktool.version")))
    chancen = list(dict.fromkeys(c.text("verkaufschance") for c in standorte if c.text("verkaufschance")))
    art = erste.text("anlieferungsart")

    teile = []
    if versionen:
        teile.append(b.text("nachweis_kalktool", kalktool_version=", ".join(versionen)))
    if chancen:
        teile.append(b.text("nachweis_verkaufschance", verkaufschance=", ".join(chancen)))
    if art:
        teile.append(b.text("nachweis_anlieferung", anlieferungsart=art))
    return b.text("nachweis_trenner").join(teile)


# --- Deckblatt und Schluss -------------------------------------------------


def klassifizierung(b: Bausteine | None = None) -> str:
    return (b or standard()).text("klassifizierung")


def gueltigkeit(d: Derived, b: Bausteine | None = None) -> str:
    return (b or standard()).text("gueltigkeit", gueltig_bis=date_de(d.gueltig_bis))


def ort_datum(ctx: StandortContext, b: Bausteine | None = None) -> str:
    return (b or standard()).text("ort_datum", datum=date_de(ctx.get("datum")))


def kopf_hardware(mit_artnr: bool, b: Bausteine | None = None) -> list[str]:
    b = b or standard()
    spalten = [b.text("tabelle_hardware_bezeichnung"), b.text("tabelle_hardware_stueck")]
    if mit_artnr:
        return [b.text("tabelle_hardware_artnr")] + spalten
    return spalten


def kopf_dienstleistung(b: Bausteine | None = None) -> list[str]:
    b = b or standard()
    return [b.text("tabelle_dienstleistung_leistung"), b.text("tabelle_dienstleistung_betrag")]


def kopf_service(d: Derived, b: Bausteine | None = None) -> list[str]:
    b = b or standard()
    return [service_kopf(d, b), b.text("tabelle_service_total")]


def dl_total_label(b: Bausteine | None = None) -> str:
    return (b or standard()).text("total_dienstleistung")
