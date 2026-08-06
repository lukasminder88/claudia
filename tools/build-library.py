#!/usr/bin/env python3
"""
build-library.py  –  Foliant-Bibliothek für den Abacus-Rechner erzeugen.

Scannt den Ordner `foliants/` (Foliant-PDFs + optionale Preisliste als CSV) und
schreibt `data/library.js`, das der Rechner beim Start automatisch vorlädt.

  Aufruf:   python3 tools/build-library.py

Benötigt `pypdf` (pip install pypdf). Alternativ lassen sich Foliants direkt im
Rechner per "Foliants hinzufügen" laden – dann ist dieses Skript nicht nötig.
"""
import os, re, json, sys, glob, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOLIANTS = os.path.join(ROOT, "foliants")
OUT = os.path.join(ROOT, "data", "library.js")

try:
    from pypdf import PdfReader
    from pypdf.generic import IndirectObject
except Exception:
    print("Fehlt: pypdf  ->  pip install pypdf", file=sys.stderr); sys.exit(1)


def resolve(o):
    while isinstance(o, IndirectObject):
        o = o.get_object()
    return o


def get_field(reader, name):
    acro = resolve(reader.trailer["/Root"].get("/AcroForm"))
    if not acro:
        return None
    for f in resolve(acro.get("/Fields", [])):
        f = resolve(f)
        if f.get("/T") == name:
            v = f.get("/V")
            vo = resolve(v)
            if hasattr(vo, "get_data"):
                try:
                    return vo.get_data().decode("latin-1")
                except Exception:
                    return None
            return str(vo) if vo is not None else None
    return None


def csv_table(xml, tag):
    m = re.search(r"<%s[^>]*>(.*?)</%s>" % (tag, tag), xml or "", re.S)
    if not m:
        return []
    lines = [l for l in re.split(r"[\r\n]+", m.group(1)) if l.strip()]
    rows = [l.split(";") for l in lines[1:]]
    return [{"name": (r[0].strip() if len(r) > 0 else ""),
             "code": (r[1].strip() if len(r) > 1 else ""),
             "desc": (r[2].strip() if len(r) > 2 else "")} for r in rows]


def parse_foliant(path):
    r = PdfReader(path)
    pandora = get_field(r, "Pandora") or ""
    topline = (get_field(r, "Text_TopLine") or "").strip()
    seele = get_field(r, "Seelensuppe") or ""
    desc = topline
    m = re.search(r'<description value="([^"]*)"', seele)
    if m and not desc:
        desc = m.group(1)
    ver = ""
    m = re.search(r'versionMain="(\d+)"\s+versionSub="(\d+)"\s+release="(\d+)"', seele)
    if m:
        ver = "%s.%s R%s" % m.groups()
    articles = csv_table(pandora, "ArticleCodes")
    consumables = csv_table(pandora, "ConsumableCodes")
    models = [a["name"] for a in articles if a["desc"] == "Mainbody"]
    return {
        "id": re.sub(r"[^a-z0-9]+", "-", (desc or os.path.basename(path)).lower()).strip("-"),
        "file": os.path.basename(path),
        "name": desc or os.path.basename(path),
        "version": ver,
        "models": models,
        "articles": articles,
        "consumables": consumables,
    }


def parse_pricelist(path):
    text = open(path, encoding="utf-8", errors="replace").read()
    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        return None
    delim = ";" if lines[0].count(";") >= lines[0].count(",") else ","
    rows = [[c.strip().strip('"') for c in l.split(delim)] for l in lines]
    return {"file": os.path.basename(path), "rows": rows}


def main():
    foliants, pricelist = [], None
    for path in sorted(glob.glob(os.path.join(FOLIANTS, "*"))):
        ext = path.lower().rsplit(".", 1)[-1]
        if ext == "pdf":
            try:
                foliants.append(parse_foliant(path))
                print("Foliant:", os.path.basename(path))
            except Exception as e:
                print("  Fehler bei %s: %s" % (os.path.basename(path), e), file=sys.stderr)
        elif ext == "csv" and pricelist is None:
            pricelist = parse_pricelist(path)
            print("Preisliste:", os.path.basename(path))

    lib = {
        "generated": datetime.date.today().isoformat(),
        "foliants": foliants,
        "priceList": pricelist,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("/* Automatisch erzeugt von tools/build-library.py – nicht von Hand bearbeiten. */\n")
        f.write("window.ABACUS_LIBRARY = ")
        f.write(json.dumps(lib, ensure_ascii=False, indent=1))
        f.write(";\n")
    print("\ngeschrieben:", os.path.relpath(OUT, ROOT),
          "(%d Foliant(s), Preisliste: %s)" % (len(foliants), "ja" if pricelist else "nein"))


if __name__ == "__main__":
    main()
