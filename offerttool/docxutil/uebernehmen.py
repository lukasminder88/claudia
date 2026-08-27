"""Inhalte aus einem Word-Dokument in ein anderes übernehmen.

Ein Absatz lässt sich nicht einfach kopieren: er verweist über Bezeichner auf
Formatvorlagen, Nummerierungen und Bilder, die im Zieldokument entweder fehlen
oder etwas anderes bedeuten.  Diese Klasse führt Buch über alle drei und
schlüsselt jeden Verweis um.

Verwendet für die Gerätedatenblätter, deren Formatvorlagen sich mit denen der
Offertvorlage in **keinem einzigen** Bezeichner überschneiden.
"""

from __future__ import annotations

import io
import posixpath
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

from docx.oxml.ns import qn

from .xmlutil import W, clone

REL_BILD = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"


@dataclass
class Quelldokument:
    """Ein geöffnetes Quelldokument samt seiner Nebenteile."""

    pfad: Path
    document: object
    styles: object | None = None
    numbering: object | None = None
    beziehungen: dict[str, str] = field(default_factory=dict)
    medien: dict[str, bytes] = field(default_factory=dict)

    @classmethod
    def oeffnen(cls, pfad: str | Path) -> "Quelldokument":
        """Auch ``.dotx`` lesen – python-docx lehnt Vorlagen ab, das XML nicht."""
        from lxml import etree

        p = Path(pfad)
        with zipfile.ZipFile(p) as z:
            namen = set(z.namelist())

            def teil(name):
                return etree.fromstring(z.read(name)) if name in namen else None

            beziehungen = {}
            rels = teil("word/_rels/document.xml.rels")
            if rels is not None:
                for r in rels:
                    beziehungen[r.get("Id")] = (r.get("Type"), r.get("Target"))

            medien = {n: z.read(n) for n in namen if n.startswith("word/media/")}
            return cls(
                pfad=p,
                document=teil("word/document.xml"),
                styles=teil("word/styles.xml"),
                numbering=teil("word/numbering.xml"),
                beziehungen=beziehungen,
                medien=medien,
            )

    @property
    def body(self):
        return self.document.find(W("w:body"))


class Uebernahme:
    """Überträgt Blockelemente aus Quelldokumenten in ein Zieldokument."""

    def __init__(self, ziel_doc, stil_abbildung: dict[str, str] | None = None) -> None:
        self.ziel = ziel_doc
        # Bewusste Zuordnung: die Datenblätter heissen ihre Überschriften
        # anders als die Offertvorlage. Ohne diese Abbildung fände das
        # Inhaltsverzeichnis das Kapitel nicht.
        self.stil_abbildung = dict(stil_abbildung or {})
        self._stile_bekannt = self._vorhandene_stile()
        self._numids: dict[tuple[int, str], str] = {}
        self._bilder: dict[tuple[int, str], str] = {}
        self._naechste_numid = self._hoechste_numid() + 1

    # -- Formatvorlagen ---------------------------------------------------

    def _vorhandene_stile(self) -> set[str]:
        wurzel = self.ziel.styles.element
        return {s.get(qn("w:styleId")) for s in wurzel.findall(W("w:style"))}

    def stile_ergaenzen(self, quelle: Quelldokument) -> None:
        """Fehlende Formatvorlagen aus der Quelle übernehmen.

        Vorlagen, die im Ziel bereits existieren, bleiben unangetastet – die
        Offertvorlage ist verbindlich (Abschnitt 2.1).
        """
        if quelle.styles is None:
            return
        ziel_wurzel = self.ziel.styles.element
        for stil in quelle.styles.findall(W("w:style")):
            kennung = stil.get(qn("w:styleId"))
            if not kennung or kennung in self.stil_abbildung:
                continue
            if kennung in self._stile_bekannt:
                continue
            ziel_wurzel.append(clone(stil))
            self._stile_bekannt.add(kennung)

    def _stil_umschreiben(self, element) -> None:
        for tag in ("w:pStyle", "w:rStyle", "w:tblStyle"):
            for e in element.iter(W(tag)):
                alt = e.get(qn("w:val"))
                if alt in self.stil_abbildung:
                    e.set(qn("w:val"), self.stil_abbildung[alt])

    # -- Nummerierung -----------------------------------------------------

    def _hoechste_numid(self) -> int:
        try:
            wurzel = self.ziel.part.numbering_part.element
        except (KeyError, NotImplementedError, AttributeError):
            return 1000
        werte = [
            int(n.get(qn("w:numId")) or 0)
            for n in wurzel.findall(W("w:num"))
        ]
        return max(werte or [1000])

    def _ziel_numbering(self):
        try:
            return self.ziel.part.numbering_part.element
        except (KeyError, NotImplementedError, AttributeError):
            return None

    def nummerierung_ergaenzen(self, quelle: Quelldokument) -> None:
        """Listendefinitionen der Quelle unter neuen Bezeichnern übernehmen.

        Die Bezeichner beider Dokumente sind unabhängig vergeben; ohne
        Umschlüsselung zeigte eine Aufzählung des Datenblatts auf eine
        beliebige Liste der Offertvorlage.
        """
        if quelle.numbering is None:
            return
        ziel = self._ziel_numbering()
        if ziel is None:
            return

        # Zuerst die abstrakten Definitionen, dann die konkreten Nummern.
        abstrakt_alt_neu: dict[str, str] = {}
        vorhanden = {
            a.get(qn("w:abstractNumId"))
            for a in ziel.findall(W("w:abstractNum"))
        }
        naechste_abstrakt = max((int(x) for x in vorhanden if x and x.isdigit()), default=1000) + 1

        for a in quelle.numbering.findall(W("w:abstractNum")):
            alt = a.get(qn("w:abstractNumId"))
            neu = str(naechste_abstrakt)
            naechste_abstrakt += 1
            kopie = clone(a)
            kopie.set(qn("w:abstractNumId"), neu)
            # nsid und tmpl dürfen nicht kollidieren.
            for kind in kopie.findall(W("w:nsid")):
                kopie.remove(kind)
            self._stil_umschreiben(kopie)
            _vor_num_einfuegen(ziel, kopie)
            abstrakt_alt_neu[alt] = neu

        for n in quelle.numbering.findall(W("w:num")):
            alt = n.get(qn("w:numId"))
            verweis = n.find(W("w:abstractNumId"))
            if verweis is None:
                continue
            ziel_abstrakt = abstrakt_alt_neu.get(verweis.get(qn("w:val")))
            if ziel_abstrakt is None:
                continue
            neu = str(self._naechste_numid)
            self._naechste_numid += 1
            kopie = clone(n)
            kopie.set(qn("w:numId"), neu)
            kopie.find(W("w:abstractNumId")).set(qn("w:val"), ziel_abstrakt)
            ziel.append(kopie)
            self._numids[(id(quelle), alt)] = neu

    def _numid_umschreiben(self, element, quelle: Quelldokument) -> None:
        for e in element.iter(W("w:numId")):
            neu = self._numids.get((id(quelle), e.get(qn("w:val"))))
            if neu:
                e.set(qn("w:val"), neu)

    # -- Bilder -----------------------------------------------------------

    def _bild_uebernehmen(self, quelle: Quelldokument, rid: str) -> str | None:
        """Bildteil kopieren und eine Beziehung im Ziel anlegen.

        python-docx legt gleiche Bilder nur einmal ab und liefert die
        Beziehungskennung des Zieldokuments zurück.
        """
        schluessel = (id(quelle), rid)
        if schluessel in self._bilder:
            return self._bilder[schluessel]

        eintrag = quelle.beziehungen.get(rid)
        if not eintrag or eintrag[0] != REL_BILD:
            return None
        quellpfad = posixpath.normpath(posixpath.join("word", eintrag[1]))
        daten = quelle.medien.get(quellpfad)
        if daten is None:
            return None

        try:
            neue_rid, _bild = self.ziel.part.get_or_add_image(io.BytesIO(daten))
        except Exception:
            # Ein Bildformat, das python-docx nicht kennt (etwa EMF in
            # manchen Vorlagen). Der Verweis bleibt dann ungültig und der
            # Aufrufer erfährt es über den Rückgabewert.
            return None

        self._bilder[schluessel] = neue_rid
        return neue_rid

    def _bilder_umschreiben(self, element, quelle: Quelldokument) -> bool:
        """Alle Bildverweise umschlüsseln; meldet, ob alle auflösbar waren."""
        vollstaendig = True
        embed = qn("r:embed")
        link = qn("r:link")
        for e in element.iter():
            for attribut in (embed, link):
                alt = e.get(attribut)
                if not alt:
                    continue
                neu = self._bild_uebernehmen(quelle, alt)
                if neu:
                    e.set(attribut, neu)
                else:
                    vollstaendig = False
        return vollstaendig

    # -- Blockelemente ----------------------------------------------------

    def block(self, element, quelle: Quelldokument):
        """Ein Blockelement übernehmen und alle Verweise umschlüsseln."""
        kopie = clone(element)
        self._stil_umschreiben(kopie)
        self._numid_umschreiben(kopie, quelle)
        self._bilder_umschreiben(kopie, quelle)
        _fremde_verweise_entfernen(kopie)
        return kopie

    def vorbereiten(self, quelle: Quelldokument) -> None:
        """Formatvorlagen und Nummerierungen einer Quelle bereitstellen."""
        self.stile_ergaenzen(quelle)
        self.nummerierung_ergaenzen(quelle)


def _vor_num_einfuegen(numbering, element) -> None:
    """``w:abstractNum`` muss vor jedem ``w:num`` stehen."""
    erstes_num = numbering.find(W("w:num"))
    if erstes_num is None:
        numbering.append(element)
    else:
        erstes_num.addprevious(element)


def _fremde_verweise_entfernen(element) -> None:
    """Verweise entfernen, die im Ziel ins Leere zeigen würden.

    Hyperlinks und eingebettete Objekte des Datenblatts verweisen auf
    Beziehungen der Quelle. Ein Hyperlink verliert dabei nur sein Ziel, der
    Text bleibt stehen; ein Objekt ohne Ziel würde Word beanstanden.
    """
    r_id = qn("r:id")
    for e in list(element.iter(W("w:hyperlink"))):
        if e.get(r_id):
            del e.attrib[r_id]
    for tag in ("w:object", "w:pict"):
        for e in list(element.iter(W(tag))):
            hat_bild = any(x.get(qn("r:embed")) for x in e.iter())
            if not hat_bild and e.getparent() is not None:
                e.getparent().remove(e)
