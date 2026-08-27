"""Die neun Schritte der Pipeline (Abschnitt 1).

::

    1  LOAD_TEMPLATE     Vorlage öffnen, Ankerkatalog validieren      -> E10x
    2  LOAD_SOURCES      n Kalktools + CRM-Datensatz einlesen         -> E20x
    3  EXTRACT           Zellen -> Rohwerte                           -> E21x
    4  PARSE             Freitextfelder zerlegen                      -> W30x
    5  DERIVE            Schalter und Rechenwerte                     -> E40x
    6  VALIDATE_INPUT    Abbruchregeln                                -> E4xx
    7  RENDER            Anker füllen, Standort-Blöcke klonen         -> E50x
    8  POSTPROCESS       TOC, Feldwerte einfrieren
    9  VALIDATE_OUTPUT   Sperrliste, Restplatzhalter                  -> E6xx

Die Schritte 1–6 sind seiteneffektfrei.  Erst Schritt 7 berührt das Dokument.
Bricht ein Schritt ab, entsteht **keine** Datei – nie eine halbe Offerte.
"""

from __future__ import annotations

import logging
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

import docx

from .bausteine import Bausteine, lade as lade_bausteine
from .crm import CRM
from .derive import Derived, derive, gesamttotal
from .docxutil.anchor_ops import find
from .docxutil.fields import freeze_fields, set_update_fields
from .docxutil.toc import build_toc, collect_headings, seitenzahlen, set_bookmarks
from .docxutil.xmlutil import W, paragraph_text
from .errors import OfferteError, WarningCollector
from .hardware import Bibliothek, datenblaetter_fuer
from .extract import StandortContext, extract
from .formatters import date_de
from .mapping import Mapping, load_mapping, select_mapping
from .prepare import validate_template
from .render import render
from .report import schreibe_protokoll
from .validate import blocked_strings, validate_across, validate_input, validate_output
from .workbook import Kalktool, read_version_cell

log = logging.getLogger("offerttool")


@dataclass
class Ergebnis:
    offerte: Path
    protokoll: Path
    warnungen: WarningCollector
    standorte: list = field(default_factory=list)


def generiere(
    kalktools: list[str | Path],
    vorlage: str | Path,
    ziel: str | Path,
    crm_pfad: str | Path | None = None,
    mapping_pfad: str | Path | None = None,
    *,
    toc_seitenzahlen: bool = True,
    bausteine_pfad: str | Path | None = None,
    datenblaetter_pfad: str | Path | None = None,
    mit_spezifikation: bool = True,
) -> Ergebnis:
    """Eine Offerte aus n Kalktools erzeugen.

    Die Reihenfolge der Kalktools ist die Reihenfolge der Standorte im
    Dokument (Abschnitt 2.2).
    """
    if not kalktools:
        raise OfferteError("E201", "keine Kalktools angegeben")
    warn = WarningCollector()
    ziel = Path(ziel)

    # 1 LOAD_TEMPLATE – die Textbausteine werden hier geprüft, nicht erst
    # beim Rendern: ein Tippfehler im Wortlaut soll auffallen, bevor
    # irgendetwas geschrieben wird.
    log.info("1 LOAD_TEMPLATE %s", vorlage)
    validate_template(vorlage)
    bausteine: Bausteine = lade_bausteine(bausteine_pfad)

    # 2 LOAD_SOURCES / 3 EXTRACT / 4 PARSE / 5 DERIVE
    crm = CRM.load(crm_pfad)
    standorte: list[tuple[StandortContext, Derived]] = []
    mapping: Mapping | None = None
    for i, pfad in enumerate(kalktools, start=1):
        warn.standort = i
        log.info("2 LOAD_SOURCES %s", pfad)
        m = (
            load_mapping(mapping_pfad)
            if mapping_pfad
            else select_mapping(read_version_cell(pfad))
        )
        mapping = mapping or m
        with Kalktool(pfad, m, warn) as kt:
            log.info("3 EXTRACT / 4 PARSE %s", pfad)
            ctx = extract(kt, m, warn)
        ctx.index = i
        log.info("5 DERIVE %s", pfad)
        d = derive(ctx, warn)
        standorte.append((ctx, d))
    warn.standort = None

    # 6 VALIDATE_INPUT
    log.info("6 VALIDATE_INPUT")
    for ctx, d in standorte:
        warn.standort = ctx.index
        validate_input(ctx, d, mapping)
    warn.standort = None
    validate_across(standorte, warn)
    gesamt = gesamttotal(standorte)

    # Gerätedatenblätter zuordnen. Fehlt eines, ist das eine Warnung und kein
    # Abbruch – die Offerte bleibt ohne dieses Kapitel vollständig.
    datenblaetter = []
    if datenblaetter_pfad:
        bibliothek = Bibliothek.laden(datenblaetter_pfad)
        log.info("6 VALIDATE_INPUT: %d Datenblätter verfügbar", len(bibliothek))
        datenblaetter = datenblaetter_fuer(standorte, bibliothek, warn)

    # 7 RENDER – erst hier entsteht ein Dokument.
    log.info("7 RENDER")
    doc = docx.Document(str(vorlage))
    emitted = render(
        doc, standorte, gesamt, mapping, crm, warn, bausteine,
        datenblaetter, mit_spezifikation,
    )

    # 8 POSTPROCESS
    log.info("8 POSTPROCESS")
    _postprocess(doc, standorte, warn, toc_seitenzahlen)

    # 9 VALIDATE_OUTPUT – erst nach bestandener Prüfung wird geschrieben.
    log.info("9 VALIDATE_OUTPUT")
    text = _dokumenttext(doc)
    validate_output(text, blocked_strings(standorte), emitted)

    ziel.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(ziel))
    protokoll = schreibe_protokoll(
        ziel, standorte, warn, mapping.version, str(vorlage),
        bausteine=str(bausteine.quelle) if bausteine.quelle else "mitgeliefert",
    )
    for w in warn.items:
        # Der Aufrufer gibt die Warnungen selbst aus; im Log stehen sie nur,
        # wenn der Ablauf ohnehin mitgeschrieben wird.
        log.info("%s", w)
    return Ergebnis(ziel, protokoll, warn, standorte)


def _postprocess(doc, standorte, warn: WarningCollector, mit_seitenzahlen: bool) -> None:
    """Inhaltsverzeichnis und eingefrorene Feldwerte (Abschnitt 12)."""
    erste = standorte[0][0]
    datum = date_de(erste.get("datum"))

    # 12.2 – TIME-Felder im Fliesstext einfrieren; die Fusszeile bleibt.
    freeze_fields(doc.element.body, datum)

    # 12.1 – Inhaltsverzeichnis neu aufbauen.
    toc_sdt = find(doc.element.body, "SYS.TOC")
    if toc_sdt is None:
        return
    eintraege = collect_headings(doc.element.body)
    set_bookmarks(doc.element.body, eintraege)

    ok = False
    if mit_seitenzahlen and eintraege:
        with tempfile.TemporaryDirectory() as tmp:
            zwischen = Path(tmp) / "zwischenstand.docx"
            doc.save(str(zwischen))
            ok = seitenzahlen(zwischen, eintraege)
    if not ok:
        warn.add("W321", "Verzeichnis ohne Seitenzahlen")

    build_toc(toc_sdt, eintraege, ok)
    set_update_fields(doc, True)


def _dokumenttext(doc) -> str:
    """Sichtbarer Text des ganzen Dokuments – Grundlage von E601/E602."""
    teile = [paragraph_text(p) for p in doc.element.body.iter(W("w:p"))]
    return "\n".join(teile)
