"""Tabellenregeln (Abschnitt 10).

Jede Tabelle der Vorlage hat genau eine Kopfzeile und genau eine Musterzeile.
Der Generator klont die Musterzeile je Datensatz und entfernt die Musterzeile
danach.  Er baut nie eine Tabelle neu auf.
"""

from __future__ import annotations

from docx.oxml.ns import qn

from .xmlutil import (
    W,
    clone,
    delete,
    set_paragraph_style,
    set_paragraph_text,
    unwrap_inline_sdts,
)


def rows(tbl_el) -> list:
    return tbl_el.findall(W("w:tr"))


def cells(tr_el) -> list:
    return tr_el.findall(W("w:tc"))


def cell_paragraphs(tc_el) -> list:
    return tc_el.findall(W("w:p"))


def set_cell_paragraphs(tc_el, texts: list[str], styles: list[str] | None = None) -> None:
    """Zellinhalt absatzweise setzen (Abschnitt 10.2).

    Überzählige Absätze werden gelöscht, fehlende durch Klonen des letzten
    Absatzes ergänzt.  Steuerelemente in der Zelle werden vorher aufgelöst,
    sonst überleben Reste der Vorlage sichtbar im Text (Abschnitt 10.3).
    """
    unwrap_inline_sdts(tc_el)
    texts = list(texts) or [""]
    paras = cell_paragraphs(tc_el)
    if not paras:
        raise ValueError("Tabellenzelle ohne Absatz")

    while len(paras) < len(texts):
        neu = clone(paras[-1])
        paras[-1].addnext(neu)
        paras = cell_paragraphs(tc_el)
    for extra in paras[len(texts) :]:
        delete(extra)
    paras = cell_paragraphs(tc_el)

    for i, (p, text) in enumerate(zip(paras, texts)):
        set_paragraph_text(p, text)
        if styles and i < len(styles) and styles[i]:
            set_paragraph_style(p, styles[i])


def clone_row(tbl_el, muster_tr):
    """Musterzeile klonen und ans Tabellenende hängen."""
    neu = clone(muster_tr)
    tbl_el.append(neu)
    return neu


def fill_rows(tbl_el, muster_index: int, datensaetze: list[list]) -> list:
    """Je Datensatz eine Musterzeile klonen und füllen.

    ``datensaetze`` ist eine Liste von Zeilen; eine Zeile ist eine Liste von
    Zellen; eine Zelle ist eine Liste von Absatztexten.
    """
    trs = rows(tbl_el)
    if muster_index >= len(trs):
        raise ValueError(f"Musterzeile {muster_index} fehlt (Tabelle hat {len(trs)} Zeilen)")
    muster = trs[muster_index]

    erzeugt = []
    for satz in datensaetze:
        tr = clone_row(tbl_el, muster)
        tcs = cells(tr)
        for tc, inhalt in zip(tcs, satz):
            if inhalt is None:
                continue
            texts = inhalt if isinstance(inhalt, list) else [inhalt]
            set_cell_paragraphs(tc, [str(t) for t in texts])
        # Nicht belieferte Zellen leeren, damit kein Vorlagentext stehenbleibt.
        for tc in tcs[len(satz) :]:
            set_cell_paragraphs(tc, [""])
        erzeugt.append(tr)

    delete(muster)
    return erzeugt


def remove_column(tbl_el, index: int) -> None:
    """Eine Spalte samt ihrer Breite aus der Tabelle entfernen.

    Die freiwerdende Breite geht an die Nachbarspalte, damit die Tabelle so
    breit bleibt wie in der Vorlage.  Ohne diese Umverteilung zöge sich die
    Tabelle zusammen und passte nicht mehr zum übrigen Satzspiegel.
    """
    grid = tbl_el.find(W("w:tblGrid"))
    if grid is not None:
        cols = grid.findall(W("w:gridCol"))
        if index < len(cols) and len(cols) > 1:
            frei = int(cols[index].get(qn("w:w")) or 0)
            nachbar = cols[index + 1] if index + 1 < len(cols) else cols[index - 1]
            nachbar.set(qn("w:w"), str(int(nachbar.get(qn("w:w")) or 0) + frei))
            delete(cols[index])

    for tr in rows(tbl_el):
        tcs = cells(tr)
        if index >= len(tcs) or len(tcs) <= 1:
            continue
        frei = _cell_width(tcs[index])
        nachbar = tcs[index + 1] if index + 1 < len(tcs) else tcs[index - 1]
        _set_cell_width(nachbar, _cell_width(nachbar) + frei)
        delete(tcs[index])


def _cell_width(tc_el) -> int:
    tc_pr = tc_el.find(W("w:tcPr"))
    if tc_pr is None:
        return 0
    tc_w = tc_pr.find(W("w:tcW"))
    if tc_w is None or tc_w.get(qn("w:type")) not in (None, "dxa"):
        return 0
    try:
        return int(tc_w.get(qn("w:w")) or 0)
    except ValueError:
        return 0


def _set_cell_width(tc_el, breite: int) -> None:
    tc_pr = tc_el.find(W("w:tcPr"))
    if tc_pr is None:
        return
    tc_w = tc_pr.find(W("w:tcW"))
    if tc_w is None:
        return
    tc_w.set(qn("w:w"), str(breite))
    tc_w.set(qn("w:type"), "dxa")


def set_tbl_look(tbl_el, value: str) -> None:
    """``tblLook`` setzen – steuert die bedingte Formatierung (Abschnitt 10.4).

    Listentabellen ohne Summenzeile brauchen ``04A0`` (ohne ``lastRow``),
    sonst wird die letzte Position fett dargestellt und liest sich wie ein Total.
    """
    tbl_pr = tbl_el.find(W("w:tblPr"))
    if tbl_pr is None:
        return
    look = tbl_pr.find(W("w:tblLook"))
    if look is None:
        look = tbl_pr.makeelement(W("w:tblLook"), {})
        tbl_pr.append(look)
    look.set(qn("w:val"), value)
    bits = int(value, 16)
    look.set(qn("w:firstRow"), "1" if bits & 0x0020 else "0")
    look.set(qn("w:lastRow"), "1" if bits & 0x0040 else "0")
    look.set(qn("w:firstColumn"), "1" if bits & 0x0080 else "0")
    look.set(qn("w:lastColumn"), "1" if bits & 0x0100 else "0")
    look.set(qn("w:noHBand"), "1" if bits & 0x0200 else "0")
    look.set(qn("w:noVBand"), "1" if bits & 0x0400 else "0")
