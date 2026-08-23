"""Ankerkatalog (Spezifikation V3, Abschnitt 3).

Jede Einfügestelle der Vorlage ist ein Inhaltssteuerelement (``w:sdt``) mit
gesetztem ``w:tag``.  Der Generator adressiert ausschliesslich über ``w:tag``.
Fehlt ein Anker dieser Liste -> ``E101``; ein unbekannter Anker -> ``E102``.

Die Einträge bis ``OFF.ORT_DATUM`` stammen wörtlich aus Abschnitt 3.2.
Danach folgen zwei dokumentierte Erweiterungen, ohne die sich Abschnitt 8.4
(zwei befüllte Zeilen einer sonst statischen Tabelle) und Abschnitt 12.1
(Neuaufbau des Inhaltsverzeichnisses) nicht ankerbasiert umsetzen lassen.
"""

from __future__ import annotations

from dataclasses import dataclass

TEXT, BLOCK, TABLE, SECTION, SWITCH, SYSTEM = "TEXT", "BLOCK", "TABLE", "SECTION", "SWITCH", "SYSTEM"


@dataclass(frozen=True)
class Anchor:
    tag: str
    typ: str
    inhalt: str
    style: str | None = None
    optional: bool = False


CATALOG: tuple[Anchor, ...] = (
    Anchor("OFF.KUNDE", BLOCK, "Kundenadressblock Deckblatt", "Normal"),
    Anchor("OFF.ANBIETER", BLOCK, "Graphax-Adresse (statisch)", "Normal"),
    Anchor("OFF.KONTAKT", BLOCK, "Ansprechperson Graphax", "Normal"),
    Anchor("OFF.KLASSIFIZIERUNG", TEXT, "Vertraulich", "Normal"),
    Anchor("OFF.NUMMER", TEXT, "Offertnummer", "Normal"),
    Anchor("OFF.VERSION", TEXT, "Offertversion", "Normal"),
    Anchor("OFF.DATUM", TEXT, "Offertdatum, eingefroren", "Normal"),
    Anchor("OFF.GUELTIG_BIS", TEXT, "Gültigkeitssatz", "Normal"),
    Anchor("SEC.STANDORT", SECTION, "Kapitel 1.1 je Standort"),
    Anchor("HEAD.STANDORT", TEXT, "Standortüberschrift", "Heading3"),
    Anchor("LINE.STANDORT_ADRESSE", TEXT, "Installationsadresse", "05Klein"),
    Anchor("TBL.HARDWARE", TABLE, "Geräteliste", "graphax11"),
    Anchor("HEAD.DL", TEXT, "Überschrift Dienstleistungen", "Heading3"),
    Anchor("TBL.DIENSTLEISTUNG", TABLE, "einmalige Kosten", "graphax100"),
    Anchor("SEC.SERVICE", SECTION, "Kapitel 1.2 je Standort"),
    Anchor("HEAD.SERVICE_STANDORT", TEXT, "Standortüberschrift Service", "Heading3"),
    Anchor("TBL.SERVICE", TABLE, "Wartungs- und Klickkosten", "graphax1000"),
    Anchor("TBL.TOTAL", TABLE, "Summen", "graphax100"),
    Anchor("TBL.GESAMTTOTAL", TABLE, "Summe über alle Standorte", "graphax100"),
    Anchor("SW.VERTRAGSTEXT", SWITCH, "Kauf / Miete / Leasing", "Normal"),
    Anchor("HEAD.VERTRAGSTEXT", TEXT, "Überschrift Laufzeit/Kündigung", "Heading2"),
    Anchor("TBL.KONDITIONEN", TABLE, "Konditionentabelle", "graphax20"),
    Anchor("LINE.NACHWEIS", TEXT, "Kalktool-Version, Verkaufschance", "05Klein"),
    Anchor("OFF.ORT_DATUM", TEXT, "Spreitenbach, TT.MM.JJJJ", "Normal"),
    # --- Erweiterungen gegenüber Abschnitt 3.2 -----------------------------
    Anchor("KOND.ABRECHNUNG", BLOCK, "Zeile Abrechnungsintervall (Abschnitt 8.4)", "Normal"),
    Anchor("KOND.RECHNUNG", BLOCK, "Zeile Rechnungsstellung (Abschnitt 8.4)", "Normal"),
    Anchor("SYS.TOC", SYSTEM, "Inhaltsverzeichnis (Abschnitt 12.1)"),
)

BY_TAG: dict[str, Anchor] = {a.tag: a for a in CATALOG}

# Kindvarianten des SWITCH-Ankers SW.VERTRAGSTEXT.
SWITCH_VARIANTS = ("SW.VERTRAGSTEXT.KAUF", "SW.VERTRAGSTEXT.MIETE", "SW.VERTRAGSTEXT.LEASING")

# Anker, die je Standort geklont werden (Abschnitt 11).
PER_STANDORT = ("SEC.STANDORT", "SEC.SERVICE", "TBL.TOTAL")

ALL_TAGS = set(BY_TAG) | set(SWITCH_VARIANTS)


def is_known(tag: str) -> bool:
    return tag in ALL_TAGS
