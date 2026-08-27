"""Schritt RENDER: Anker füllen, Standort-Blöcke klonen (Abschnitt 7 der Pipeline).

Erst dieser Schritt berührt das Dokument.  Adressiert wird ausschliesslich über
``w:tag``; Tabellen werden geklont, nie neu aufgebaut (Abschnitt 10).
"""

from __future__ import annotations

import re

from . import textblocks as T
from .anchors import BY_TAG, PER_STANDORT
from .crm import CRM
from .derive import Derived, Gesamt
from .docxutil.anchor_ops import (
    clone_anchor_after,
    find,
    remove,
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
from .errors import OfferteError, WarningCollector
from .extract import StandortContext
from .formatters import chf, date_de, trim
from .mapping import Mapping

RE_BETRAG = re.compile(r"-?\d[\d’]*(?:\.\d+)?")


class Renderer:
    """Füllt eine ankerbasierte Vorlage aus n Standortkontexten."""

    def __init__(self, doc, mapping: Mapping, crm: CRM, warn: WarningCollector) -> None:
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

        self._text("OFF.KLASSIFIZIERUNG", T.KLASSIFIZIERUNG)
        self._text(
            "OFF.NUMMER", self.crm.offertnummer(erste.text("verkaufschance"), self.warn)
        )
        self._text("OFF.VERSION", self.crm.offertversion(self.warn))
        self._text("OFF.DATUM", date_de(erste.get("datum")))
        self._text(
            "OFF.GUELTIG_BIS", T.GUELTIGKEIT.format(gueltig_bis=date_de(d.gueltig_bis))
        )

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
        self._text("HEAD.STANDORT", T.head_standort(ctx), sec_standort)
        self._text("LINE.STANDORT_ADRESSE", T.line_adresse(ctx), sec_standort)
        self._hardware(ctx, sec_standort)
        self._dienstleistung(ctx, d, sec_standort)

        self._text("HEAD.SERVICE_STANDORT", T.head_standort(ctx), sec_service)
        self._service(ctx, d, sec_service)

        self._total(tbl_total_sdt, T.total_zeilen(ctx, d))

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

        kopf = cells(rows(tbl)[0])
        if mit_artnr:
            set_cell_paragraphs(kopf[0], ["Artikel No."])
            set_cell_paragraphs(kopf[1], ["Bezeichnung"])
            set_cell_paragraphs(kopf[2], ["Stück"])
            datensaetze = [[p.artnr, p.bezeichnung, p.stueck] for p in positionen]
        else:
            remove_column(tbl, 0)
            kopf = cells(rows(tbl)[0])
            set_cell_paragraphs(kopf[0], ["Bezeichnung"])
            set_cell_paragraphs(kopf[1], ["Stück"])
            datensaetze = [[p.bezeichnung, p.stueck] for p in positionen]

        fill_rows(tbl, 1, datensaetze)
        # Listentabelle ohne Summenzeile: lastRow aus (Abschnitt 10.4).
        set_tbl_look(tbl, self.mapping.style("tbllook_liste", "04A0"))

    def _dienstleistung(self, ctx: StandortContext, d: Derived, root) -> None:
        if not d.show["dienstleistung"]:
            remove(self._anchor("HEAD.DL", root))
            remove(self._anchor("TBL.DIENSTLEISTUNG", root))
            return
        self._text("HEAD.DL", T.head_dl(ctx), root)
        sdt, tbl = self._table("TBL.DIENSTLEISTUNG", root)
        set_cell_paragraphs(cells(rows(tbl)[0])[0], ["Leistung"])
        set_cell_paragraphs(cells(rows(tbl)[0])[1], ["Betrag"])
        datensaetze = [[p.bezeichnung, chf(p.betrag)] for p in ctx.listen["dienstleistung"]]
        for p in ctx.listen.get("solutions.dl", []):
            datensaetze.append([p.bezeichnung, chf(p.betrag)])
        datensaetze.append([T.DL_TOTAL_LABEL, chf(d.dienstleistung_total)])
        self._emit_all(datensaetze)
        fill_rows(tbl, 1, datensaetze)
        set_tbl_look(tbl, self.mapping.style("tbllook_summe", "04E0"))

    def _service(self, ctx: StandortContext, d: Derived, root) -> None:
        sdt, tbl = self._table("TBL.SERVICE", root)
        set_cell_paragraphs(cells(rows(tbl)[0])[0], [T.SERVICE_KOPF.format(geraet=d.geraet)])
        set_cell_paragraphs(cells(rows(tbl)[0])[1], ["Total"])
        datensaetze = []
        for texte, betrag in T.service_zeilen(ctx, d):
            betraege = betrag if isinstance(betrag, list) else [betrag]
            # Trägt keine Zeile des Blocks einen Betrag, bleibt die Zelle leer –
            # sonst entstünden mehrere leere Absätze untereinander.
            if not any(b for b in betraege):
                betraege = [""]
            datensaetze.append([texte, betraege])
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
        zeilen = []
        if g.einmalig > 0:
            zeilen.append((T.GESAMT_EINMALIG, chf(g.einmalig)))
        if variante == "KAUF":
            zeilen.append((T.GESAMT_KAUF, chf(g.kauf)))
        else:
            zeilen.append((T.GESAMT_MONATLICH, chf(g.monatlich)))
        self._total(sdt, zeilen)

    # -- Vertragstext, Konditionen, Schluss --------------------------------

    def vertragstext(self, ctx: StandortContext, d: Derived) -> None:
        head, absaetze = T.vertragstext(ctx, d)
        self._text("HEAD.VERTRAGSTEXT", head)
        sdt = self._anchor("SW.VERTRAGSTEXT")
        select_switch(sdt, f"SW.VERTRAGSTEXT.{d.variante}")
        self._emit_all(absaetze)
        set_block(sdt, absaetze, "Normal")

    def konditionen(self, ctx: StandortContext, d: Derived) -> None:
        tbl_sdt = self._anchor("TBL.KONDITIONEN")
        self._block("KOND.ABRECHNUNG", T.konditionen_abrechnung(ctx), tbl_sdt)
        self._block("KOND.RECHNUNG", T.konditionen_rechnung(ctx, d), tbl_sdt)
        # Die Konditionentabelle ist statisch und keine Summentabelle – ihr
        # tblLook bleibt so, wie die Vorlage es definiert (Abschnitt 8.4).

    def schluss(self, standorte: list[StandortContext]) -> None:
        erste = standorte[0]
        self._text("OFF.ORT_DATUM", T.ORT_DATUM.format(datum=date_de(erste.get("datum"))))
        self._text("LINE.NACHWEIS", T.nachweis(standorte))

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
) -> set[str]:
    """Vollständige Befüllung; gibt die selbst gesetzten Beträge zurück."""
    r = Renderer(doc, mapping, crm, warn)
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
    r.konditionen(erste_ctx, erste_d)
    r.schluss([c for c, _ in standorte])
    r.resolve_all()
    return r.emitted
