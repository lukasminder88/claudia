"""Feldwerte einfrieren (Abschnitt 12.2).

Die Vorlage enthält ``TIME``-Felder im Fliesstext (Deckblatt-Datum,
„Spreitenbach, …").  Diese würden beim Öffnen auf das Tagesdatum springen und
das Offertdatum überschreiben.  Das ``TIME``-Feld in der **Fusszeile** bleibt –
es ist das Druckdatum.
"""

from __future__ import annotations

from docx.oxml.ns import qn

from .xmlutil import W, delete

FELDTYPEN = ("TIME", "DATE", "CREATEDATE", "PRINTDATE", "SAVEDATE")


def _instr(run) -> str:
    parts = [t.text or "" for t in run.findall(W("w:instrText"))]
    return " ".join(parts)


def freeze_fields(scope_el, ersatz: str, typen=FELDTYPEN) -> int:
    """Feld-Runs durch einen statischen Run ersetzen.

    Sucht ``fldChar`` begin/separate/end samt ``instrText`` innerhalb eines
    Absatzes und ersetzt die ganze Folge durch den Ersatztext.
    """
    ersetzt = 0
    for p in scope_el.iter(W("w:p")):
        runs = p.findall(W("w:r"))
        i = 0
        while i < len(runs):
            fld = runs[i].find(W("w:fldChar"))
            if fld is None or fld.get(qn("w:fldCharType")) != "begin":
                i += 1
                continue
            ende = None
            instr = ""
            for j in range(i, len(runs)):
                instr += _instr(runs[j])
                f = runs[j].find(W("w:fldChar"))
                if f is not None and f.get(qn("w:fldCharType")) == "end":
                    ende = j
                    break
            if ende is None:
                i += 1
                continue
            name = instr.strip().split(" ")[0].upper() if instr.strip() else ""
            if name not in typen:
                i = ende + 1
                continue

            ziel = runs[i]
            _make_static(ziel, ersatz)
            for r in runs[i + 1 : ende + 1]:
                delete(r)
            ersetzt += 1
            runs = p.findall(W("w:r"))
            i = 0
    return ersetzt


def _make_static(run, text: str) -> None:
    for child in list(run):
        if child.tag != W("w:rPr"):
            run.remove(child)
    t = run.makeelement(W("w:t"), {})
    t.set(qn("xml:space"), "preserve")
    t.text = text
    run.append(t)


def set_update_fields(doc, value: bool = True) -> None:
    """``w:updateFields`` in ``settings.xml`` setzen (Abschnitt 12.1)."""
    settings = doc.settings.element
    el = settings.find(W("w:updateFields"))
    if el is None:
        el = settings.makeelement(W("w:updateFields"), {})
        settings.append(el)
    el.set(qn("w:val"), "true" if value else "false")
