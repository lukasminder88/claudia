"""Inhaltsverzeichnis neu aufbauen (Abschnitt 12.1).

Nach dem Rendern stimmen weder Einträge noch Seitenzahlen des
zwischengespeicherten Verzeichnisses.  Deterministisches Verfahren:

1. Alle Überschriften (Heading1–3) in Dokumentreihenfolge einsammeln.
2. Nummern vergeben: H1 -> ``n.0``, H2 -> ``n.m``, H3 -> ``n.m.k``.
3. Alle bestehenden ``_Toc``-Lesezeichen entfernen, je Überschrift ein neues setzen.
4. Dokument nach PDF rendern, Seitenzahl je Überschrift aus dem PDF-Text lesen.
5. Verzeichniseinträge aus den Vorlagen-Absätzen TOC1/TOC2/TOC3 klonen.
6. ``w:updateFields = true`` setzen, damit Word beim Öffnen nachrechnet.

Schritt 4 kostet einen zusätzlichen Rendervorgang, ist aber die einzige Methode,
die ohne Word-Automatisierung korrekte Seitenzahlen liefert.  Fehlt der
Renderer, entstehen Einträge ohne Seitenzahl und die Warnung ``W321``.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from docx.oxml.ns import qn

from .xmlutil import W, clone, delete, paragraph_text, set_paragraph_style, set_paragraph_text

HEADING_STYLES = {"Heading1": 1, "Heading2": 2, "Heading3": 3}
TOC_STYLES = {1: "TOC1", 2: "TOC2", 3: "TOC3"}


@dataclass
class Eintrag:
    nummer: str
    titel: str
    ebene: int
    bookmark: str
    seite: str = ""


def _p_style(p_el) -> str:
    ppr = p_el.find(W("w:pPr"))
    if ppr is None:
        return "Normal"
    st = ppr.find(W("w:pStyle"))
    return st.get(qn("w:val")) if st is not None else "Normal"


def collect_headings(body) -> list[Eintrag]:
    """Überschriften einsammeln und durchnummerieren (Schritte 1 und 2)."""
    zaehler = [0, 0, 0]
    eintraege: list[Eintrag] = []
    for p in body.iter(W("w:p")):
        ebene = HEADING_STYLES.get(_p_style(p))
        if ebene is None:
            continue
        titel = paragraph_text(p).strip()
        if not titel:
            continue
        zaehler[ebene - 1] += 1
        for i in range(ebene, 3):
            zaehler[i] = 0
        if ebene == 1:
            nummer = f"{zaehler[0]}.0"
        elif ebene == 2:
            nummer = f"{zaehler[0]}.{zaehler[1]}"
        else:
            nummer = f"{zaehler[0]}.{zaehler[1]}.{zaehler[2]}"
        eintraege.append(
            Eintrag(nummer, titel, ebene, f"_Toc{900000 + len(eintraege)}")
        )
    return eintraege


def set_bookmarks(body, eintraege: list[Eintrag]) -> None:
    """Bestehende ``_Toc``-Lesezeichen entfernen, neue setzen (Schritt 3)."""
    for tag in (W("w:bookmarkStart"), W("w:bookmarkEnd")):
        for bm in list(body.iter(tag)):
            name = bm.get(qn("w:name"))
            if tag == W("w:bookmarkStart") and name and name.startswith("_Toc"):
                _drop_pair(body, bm)

    index = 0
    for p in body.iter(W("w:p")):
        ebene = HEADING_STYLES.get(_p_style(p))
        if ebene is None or not paragraph_text(p).strip():
            continue
        if index >= len(eintraege):
            break
        e = eintraege[index]
        start = p.makeelement(W("w:bookmarkStart"), {})
        start.set(qn("w:id"), str(9000 + index))
        start.set(qn("w:name"), e.bookmark)
        ende = p.makeelement(W("w:bookmarkEnd"), {})
        ende.set(qn("w:id"), str(9000 + index))
        ppr = p.find(W("w:pPr"))
        p.insert(1 if ppr is not None else 0, start)
        p.append(ende)
        index += 1


def _drop_pair(body, start_el) -> None:
    bid = start_el.get(qn("w:id"))
    for end in list(body.iter(W("w:bookmarkEnd"))):
        if end.get(qn("w:id")) == bid:
            delete(end)
    delete(start_el)


# --- Seitenzahlen ----------------------------------------------------------


def soffice_verfuegbar() -> bool:
    return shutil.which("soffice") is not None


def seitenzahlen(docx_path: Path, eintraege: list[Eintrag]) -> bool:
    """Seitenzahl je Überschrift aus einem PDF-Rendering lesen (Schritt 4)."""
    seiten = _pdf_seiten(docx_path)
    if not seiten:
        return False
    # Die Verzeichnisseite selbst wird bei der Suche übersprungen.
    toc_seite = _toc_seite(seiten)
    offen = list(eintraege)
    for nr, text in enumerate(seiten, start=1):
        if nr == toc_seite:
            continue
        normal = _normalize(text)
        for e in list(offen):
            if _normalize(e.titel) and _normalize(e.titel) in normal:
                e.seite = str(nr)
                offen.remove(e)
    for e in eintraege:
        if not e.seite:
            e.seite = "1"
    return True


def _normalize(text: str) -> str:
    return " ".join(text.split()).lower()


def _toc_seite(seiten: list[str]) -> int:
    for nr, text in enumerate(seiten, start=1):
        if "inhalt" in _normalize(text)[:200]:
            return nr
    return 0


def _pdf_seiten(docx_path: Path) -> list[str]:
    """Dokument nach PDF rendern und den Text je Seite zurückgeben."""
    if not soffice_verfuegbar():
        return []
    with tempfile.TemporaryDirectory() as tmp:
        try:
            subprocess.run(
                [
                    "soffice", "--headless", "--norestore",
                    f"-env:UserInstallation=file://{tmp}/profile",
                    "--convert-to", "pdf", "--outdir", tmp, str(docx_path),
                ],
                check=True, capture_output=True, timeout=180,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            return []
        pdfs = list(Path(tmp).glob("*.pdf"))
        if not pdfs:
            return []
        return _pdf_text(pdfs[0])


def _pdf_text(pdf: Path) -> list[str]:
    if shutil.which("pdftotext"):
        try:
            out = subprocess.run(
                ["pdftotext", "-layout", str(pdf), "-"],
                check=True, capture_output=True, timeout=120,
            ).stdout.decode("utf-8", "replace")
            return out.split("\f")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            pass
    try:
        from pypdf import PdfReader
    except Exception:
        return _pdf_text_soffice(pdf)
    try:
        return [page.extract_text() or "" for page in PdfReader(str(pdf)).pages]
    except Exception:
        return _pdf_text_soffice(pdf)


def _pdf_text_soffice(pdf: Path) -> list[str]:
    """Rückfall ohne Fremdbibliothek: PDF über LibreOffice nach Text wandeln."""
    if not soffice_verfuegbar():
        return []
    with tempfile.TemporaryDirectory() as tmp:
        try:
            subprocess.run(
                [
                    "soffice", "--headless", "--norestore",
                    f"-env:UserInstallation=file://{tmp}/profile",
                    "--infilter=writer_pdf_import",
                    "--convert-to", "txt:Text", "--outdir", tmp, str(pdf),
                ],
                check=True, capture_output=True, timeout=180,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
            return []
        txt = list(Path(tmp).glob("*.txt"))
        if not txt:
            return []
        return txt[0].read_text(encoding="utf-8", errors="replace").split("\f")


# --- Verzeichnis schreiben -------------------------------------------------


def build_toc(toc_sdt, eintraege: list[Eintrag], mit_seitenzahlen: bool) -> None:
    """Verzeichniseinträge aus den Vorlagen-Absätzen klonen (Schritt 5)."""
    from .xmlutil import sdt_content

    content = sdt_content(toc_sdt)
    if content is None:
        raise ValueError("SYS.TOC ohne Inhalt")

    muster: dict[int, object] = {}
    kopf = None
    for p in content.findall(W("w:p")):
        style = _p_style(p)
        if style == "TOCHeading" or (kopf is None and style not in TOC_STYLES.values()):
            kopf = kopf or clone(p)
        for ebene, name in TOC_STYLES.items():
            if style == name and ebene not in muster:
                muster[ebene] = clone(p)
    if not muster:
        basis = content.findall(W("w:p"))
        if not basis:
            raise ValueError("SYS.TOC ohne Absätze")
        for ebene in TOC_STYLES:
            muster[ebene] = clone(basis[-1])

    for child in list(content):
        content.remove(child)
    if kopf is not None:
        content.append(kopf)

    for e in eintraege:
        p = clone(muster.get(e.ebene, muster[max(muster)]))
        set_paragraph_text(p, "")
        set_paragraph_style(p, TOC_STYLES[e.ebene])
        _fill_toc_paragraph(p, e, mit_seitenzahlen)
        content.append(p)


def _fill_toc_paragraph(p, e: Eintrag, mit_seitenzahlen: bool) -> None:
    """Anker, Titel, Nummer und ``PAGEREF``-Feld eines Eintrags setzen."""
    hyper = p.makeelement(W("w:hyperlink"), {})
    hyper.set(qn("w:anchor"), e.bookmark)
    hyper.set(qn("w:history"), "1")
    p.append(hyper)

    _run(hyper, f"{e.nummer}\t{e.titel}")
    _run(hyper, "\t")

    if mit_seitenzahlen:
        _pageref(hyper, e)
    else:
        _run(hyper, "")


def _run(parent, text: str):
    r = parent.makeelement(W("w:r"), {})
    for i, teil in enumerate(text.split("\t")):
        if i:
            r.append(r.makeelement(W("w:tab"), {}))
        if teil:
            t = r.makeelement(W("w:t"), {})
            t.set(qn("xml:space"), "preserve")
            t.text = teil
            r.append(t)
    parent.append(r)
    return r


def _pageref(parent, e: Eintrag) -> None:
    """``PAGEREF``-Feld mit zwischengespeichertem Ergebnis."""
    begin = parent.makeelement(W("w:r"), {})
    fc = begin.makeelement(W("w:fldChar"), {})
    fc.set(qn("w:fldCharType"), "begin")
    begin.append(fc)
    parent.append(begin)

    instr_run = parent.makeelement(W("w:r"), {})
    it = instr_run.makeelement(W("w:instrText"), {})
    it.set(qn("xml:space"), "preserve")
    it.text = f" PAGEREF {e.bookmark} \\h "
    instr_run.append(it)
    parent.append(instr_run)

    sep = parent.makeelement(W("w:r"), {})
    fc2 = sep.makeelement(W("w:fldChar"), {})
    fc2.set(qn("w:fldCharType"), "separate")
    sep.append(fc2)
    parent.append(sep)

    _run(parent, e.seite)

    end = parent.makeelement(W("w:r"), {})
    fc3 = end.makeelement(W("w:fldChar"), {})
    fc3.set(qn("w:fldCharType"), "end")
    end.append(fc3)
    parent.append(end)
