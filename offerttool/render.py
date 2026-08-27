"""Schritt RENDER: Anker füllen, Standort-Blöcke klonen (Abschnitt 7 der Pipeline).

Erst dieser Schritt berührt das Dokument.  Adressiert wird ausschliesslich über
``w:tag``; Tabellen werden geklont, nie neu aufgebaut (Abschnitt 10).
"""

from __future__ import annotations

import re

from . import textblocks as T
from .anchors import BY_TAG, PER_STANDORT
from .bausteine import Bausteine
from .crm import CRM
from .derive import Derived, Gesamt
from .docxutil.anchor_ops import (
    clone_anchor_after,
    content_children,
    find,
    remove,
    replace_children,
    resolve,
    select_switch,
    set_block,
    set_text,
    tables_of,
    tag_map,
)
from .docxutil.tables import (
    cells,
    fill_rows,
    remove_column,
    rows,
    set_cell_paragraphs,
    set_tbl_look,
)
from .docxutil.xmlutil import make_paragraph
from .errors import OfferteError, WarningCollector
from .hardware import STIL_ABBILDUNG, Datenblatt
from .extract import StandortContext
from .formatters import chf, date_de, trim
from .mapping import Mapping

RE_BETRAG = re.compile(r"-?\d[\d’]*(?:\.\d+)?")


class Renderer:
    """Füllt eine ankerbasierte Vorlage aus n Standortkontexten."""

    def __init__(
        self, doc, mapping: Mapping, crm: CRM, warn: WarningCollector,
        bausteine: Bausteine | None = None,
    ) -> None:
        self.b = bausteine or T.standard()
        self.doc = doc
        self.body = doc.element.body
        self.mapping = mapping
        self.crm = crm
        self.warn = warn
        # Jeder Betrag, den der Renderer nachweislich selbst setzt.  Grundlage
        # der Sperrlistenprüfung in Schritt 9 (Abschnitt 13.2).
        self.emitted: set[str] = set()

    # -- Hilfen ------------------------------------------------------------

    def _emit(self, text) -> str:
        for treffer in RE_BETRAG.findall(str(text)):
            self.emitted.add(treffer)
        return text

    def _emit_all(self, werte) -> None:
        for w in werte:
            if isinstance(w, (list, tuple)):
                self._emit_all(w)
            else:
                self._emit(w)

    def _anchor(self, tag: str, root=None):
        el = find(root if root is not None else self.body, tag)
        if el is None:
            raise OfferteError("E101", tag)
        return el

    def _style(self, tag: str) -> str | None:
        a = BY_TAG.get(tag)
        return a.style if a else None

    def _text(self, tag: str, value: str, root=None) -> None:
        set_text(self._anchor(tag, root), self._emit(value), self._style(tag))

    def _block(self, tag: str, zeilen: list, root=None) -> None:
        self._emit_all(zeilen)
        set_block(self._anchor(tag, root), zeilen, self._style(tag))

    def _table(self, tag: str, root=None):
        sdt = self._anchor(tag, root)
        tbls = tables_of(sdt)
        if not tbls:
            raise OfferteError("E101", f"{tag}: kein Tabellenelement")
        return sdt, tbls[0]

    # -- Deckblatt (Abschnitt 9) -------------------------------------------

    def deckblatt(self, erste: StandortContext, d: Derived) -> None:
        ort = erste.get("kunde.plz_ort") or {}
        kontakt = erste.get("kunde.kontakt") or {}
        name = " ".join(
            x
            for x in (
                self.crm.get("kontakt.vorname") or kontakt.get("vorname", ""),
                self.crm.get("kontakt.nachname") or kontakt.get("nachname", ""),
            )
            if x
        )
        kunde = [erste.text("kunde.firma")]
        if self.crm.get("kontakt.anrede"):
            kunde.append(self.crm.get("kontakt.anrede"))
        if name:
            kunde.append(name)
        kunde.append(erste.text("kunde.strasse"))
        kunde.append(trim(f"{ort.get('plz', '')} {ort.get('ort', '')}"))
        self._block("OFF.KUNDE", [z for z in kunde if z])

        # OFF.ANBIETER ist statisch (Abschnitt 3.2) und bleibt unverändert.
        resolve(self._anchor("OFF.ANBIETER"))

        vk = [erste.text("vk.name")]
        for feld, praefix in (
            ("vk.funktion", ""),
            ("vk.telefon", "Direkt "),
            ("vk.email", ""),
        ):
            wert = self.crm.get(feld)
            if wert:
                vk.append(praefix + wert)
        self._block("OFF.KONTAKT", [z for z in vk if z])

        self._text("OFF.KLASSIFIZIERUNG", T.klassifizierung(self.b))
        self._text(
            "OFF.NUMMER", self.crm.offertnummer(erste.text("verkaufschance"), self.warn)
        )
        self._text("OFF.VERSION", self.crm.offertversion(self.warn))
        self._text("OFF.DATUM", date_de(erste.get("datum")))
        self._text("OFF.GUELTIG_BIS", T.gueltigkeit(d, self.b))

    # -- Standorte (Abschnitt 11) ------------------------------------------

    def klone_standorte(self, anzahl: int) -> dict[str, list]:
        """Je Standort eine Kopie der wiederholten Anker erzeugen."""
        for tag in PER_STANDORT:
            anker = self._anchor(tag)
            letzte = anker
            for _ in range(anzahl - 1):
                letzte = clone_anchor_after(letzte)
        tm = tag_map(self.body)
        return {tag: tm[tag] for tag in PER_STANDORT}

    def standort(self, sec_standort, sec_service, tbl_total_sdt, ctx: StandortContext, d: Derived) -> None:
        self._text("HEAD.STANDORT", T.head_standort(ctx, self.b), sec_standort)
        self._text("LINE.STANDORT_ADRESSE", T.line_adresse(ctx, self.b), sec_standort)
        self._hardware(ctx, sec_standort)
        self._dienstleistung(ctx, d, sec_standort)

        self._text("HEAD.SERVICE_STANDORT", T.head_standort(ctx, self.b), sec_service)
        self._service(ctx, d, sec_service)

        self._total(tbl_total_sdt, T.total_zeilen(ctx, d, self.b))

    def _hardware(self, ctx: StandortContext, root) -> None:
        sdt, tbl = self._table("TBL.HARDWARE", root)

        positionen = list(ctx.listen.get("hardware", []))
        positionen += ctx.listen.get("solutions.sw", [])
        positionen += ctx.listen.get("solutions.maint", [])

        # Das Kalktool Q4 2025 führt keine Artikelnummern (Abschnitt 16, Punkt 1).
        # Eine Spalte voller Gedankenstriche hilft niemandem, deshalb entfällt
        # sie, solange keine einzige Position eine Nummer trägt.  Sobald das
        # Kalktool welche liefert, erscheint sie von selbst wieder.
        mit_artnr = any(p.artnr not in ("", "–") for p in positionen)

        if not mit_artnr:
            remove_column(tbl, 0)
        kopf = cells(rows(tbl)[0])
        for zelle, titel in zip(kopf, T.kopf_hardware(mit_artnr, self.b)):
            set_cell_paragraphs(zelle, [titel])
        datensaetze = [
            ([p.artnr] if mit_artnr else []) + [p.bezeichnung, p.stueck] for p in positionen
        ]

        fill_rows(tbl, 1, datensaetze)
        # Listentabelle ohne Summenzeile: lastRow aus (Abschnitt 10.4).
        set_tbl_look(tbl, self.mapping.style("tbllook_liste", "04A0"))

    def _dienstleistung(self, ctx: StandortContext, d: Derived, root) -> None:
        if not d.show["dienstleistung"]:
            remove(self._anchor("HEAD.DL", root))
            remove(self._anchor("TBL.DIENSTLEISTUNG", root))
            return
        self._text("HEAD.DL", T.head_dl(ctx, self.b), root)
        sdt, tbl = self._table("TBL.DIENSTLEISTUNG", root)
        for zelle, titel in zip(cells(rows(tbl)[0]), T.kopf_dienstleistung(self.b)):
            set_cell_paragraphs(zelle, [titel])
        datensaetze = [[p.bezeichnung, chf(p.betrag)] for p in ctx.listen["dienstleistung"]]
        for p in ctx.listen.get("solutions.dl", []):
            datensaetze.append([p.bezeichnung, chf(p.betrag)])
        datensaetze.append([T.dl_total_label(self.b), chf(d.dienstleistung_total)])
        self._emit_all(datensaetze)
        fill_rows(tbl, 1, datensaetze)
        set_tbl_look(tbl, self.mapping.style("tbllook_summe", "04E0"))

    def _service(self, ctx: StandortContext, d: Derived, root) -> None:
        sdt, tbl = self._table("TBL.SERVICE", root)
        for zelle, titel in zip(cells(rows(tbl)[0]), T.kopf_service(d, self.b)):
            set_cell_paragraphs(zelle, [titel])
        # Trägt keine Zeile eines Blocks einen Betrag, bleibt die Zelle leer –
        # sonst entstünden mehrere leere Absätze untereinander.
        datensaetze = [
            [texte, betraege if any(betraege) else [""]]
            for texte, betraege in T.service_zeilen(ctx, d, self.b)
        ]
        self._emit_all(datensaetze)
        fill_rows(tbl, 1, datensaetze)
        # Kapitel 1.2 zeigt die Servicebestandteile ohne Summenzeile
        # (Abschnitt 5.4); mit lastRow käme die letzte Zeile fett und läse
        # sich wie ein Total.
        set_tbl_look(tbl, self.mapping.style("tbllook_liste", "04A0"))

    def _total(self, sdt, zeilen: list[tuple[str, str]]) -> None:
        tbls = tables_of(sdt)
        if not tbls:
            raise OfferteError("E101", "TBL.TOTAL: kein Tabellenelement")
        self._emit_all(zeilen)
        fill_rows(tbls[0], 0, [[label, betrag] for label, betrag in zeilen])
        set_tbl_look(tbls[0], self.mapping.style("tbllook_summe", "04E0"))

    def gesamttotal(self, g: Gesamt, variante: str, anzahl: int) -> None:
        """Summe über alle Standorte; bei einem Standort entfällt sie ersatzlos."""
        sdt = self._anchor("TBL.GESAMTTOTAL")
        if anzahl <= 1:
            remove(sdt)
            return
        self._total(sdt, T.gesamt_zeilen(g.einmalig, g.monatlich, g.kauf, variante, self.b))

    # -- Vertragstext, Konditionen, Schluss --------------------------------

    def vertragstext(self, ctx: StandortContext, d: Derived) -> None:
        head, absaetze = T.vertragstext(ctx, d, self.b)
        self._text("HEAD.VERTRAGSTEXT", head)
        sdt = self._anchor("SW.VERTRAGSTEXT")
        select_switch(sdt, f"SW.VERTRAGSTEXT.{d.variante}")
        self._emit_all(absaetze)
        set_block(sdt, absaetze, "Normal")

    def konditionen(self, ctx: StandortContext, d: Derived) -> None:
        tbl_sdt = self._anchor("TBL.KONDITIONEN")
        self._block("KOND.ABRECHNUNG", T.konditionen_abrechnung(ctx, self.b), tbl_sdt)
        self._block("KOND.RECHNUNG", T.konditionen_rechnung(ctx, d, self.b), tbl_sdt)
        # Die Konditionentabelle ist statisch und keine Summentabelle – ihr
        # tblLook bleibt so, wie die Vorlage es definiert (Abschnitt 8.4).

    def schluss(self, standorte: list[StandortContext]) -> None:
        erste = standorte[0]
        self._text("OFF.ORT_DATUM", T.ort_datum(erste, self.b))
        self._text("LINE.NACHWEIS", T.nachweis(standorte, self.b))

    # -- Gerätedatenblätter ------------------------------------------------

    def hardware_kapitel(
        self, blaetter: list[tuple[str, Datenblatt]], mit_spezifikation: bool
    ) -> None:
        """Je Gerät ein Abschnitt aus dem zugehörigen Datenblatt.

        Ohne Datenblätter entfällt das Kapitel ersatzlos – kein leerer
        Abschnitt, keine Überschrift.
        """
        from .docxutil.uebernehmen import Uebernahme

        sdt = self._anchor("SEC.HARDWARE")
        if not blaetter:
            remove(sdt)
            return

        inhalt = content_children(sdt)
        if not inhalt:
            raise OfferteError("E101", "SEC.HARDWARE ohne Absatz")
        muster = inhalt[0]

        uebernahme = Uebernahme(self.doc, STIL_ABBILDUNG)
        bloecke = [
            make_paragraph(muster, self.b.text("hardware_kapitel"), "Heading1"),
            make_paragraph(muster, self.b.text("hardware_gruppe"), "Heading2"),
        ]
        for _bezeichnung, blatt in blaetter:
            quelle = blatt.laden()
            uebernahme.vorbereiten(quelle)
            for block in blatt.bloecke(mit_spezifikation):
                bloecke.append(uebernahme.block(block, quelle))

        replace_children(sdt, bloecke)

    # -- Abschluss ---------------------------------------------------------

    def resolve_all(self) -> None:
        """Alle verbliebenen Anker auflösen – ausser dem Inhaltsverzeichnis."""
        for tag, elemente in tag_map(self.body).items():
            if tag in ("SYS.TOC", "Seitenumbruch nicht löschen"):
                continue
            for el in elemente:
                resolve(el)


def render(
    doc,
    standorte: list[tuple[StandortContext, Derived]],
    gesamt: Gesamt,
    mapping: Mapping,
    crm: CRM,
    warn: WarningCollector,
    bausteine: Bausteine | None = None,
    datenblaetter: list | None = None,
    mit_spezifikation: bool = True,
) -> set[str]:
    """Vollständige Befüllung; gibt die selbst gesetzten Beträge zurück."""
    r = Renderer(doc, mapping, crm, warn, bausteine)
    erste_ctx, erste_d = standorte[0]

    r.deckblatt(erste_ctx, erste_d)
    kopien = r.klone_standorte(len(standorte))
    for i, (ctx, d) in enumerate(standorte):
        r.standort(
            kopien["SEC.STANDORT"][i],
            kopien["SEC.SERVICE"][i],
            kopien["TBL.TOTAL"][i],
            ctx,
            d,
        )
    r.gesamttotal(gesamt, erste_d.variante, len(standorte))

    # Bei unterschiedlichen Laufzeiten nennt der Vertragstext die längste (W310).
    leit_ctx = max(standorte, key=lambda s: s[0].num("laufzeit"))[0]
    r.vertragstext(leit_ctx, erste_d)
    r.hardware_kapitel(datenblaetter or [], mit_spezifikation)
    r.konditionen(erste_ctx, erste_d)
    r.schluss([c for c, _ in standorte])
    r.resolve_all()
    return r.emitted
