"""Kommandozeile des Offerttools.

::

    offerttool generate  KALKTOOL [KALKTOOL ...] -o offerte.docx
    offerttool prepare   --miete a.docx --kauf b.docx -o vorlage.docx
    offerttool check     --template vorlage.docx
    offerttool inspect   KALKTOOL
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from .errors import OfferteError
from .mapping import available_mappings

STANDARD_VORLAGE = Path(__file__).resolve().parent.parent / "templates" / "Offerte_anchored.docx"
STANDARD_MIETE = Path(__file__).resolve().parent.parent / "templates" / "Offerte_deCH_Miete.docx"
STANDARD_KAUF = Path(__file__).resolve().parent.parent / "templates" / "Offerte_deCH_Kauf.docx"

log = logging.getLogger("offerttool")


def _parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="offerttool",
        description="Erzeugt eine Offerte aus einem oder mehreren Kalktools – ohne KI.",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="Ablauf mitloggen")
    sub = p.add_subparsers(dest="befehl", required=True)

    g = sub.add_parser("generate", help="Offerte erzeugen")
    g.add_argument("kalktools", nargs="+", type=Path,
                   help="Kalktool-Dateien; Reihenfolge = Reihenfolge der Standorte")
    g.add_argument("-o", "--out", type=Path, required=True, help="Zieldatei (.docx)")
    g.add_argument("-t", "--template", type=Path, default=STANDARD_VORLAGE,
                   help="Ankerbasierte Vorlage")
    g.add_argument("-c", "--crm", type=Path, default=None, help="CRM-Datensatz (JSON)")
    g.add_argument("-m", "--mapping", type=Path, default=None,
                   help="Mapping erzwingen statt über KM!C1 zu wählen")
    g.add_argument("--ohne-seitenzahlen", action="store_true",
                   help="Inhaltsverzeichnis ohne PDF-Rendervorgang aufbauen")

    v = sub.add_parser("prepare", help="Rohvorlagen einmalig mit Ankern versehen")
    v.add_argument("--miete", type=Path, default=STANDARD_MIETE)
    v.add_argument("--kauf", type=Path, default=STANDARD_KAUF)
    v.add_argument("-o", "--out", type=Path, default=STANDARD_VORLAGE)

    c = sub.add_parser("check", help="Ankerkatalog gegen eine Vorlage prüfen")
    c.add_argument("-t", "--template", type=Path, default=STANDARD_VORLAGE)

    i = sub.add_parser("inspect", help="Gelesene Werte eines Kalktools zeigen")
    i.add_argument("kalktool", type=Path)
    i.add_argument("-m", "--mapping", type=Path, default=None)
    i.add_argument("--json", action="store_true", help="Ausgabe als JSON")

    sub.add_parser("mappings", help="Verfügbare Kalktool-Versionen auflisten")
    return p


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(message)s",
    )
    try:
        return _dispatch(args)
    except OfferteError as exc:
        print(f"ABBRUCH {exc}", file=sys.stderr)
        return 2


def _dispatch(args) -> int:
    if args.befehl == "generate":
        return _generate(args)
    if args.befehl == "prepare":
        from .prepare import prepare

        out = prepare(args.miete, args.kauf, args.out)
        print(f"Vorlage präpariert und geprüft: {out}")
        return 0
    if args.befehl == "check":
        from .prepare import validate_template

        tm = validate_template(args.template)
        print(f"{args.template}: {len(tm)} Anker, Katalog vollständig.")
        return 0
    if args.befehl == "inspect":
        return _inspect(args)
    if args.befehl == "mappings":
        for version, pfad in available_mappings().items():
            print(f"{version}\t{pfad.name}")
        return 0
    return 1


def _generate(args) -> int:
    from .pipeline import generiere

    ergebnis = generiere(
        args.kalktools,
        args.template,
        args.out,
        args.crm,
        args.mapping,
        toc_seitenzahlen=not args.ohne_seitenzahlen,
    )
    print(f"Offerte:      {ergebnis.offerte}")
    print(f"Prüfprotokoll: {ergebnis.protokoll}")
    if ergebnis.warnungen.items:
        print(f"Warnungen ({len(ergebnis.warnungen.items)}):")
        for w in ergebnis.warnungen.items:
            print(f"  {w}")
    else:
        print("Warnungen:    keine")
    return 0


def _inspect(args) -> int:
    from .derive import derive
    from .errors import WarningCollector
    from .extract import extract
    from .mapping import load_mapping, select_mapping
    from .workbook import Kalktool, read_version_cell

    warn = WarningCollector()
    m = load_mapping(args.mapping) if args.mapping else select_mapping(
        read_version_cell(args.kalktool)
    )
    with Kalktool(args.kalktool, m, warn) as kt:
        ctx = extract(kt, m, warn)
    d = derive(ctx, warn)

    daten = {
        "quelle": ctx.quelle,
        "mapping": m.version,
        "variante": d.variante,
        "felder": {k: _plain(v) for k, v in sorted(ctx.values.items())},
        "schalter": d.show,
        "listen": {
            name: [
                {"bezeichnung": p.bezeichnung, "artnr": p.artnr,
                 "stueck": p.stueck, "betrag": float(p.betrag)}
                for p in positionen
            ]
            for name, positionen in ctx.listen.items()
        },
        "warnungen": [str(w) for w in warn.items],
    }
    if args.json:
        print(json.dumps(daten, ensure_ascii=False, indent=2, default=str))
        return 0

    print(f"Kalktool:  {ctx.quelle}")
    print(f"Mapping:   {m.version}")
    print(f"Variante:  {d.variante}")
    print("\nFelder")
    for k, v in daten["felder"].items():
        print(f"  {k:24} {v}")
    print("\nSchalter")
    for k, v in sorted(d.show.items()):
        print(f"  show.{k:20} {'wahr' if v else 'falsch'}")
    print("\nListen")
    for name, positionen in daten["listen"].items():
        if positionen:
            print(f"  {name}")
            for p in positionen:
                print(f"    - {p['bezeichnung']}  {p['betrag']}")
    if warn.items:
        print("\nWarnungen")
        for w in warn.items:
            print(f"  {w}")
    return 0


def _plain(value):
    import datetime as dt

    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()[:10]
    if isinstance(value, dict):
        return ", ".join(f"{k}={v}" for k, v in value.items() if v)
    return value


if __name__ == "__main__":
    raise SystemExit(main())
