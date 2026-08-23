"""Textbausteine (Spezifikation V3, Abschnitt 8).

Bausteine sind Templates mit ``{feld}``-Platzhaltern über den Abschnitten 4
und 5.  Keine Bedingungen im Text – Varianten sind eigene Bausteine.
"""

from __future__ import annotations

from .derive import PAUSCHALE_WORT, Derived
from .extract import StandortContext
from .formatters import chf, date_de, int_ch, klein, rate

# --- Abschnitt 8.1 ---------------------------------------------------------

HEAD_STANDORT = "Standort {index}: {name}"
HEAD_STANDORT_OHNE_NAME = "Standort {index}"
HEAD_DL = "Im Angebot enthaltene Schulungen und Dienstleistungen – Standort {index}: {name}"
HEAD_DL_OHNE_NAME = "Im Angebot enthaltene Schulungen und Dienstleistungen – Standort {index}"
LINE_ADRESSE = "Installationsadresse: {strasse}, {plz} {ort}"

# --- Abschnitt 8.3 ---------------------------------------------------------

VERTRAGSTEXT_KAUF_HEAD = "Laufzeit und Kündigungsfrist für Serviceverträge beim Kauf"
VERTRAGSTEXT_KAUF = [
    "Der Start und die Laufzeit des Servicevertrags werden gemäss einer separaten "
    "Vereinbarung festgelegt. Nach Ablauf der vereinbarten Laufzeit verlängert sich "
    "der Servicevertrag automatisch um jeweils ein Jahr. Eine Kündigung des "
    "Servicevertrags ist möglich, indem er mit einer Kündigungsfrist von drei Monaten "
    "zum Ende der Laufzeit gekündigt wird.",
]

VERTRAGSTEXT_MIETE_HEAD = "Laufzeit und Kündigungsfrist {vertragsart_wort} und Servicevertrag"
VERTRAGSTEXT_MIETE = [
    "Der {vertragsart_wort} tritt {beginn_phrase} in Kraft und läuft für eine bestimmte "
    "Laufzeit von {laufzeit} Monaten. Die Laufzeit des Servicevertrags ist an diese "
    "Laufzeit gekoppelt und endet gleichzeitig. Nach Ablauf verlängern sich beide "
    "Verträge automatisch um jeweils ein weiteres Jahr. Eine Beendigung ist möglich, "
    "indem sie jeweils zum Ende der Laufzeit unter Einhaltung einer Kündigungsfrist "
    "von drei Monaten gekündigt werden.",
]

BEGINN_PHRASE_DATUM = "am {vertragsbeginn}"
BEGINN_PHRASE_OFFEN = "zum vereinbarten Zeitpunkt"

# --- Abschnitt 8.2 ---------------------------------------------------------

SERVICE_GERAET = "Servicevertrag pro Monat und pro Gerät für {geraet}"
SERVICE_SLA = "Service Level Agreement: {sla_kurz}"
SERVICE_INKLUSIV = (
    "Mit {volumen_color} Seiten in Farbe und {volumen_sw} Seiten schwarzweiss inkludiert"
)
SERVICE_COLOR = "Zusätzliche Seiten ab der {ab_seite_color}. Seite in Farbe"
SERVICE_SW = "Zusätzliche Seiten ab der {ab_seite_sw}. Seite schwarzweiss"
SERVICE_SCAN = "Zusätzliche Scans ab dem {ab_seite_scan}. Scan"
SERVICE_FLEET = "Zählerstanderfassung und Fleet Management: {fleet_level}"
SERVICE_ZAEHLER = "Zählerstandsmeldung: {zaehlerversand}"
SERVICE_KOPF = "Wartungs- und Klick-Kosten für {geraet}"

# --- Abschnitt 5.4 ---------------------------------------------------------

TOTAL_KAUF_LABEL = "Total Kauf"
TOTAL_MIETE_LABEL = "{summenlabel} bei einer Laufzeit von {laufzeit} Monaten"
TOTAL_MIETE_LABEL2 = "Monatspauschale total inkl. Service"
GESAMT_EINMALIG = "Einmalige Kosten – alle Standorte"
GESAMT_MONATLICH = "Monatspauschale total – alle Standorte"
GESAMT_KAUF = "Total Kauf – alle Standorte"
DL_TOTAL_LABEL = "Total einmalige Kosten"

# --- Abschnitt 8.4 ---------------------------------------------------------

KOND_PAUSCHALE = "Servicepauschalen: {fakt_pauschale}, im Voraus."
KOND_MEHRSEITEN = "Mehrseitenpreise: {fakt_mehrseiten}, rückwirkend."
KOND_GEBUEHREN = "Gebühren: {fakt_gebuehren}."
KOND_RECHNUNG_1 = "Die einmaligen Kosten werden nach der Installation in Rechnung gestellt."
KOND_RECHNUNG_2 = "Die {pauschale_wort} werden {fakt_pauschale_klein} im Voraus verrechnet."
KOND_RECHNUNG_3 = (
    "Die Seitenpreise für Schwarzweiss- und Farbdruck werden {fakt_mehrseiten_klein} "
    "rückwirkend in Rechnung gestellt."
)

# --- Abschnitt 8.5 ---------------------------------------------------------

NACHWEIS_TEILE = (
    ("Kalkulationsgrundlage: Kalktool {kalktool_version}", "kalktool_version"),
    ("Verkaufschance {verkaufschance}", "verkaufschance"),
    ("Anlieferungsart: {anlieferungsart}", "anlieferungsart"),
)

GUELTIGKEIT = "Dieses Angebot ist gültig bis {gueltig_bis}"
ORT_DATUM = "Spreitenbach, {datum}"
KLASSIFIZIERUNG = "Vertraulich"


# --- Zusammensetzen --------------------------------------------------------


def head_standort(ctx: StandortContext) -> str:
    name = ctx.text("standort.name")
    if not name:
        return HEAD_STANDORT_OHNE_NAME.format(index=ctx.index)
    return HEAD_STANDORT.format(index=ctx.index, name=name)


def head_dl(ctx: StandortContext) -> str:
    name = ctx.text("standort.name")
    if not name:
        return HEAD_DL_OHNE_NAME.format(index=ctx.index)
    return HEAD_DL.format(index=ctx.index, name=name)


def line_adresse(ctx: StandortContext) -> str:
    ort = ctx.get("standort.plz_ort") or {}
    return LINE_ADRESSE.format(
        strasse=ctx.text("standort.strasse"),
        plz=ort.get("plz", ""),
        ort=ort.get("ort", ""),
    ).replace(" ,", ",").replace("  ", " ").strip().rstrip(",")


def service_zeilen(ctx: StandortContext, d: Derived) -> list[tuple[list[str], str]]:
    """Zeilen der Servicetabelle in fester Reihenfolge (Abschnitt 8.2).

    Rückgabe je Zeile: Absätze der Beschreibung und der Betrag.
    Zeilen 1–1b, 2–3 und 5–5a liegen jeweils in einer Zelle.
    """
    zeilen: list[tuple[list[str], str]] = []

    block1 = [SERVICE_GERAET.format(geraet=d.geraet)]
    betrag1 = chf(ctx.num("service.geraet"))
    if d.show["sla"]:
        # Ist sla.preis 0, wird kein Betrag ausgegeben – der SLA steckt in
        # service.geraet und würde sonst doppelt wirken (Abschnitt 8.2).
        block1.append(SERVICE_SLA.format(sla_kurz=d.sla_kurz))
    block1.append(
        SERVICE_INKLUSIV.format(
            volumen_color=int_ch(ctx.num("volumen.color")),
            volumen_sw=int_ch(ctx.num("volumen.sw")),
        )
    )
    zeilen.append((block1, betrag1))

    klick_texte, klick_betraege = [], []
    if d.show["color"]:
        klick_texte.append(SERVICE_COLOR.format(ab_seite_color=d.ab_seite["color"]))
        klick_betraege.append(rate(ctx.num("preis.color")))
    if d.show["sw"]:
        klick_texte.append(SERVICE_SW.format(ab_seite_sw=d.ab_seite["sw"]))
        klick_betraege.append(rate(ctx.num("preis.sw")))
    if klick_texte:
        zeilen.append((klick_texte, klick_betraege))

    if d.show["scan"]:
        zeilen.append(
            ([SERVICE_SCAN.format(ab_seite_scan=d.ab_seite["scan"])], rate(ctx.num("preis.scan")))
        )

    fleet_texte, fleet_betraege = [], []
    if d.show["fleet"]:
        fleet_texte.append(SERVICE_FLEET.format(fleet_level=ctx.text("fleet.level")))
        fleet_betraege.append(chf(ctx.num("fleet.preis")) if ctx.num("fleet.preis") > 0 else "")
    if d.show["zaehlerversand"]:
        fleet_texte.append(SERVICE_ZAEHLER.format(zaehlerversand=ctx.text("zaehlerversand")))
        fleet_betraege.append("")
    if fleet_texte:
        zeilen.append((fleet_texte, fleet_betraege))

    return zeilen


def total_zeilen(ctx: StandortContext, d: Derived) -> list[tuple[str, str]]:
    """Summenzeilen eines Standorts (Abschnitt 5.4)."""
    if d.variante == "KAUF":
        return [(TOTAL_KAUF_LABEL, chf(ctx.num("vertragswert")))]
    label = TOTAL_MIETE_LABEL.format(
        summenlabel=ctx.text("summenlabel"), laufzeit=int_ch(ctx.num("laufzeit"))
    )
    return [
        (label, chf(ctx.num("pauschale_ohne_service"))),
        (TOTAL_MIETE_LABEL2, chf(ctx.num("monatspauschale_total"))),
    ]


def vertragstext(ctx: StandortContext, d: Derived) -> tuple[str, list[str]]:
    """Überschrift und Absätze des Vertragstexts (Abschnitt 8.3)."""
    if d.variante == "KAUF":
        return VERTRAGSTEXT_KAUF_HEAD, list(VERTRAGSTEXT_KAUF)

    beginn = ctx.get("vertragsbeginn")
    phrase = (
        BEGINN_PHRASE_DATUM.format(vertragsbeginn=date_de(beginn))
        if beginn
        else BEGINN_PHRASE_OFFEN
    )
    head = VERTRAGSTEXT_MIETE_HEAD.format(vertragsart_wort=d.vertragsart_wort)
    absaetze = [
        t.format(
            vertragsart_wort=d.vertragsart_wort,
            beginn_phrase=phrase,
            laufzeit=int_ch(ctx.num("laufzeit")),
        )
        for t in VERTRAGSTEXT_MIETE
    ]
    return head, absaetze


def konditionen_abrechnung(ctx: StandortContext) -> list[str]:
    zeilen = [
        KOND_PAUSCHALE.format(fakt_pauschale=ctx.text("fakt.pauschale")),
        KOND_MEHRSEITEN.format(fakt_mehrseiten=ctx.text("fakt.mehrseiten")),
    ]
    if ctx.text("fakt.gebuehren"):
        zeilen.append(KOND_GEBUEHREN.format(fakt_gebuehren=ctx.text("fakt.gebuehren")))
    return zeilen


def konditionen_rechnung(ctx: StandortContext, d: Derived) -> list[str]:
    return [
        KOND_RECHNUNG_1,
        KOND_RECHNUNG_2.format(
            pauschale_wort=PAUSCHALE_WORT[d.variante],
            fakt_pauschale_klein=klein(ctx.text("fakt.pauschale")),
        ),
        KOND_RECHNUNG_3.format(fakt_mehrseiten_klein=klein(ctx.text("fakt.mehrseiten"))),
    ]


def nachweis(standorte: list[StandortContext]) -> str:
    """Nachweiszeile; fehlt ein Teil, entfällt das Segment samt Trennzeichen."""
    erste = standorte[0]
    versionen = []
    for ctx in standorte:
        v = ctx.text("kalktool.version")
        if v and v not in versionen:
            versionen.append(v)
    werte = {
        "kalktool_version": ", ".join(versionen),
        "verkaufschance": ", ".join(
            dict.fromkeys(c.text("verkaufschance") for c in standorte if c.text("verkaufschance"))
        ),
        "anlieferungsart": erste.text("anlieferungsart"),
    }
    teile = [tpl.format(**werte) for tpl, key in NACHWEIS_TEILE if werte.get(key)]
    return " · ".join(teile)
