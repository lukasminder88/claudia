"""Bausteine für die Arbeit an ``document.xml``.

Der Generator baut nie ein Element neu auf, wenn er es klonen kann – dabei
gingen Spaltenbreiten (``tblGrid``), Rahmen und Zeichenformate verloren
(Abschnitt 10.1).
"""

from __future__ import annotations

import copy

from docx.oxml.ns import qn
from docx.table import Table
from docx.text.paragraph import Paragraph


def W(tag: str) -> str:
    """``"w:p"`` -> vollqualifizierter Elementname."""
    return qn(tag)


def clone(element):
    """Tiefe Kopie eines Elements."""
    return copy.deepcopy(element)


def delete(element) -> None:
    """Element aus seinem Elternknoten entfernen."""
    parent = element.getparent()
    if parent is not None:
        parent.remove(element)


def iter_block_items(parent, doc):
    """Absätze und Tabellen eines Containers in Dokumentreihenfolge."""
    for child in parent.iterchildren():
        if child.tag == W("w:p"):
            yield Paragraph(child, doc)
        elif child.tag == W("w:tbl"):
            yield Table(child, doc)


# --- Absätze ---------------------------------------------------------------


def paragraph_text(p_el) -> str:
    """Sichtbarer Text eines Absatzes, inklusive Inhalt von Steuerelementen."""
    parts = []
    for node in p_el.iter():
        if node.tag == W("w:t"):
            parts.append(node.text or "")
        elif node.tag == W("w:tab"):
            parts.append("\t")
        elif node.tag in (W("w:br"), W("w:cr")):
            parts.append("\n")
    return "".join(parts)


def _first_run(p_el):
    for r in p_el.findall(W("w:r")):
        return r
    return None


def set_paragraph_text(p_el, text: str) -> None:
    """Absatzinhalt durch genau einen Run ersetzen.

    Die Zeichenformatierung des ersten bestehenden Runs bleibt erhalten
    (Abschnitt 10.2).  Zeilenumbrüche im Text werden zu ``w:br``.
    """
    template_run = _first_run(p_el)
    rpr = None
    if template_run is not None:
        found = template_run.find(W("w:rPr"))
        if found is not None:
            rpr = clone(found)

    for child in list(p_el):
        if child.tag != W("w:pPr"):
            p_el.remove(child)

    if text == "":
        return

    run = p_el.makeelement(W("w:r"), {})
    if rpr is not None:
        run.append(rpr)
    for i, line in enumerate(str(text).split("\n")):
        if i:
            run.append(run.makeelement(W("w:br"), {}))
        t = run.makeelement(W("w:t"), {})
        t.set(qn("xml:space"), "preserve")
        t.text = line
        run.append(t)
    p_el.append(run)


def set_paragraph_style(p_el, style_id: str) -> None:
    """Formatvorlage eines Absatzes über ihre interne ID setzen."""
    ppr = p_el.find(W("w:pPr"))
    if ppr is None:
        ppr = p_el.makeelement(W("w:pPr"), {})
        p_el.insert(0, ppr)
    pstyle = ppr.find(W("w:pStyle"))
    if pstyle is None:
        pstyle = ppr.makeelement(W("w:pStyle"), {})
        ppr.insert(0, pstyle)
    pstyle.set(qn("w:val"), style_id)


def make_paragraph(like_p_el, text: str = "", style_id: str | None = None):
    """Neuen Absatz aus einem Muster klonen und füllen."""
    p = clone(like_p_el)
    set_paragraph_text(p, text)
    if style_id:
        set_paragraph_style(p, style_id)
    return p


# --- Inhaltssteuerelemente -------------------------------------------------


def make_sdt(tag: str, alias: str | None = None):
    """Leeres Inhaltssteuerelement mit gesetztem ``w:tag`` erzeugen."""
    from lxml import etree

    nsmap = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    sdt = etree.Element(W("w:sdt"), nsmap=nsmap)
    pr = etree.SubElement(sdt, W("w:sdtPr"))
    a = etree.SubElement(pr, W("w:alias"))
    a.set(qn("w:val"), alias or tag)
    t = etree.SubElement(pr, W("w:tag"))
    t.set(qn("w:val"), tag)
    etree.SubElement(pr, W("w:id")).set(qn("w:val"), str(abs(hash(tag)) % 10**8))
    etree.SubElement(sdt, W("w:sdtContent"))
    return sdt


def sdt_content(sdt_el):
    return sdt_el.find(W("w:sdtContent"))


def sdt_tag(sdt_el) -> str | None:
    pr = sdt_el.find(W("w:sdtPr"))
    if pr is None:
        return None
    tag = pr.find(W("w:tag"))
    return tag.get(qn("w:val")) if tag is not None else None


def wrap_in_sdt(elements: list, tag: str, alias: str | None = None):
    """Eine Folge benachbarter Blockelemente in ein Steuerelement fassen."""
    if not elements:
        raise ValueError(f"wrap_in_sdt: keine Elemente für {tag}")
    parent = elements[0].getparent()
    sdt = make_sdt(tag, alias)
    parent.insert(parent.index(elements[0]), sdt)
    content = sdt_content(sdt)
    for el in elements:
        parent.remove(el)
        content.append(el)
    return sdt


def unwrap_sdt(sdt_el) -> None:
    """``w:sdt`` durch seinen Inhalt ersetzen (Abschnitt 10.3).

    Ohne diesen Schritt überleben Reste der Vorlage sichtbar im Text.
    """
    parent = sdt_el.getparent()
    if parent is None:
        return
    content = sdt_content(sdt_el)
    idx = parent.index(sdt_el)
    if content is not None:
        for child in list(content):
            content.remove(child)
            parent.insert(idx, child)
            idx += 1
    parent.remove(sdt_el)


def unwrap_inline_sdts(scope_el) -> None:
    """Alle Steuerelemente innerhalb eines Bereichs auflösen."""
    while True:
        found = scope_el.findall(".//" + W("w:sdt"))
        if not found:
            return
        for sdt in found:
            unwrap_sdt(sdt)
