"""Anker im Dokument finden und ersetzen.

Adressiert wird ausschliesslich über ``w:tag`` – nie über Textsuche
(Spezifikation V3, Abschnitt 0 und 3).
"""

from __future__ import annotations

from docx.oxml.ns import qn

from .xmlutil import (
    W,
    clone,
    delete,
    make_paragraph,
    sdt_content,
    sdt_tag,
    set_paragraph_style,
    set_paragraph_text,
    unwrap_inline_sdts,
    unwrap_sdt,
)


def iter_sdts(root):
    """Alle Steuerelemente unterhalb eines Knotens."""
    return root.findall(".//" + W("w:sdt"))


def tag_map(root) -> dict[str, list]:
    """``w:tag`` -> Liste der zugehörigen Steuerelemente, in Dokumentreihenfolge."""
    out: dict[str, list] = {}
    for sdt in iter_sdts(root):
        tag = sdt_tag(sdt)
        if tag:
            out.setdefault(tag, []).append(sdt)
    return out


def find(root, tag: str):
    """Genau ein Steuerelement zu einem Tag, sonst ``None``."""
    hits = tag_map(root).get(tag) or []
    return hits[0] if hits else None


def content_children(sdt_el) -> list:
    content = sdt_content(sdt_el)
    return list(content) if content is not None else []


def paragraphs_of(sdt_el) -> list:
    return [c for c in content_children(sdt_el) if c.tag == W("w:p")]


def tables_of(sdt_el) -> list:
    return [c for c in content_children(sdt_el) if c.tag == W("w:tbl")]


# --- Ankertypen ------------------------------------------------------------


def set_text(sdt_el, text: str, style_id: str | None = None) -> None:
    """TEXT-Anker: Inhalt durch genau einen Run ersetzen (Abschnitt 3.1)."""
    unwrap_inline_sdts(sdt_content(sdt_el))
    paras = paragraphs_of(sdt_el)
    if not paras:
        raise ValueError(f"TEXT-Anker ohne Absatz: {sdt_tag(sdt_el)}")
    for extra in paras[1:]:
        delete(extra)
    set_paragraph_text(paras[0], text)
    if style_id:
        set_paragraph_style(paras[0], style_id)


def set_block(sdt_el, zeilen: list, default_style: str | None = None) -> None:
    """BLOCK-Anker: Inhalt durch n Absätze ersetzen, Style je Zeile.

    ``zeilen`` ist eine Liste aus ``str`` oder ``(text, style_id)``.
    Eine leere Liste löscht den Absatz vollständig – ein leeres Kann-Feld
    erzeugt keine leere Zeile (Abschnitt 4.4).
    """
    content = sdt_content(sdt_el)
    unwrap_inline_sdts(content)
    paras = paragraphs_of(sdt_el)
    if not paras:
        raise ValueError(f"BLOCK-Anker ohne Absatz: {sdt_tag(sdt_el)}")
    muster = clone(paras[0])

    for p in paras:
        delete(p)
    for zeile in zeilen:
        text, style = zeile if isinstance(zeile, tuple) else (zeile, default_style)
        content.append(make_paragraph(muster, text, style))


def replace_children(sdt_el, elements: list) -> None:
    """Inhalt eines Ankers durch fertige Blockelemente ersetzen."""
    content = sdt_content(sdt_el)
    for child in list(content):
        content.remove(child)
    for el in elements:
        content.append(el)


def clone_anchor_after(sdt_el, tag_suffix: str = ""):
    """Ein Anker-Steuerelement direkt hinter sich selbst duplizieren.

    Grundlage der Standortwiederholung (Abschnitt 11).
    """
    neu = clone(sdt_el)
    if tag_suffix:
        pr = neu.find(W("w:sdtPr"))
        t = pr.find(W("w:tag")) if pr is not None else None
        if t is not None:
            t.set(qn("w:val"), sdt_tag(sdt_el) + tag_suffix)
    sdt_el.addnext(neu)
    return neu


def select_switch(sdt_el, variante_tag: str) -> None:
    """SWITCH-Anker: genau eine Kindvariante bleibt stehen (Abschnitt 3.1)."""
    content = sdt_content(sdt_el)
    treffer = None
    for child in list(content):
        if child.tag != W("w:sdt"):
            continue
        if sdt_tag(child) == variante_tag:
            treffer = child
        else:
            content.remove(child)
    if treffer is None:
        raise ValueError(f"SWITCH-Variante fehlt: {variante_tag}")
    unwrap_sdt(treffer)


def resolve(sdt_el) -> None:
    """Anker auflösen: ``w:sdt`` durch seinen Inhalt ersetzen."""
    unwrap_sdt(sdt_el)


def remove(sdt_el) -> None:
    """Anker samt Inhalt entfernen."""
    delete(sdt_el)
