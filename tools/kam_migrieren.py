"""KAM-Tool (Excel) in Gerätedateien überführen und die Rechnung gegenprüfen.

Liest die drei Dateien des heutigen KAM-Tools und

1. schreibt je Kalkulationsblatt eine Gerätedatei (YAML) – das ist die „Seite“
   eines Geräts in der Web-Fassung, siehe docs/KAM_Tool_Web_Konzept.md;
2. rechnet jede Zeile nach den Regeln aus Abschnitt 4 des Konzepts nach und
   vergleicht mit den Werten, die Excel zuletzt gespeichert hat;
3. meldet die Strukturfehler, die sich aus der Datei selbst belegen lassen.

    python tools/kam_migrieren.py KAM.xlsm Stammdaten.xlsx --ziel out/geraete

Die Gerätedateien enthalten nur Artikelnummern und Bezeichnungen, keine
Einkaufspreise. Stammdaten und Ergebnisse gehören trotzdem nicht ins Repo.
"""

from __future__ import annotations

import argparse
import re
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import openpyxl
import yaml

PRAEFIX_KALK = "Kalkulationsblatt "
PRAEFIX_PREIS = "Preisblatt "
REF = re.compile(r"Kalkulationsblatt [^']*'!\$?([A-Z]+)\$?(\d+)")

# Artikel, für die nie Major Account Support gilt (Formel in Spalte I).
OHNE_MAS = {9967001306, 9967005056}
MAS_KREDITOR = "K100135"


def runde(x: float, stellen: int) -> float:
    """ROUND wie Excel: kaufmännisch auf der Dezimaldarstellung mit 15 Stellen.

    Pythons round() arbeitet auf dem Binärwert und liegt bei x,xx5 einen
    Rappen daneben; im Bestand betrifft das 6 Zellen.
    """
    d = Decimal(format(x, ".15g"))
    return float(d.quantize(Decimal(1).scaleb(-stellen), rounding=ROUND_HALF_UP))


def leer(v) -> bool:
    return v is None or v == ""


# --------------------------------------------------------------------------- lesen


def lies_stammdaten(pfad: Path):
    wb = openpyxl.load_workbook(pfad, data_only=True, read_only=True)
    artikel = {}
    for zeile in wb["Stammdaten"].iter_rows(min_row=3, max_col=10, values_only=True):
        if zeile[0] is not None and zeile[0] not in artikel:
            artikel[zeile[0]] = zeile
    mas = {z[0]: z[1] for z in wb["Major Account Support"].iter_rows(min_row=2, values_only=True) if z[0]}
    geraete = {z[0] for z in wb["Gerätedaten"].iter_rows(min_row=2, values_only=True) if z[0]}
    return artikel, mas, geraete


def lies_parameter(wv) -> dict:
    af, mf, aus = wv["Allgemeine Faktoren"], wv["Miet- und Leasing-Faktoren"], wv["Ausfüllen!!!!"]
    return {
        "kurs": af["B2"].value,
        "cif": af["B4"].value,
        "miete": {36: mf["B4"].value, 48: mf["B5"].value, 60: mf["B6"].value},
        "miete_eigen": {36: mf["B11"].value, 48: mf["B12"].value, 60: mf["B13"].value},
        "leasing": {36: mf["B18"].value, 48: mf["B19"].value, 60: mf["B20"].value},
        "sprache": aus["B4"].value,
        "mas": aus["B6"].value in ("ja", "oui"),
        "eigene_mietfaktoren": aus["B8"].value in ("ja", "oui"),
    }


def bezuege(preisblatt) -> tuple[set[int], set[int]]:
    """Zeilen des Kalkulationsblatts, die das Preisblatt zeigt – und welche davon mit Anzahl."""
    alle, mit_anzahl = set(), set()
    for zeile in preisblatt.iter_rows():
        for zelle in zeile:
            if isinstance(zelle.value, str):
                for m in REF.finditer(zelle.value):
                    alle.add(int(m.group(2)))
                    if m.group(1) == "B":
                        mit_anzahl.add(int(m.group(2)))
    return alle, mit_anzahl


# --------------------------------------------------------------------------- rechnen


def rechne(art, eingabe: dict, stamm, mas_tabelle, modell_erster_artikel, p: dict) -> dict:
    """Eine Zeile des Kalkulationsblatts (Spalten I bis AB)."""
    _, _, _, _, _, ek, waehrung, kreditor, listenpreis, vrb = stamm[art]
    ek = ek or 0
    gas_proz, gas_eur = eingabe.get("J") or 0, eingabe.get("K") or 0

    mas = 0
    if p["mas"] and kreditor == MAS_KREDITOR and art not in OHNE_MAS:
        mas = mas_tabelle.get(modell_erster_artikel, 0)

    if waehrung == "EUR":
        cif = runde((ek - ek * mas - ek * gas_proz - gas_eur) * p["kurs"] * (1 + p["cif"]), 2)
    else:
        cif = runde(ek * (1 + p["cif"]), 2)

    zuschlag = eingabe.get("R") or 0
    if not leer(eingabe.get("N")):
        netto = runde(cif * (1 + eingabe["N"]) + zuschlag, 2)
    elif not leer(eingabe.get("O")):
        netto = runde(cif / (1 - eingabe["O"]) + zuschlag, 2)
    else:
        netto = runde((listenpreis or 0) * (1 - (eingabe.get("Q") or 0)) + zuschlag, 2)

    miete = p["miete_eigen"] if p["eigene_mietfaktoren"] else p["miete"]
    return {
        "I": mas,
        "M": cif,
        "S": netto,
        "U": vrb or 0,
        "W": netto * miete[36],
        "X": netto * miete[48],
        "Y": netto * miete[60],
        "Z": netto * p["leasing"][36],
        "AA": netto * p["leasing"][48],
        "AB": netto * p["leasing"][60],
    }


# --------------------------------------------------------------------------- hauptablauf


def migriere(kam: Path, stammdaten: Path, ziel: Path | None) -> str:
    wf = openpyxl.load_workbook(kam)  # Formeln
    wv = openpyxl.load_workbook(kam, data_only=True)  # zuletzt gespeicherte Werte
    stamm, mas_tabelle, geraetedaten = lies_stammdaten(stammdaten)
    p = lies_parameter(wv)

    bericht = ["# KAM-Tool: Migration und Nachrechnung", ""]
    gleich = 0
    abweichungen, fehlende_formeln, nicht_im_preisblatt, lookup_luecken = [], [], [], []
    formelmuster = Counter()
    geraete = []

    for ws in wf.worksheets:
        if not ws.title.startswith(PRAEFIX_KALK):
            continue
        name = ws.title[len(PRAEFIX_KALK):]
        wsv, pb = wv[ws.title], wf[PRAEFIX_PREIS + name]
        modell = wv[PRAEFIX_PREIS + name]["B5"].value
        gezeigt, mit_anzahl = bezuege(pb)

        gruppen = {"optionen": [], "dienstleistungen": [], "intern": []}
        erster = None
        for r in range(2, ws.max_row + 1):
            art = ws[f"E{r}"].value
            if art is None:
                continue
            erster = erster or wsv[f"C{r}"].value
            bezeichnung = wsv[f"C{r}"].value
            gruppe = "optionen" if r in mit_anzahl else "dienstleistungen" if r in gezeigt else "intern"
            gruppen[gruppe].append({"nr": art, "bezeichnung": bezeichnung})

            if art not in stamm:
                lookup_luecken.append(f"{name}: {art}")
                continue
            if r not in gezeigt and (wsv[f"S{r}"].value or 0) > 0:
                nicht_im_preisblatt.append(f"{name}: {bezeichnung} ({art}), CHF {wsv[f'S{r}'].value}")

            y = ws[f"Y{r}"].value
            if isinstance(y, str) and "$B$12,IF" in y and "$B$12,S" in y:
                formelmuster[name] += 1

            eingabe = {c: ws[f"{c}{r}"].value for c in "NOQRK"}
            j = ws[f"J{r}"].value
            eingabe["J"] = ws["J2"].value if j == "=$J$2" else j
            soll = rechne(art, eingabe, stamm, mas_tabelle, erster, p)
            for spalte, wert in soll.items():
                if spalte == "I":
                    continue
                excel = wsv[f"{spalte}{r}"].value
                if excel is None:
                    fehlende_formeln.append(f"{name} {spalte}{r}: {bezeichnung}")
                elif isinstance(excel, (int, float)) and abs(excel - wert) < 0.005:
                    gleich += 1
                else:
                    abweichungen.append(f"{name} {spalte}{r} ({art}): Excel {excel}, nachgerechnet {wert:.4f}")

        geraete.append(name)
        if ziel:
            datei = {
                "id": re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"),
                "modell": modell,
                "status": "ausgelaufen" if ws.sheet_state != "visible" else "aktiv",
                "geraetedaten_vorhanden": modell in geraetedaten,
                "gruppen": [{"art": art, "artikel": liste} for art, liste in gruppen.items() if liste],
            }
            ziel.mkdir(parents=True, exist_ok=True)
            with open(ziel / f"{datei['id']}.yaml", "w", encoding="utf-8") as f:
                yaml.safe_dump(datei, f, allow_unicode=True, sort_keys=False)

    gesamt = gleich + len(abweichungen) + len(fehlende_formeln)
    bericht += [
        f"Geräte: {len(geraete)} · geprüfte Werte: {gesamt} · identisch: {gleich} · "
        f"abweichend: {len(abweichungen)} · Formel fehlt in Excel: {len(fehlende_formeln)}",
        "",
    ]

    def abschnitt(titel, zeilen):
        bericht.extend([f"## {titel} ({len(zeilen)})", ""] + [f"- {z}" for z in zeilen] + [""])

    abschnitt("Abweichungen", abweichungen)
    abschnitt("Formel fehlt in Excel", fehlende_formeln)
    abschnitt("Bepreist, aber nicht im Preisblatt", nicht_im_preisblatt)
    abschnitt("Miete 60 Monate mit eigenem 48-Monats-Faktor", [f"{g}: {n} Zeilen" for g, n in formelmuster.items()])
    abschnitt("Artikel nicht in den Stammdaten", lookup_luecken)

    bereich = wf.defined_names.get("Stammdaten")
    if bereich is not None:
        ende = int(re.search(r"\$(\d+)$", bereich.attr_text).group(1))
        zeilen = len(stamm)
        if zeilen + 2 > ende:
            bericht += ["## Suchbereich zu kurz", "", f"Name `Stammdaten` endet bei Zeile {ende}, "
                        f"die Datei hat {zeilen} Artikel – alles darunter findet SVERWEIS nicht.", ""]
    return "\n".join(bericht)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("kam", type=Path, help="Kalkulations- und Preisblätter (.xlsm)")
    ap.add_argument("stammdaten", type=Path, help="Stammdaten.xlsx")
    ap.add_argument("--ziel", type=Path, help="Verzeichnis für die Gerätedateien")
    ap.add_argument("--bericht", type=Path, help="Bericht als Markdown schreiben statt ausgeben")
    args = ap.parse_args()

    text = migriere(args.kam, args.stammdaten, args.ziel)
    if args.bericht:
        args.bericht.write_text(text, encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()
