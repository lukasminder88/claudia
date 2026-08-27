"""Web-Oberfläche des Offerttools für den Betrieb im Firmennetz.

Die App ist eine dünne Hülle um :func:`offerttool.pipeline.generiere`.  Sie
trifft keine eigenen Entscheidungen über den Inhalt der Offerte – jede Regel
steht weiterhin in der Spezifikation und im Mapping.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ..cli import STANDARD_DATENBLAETTER, STANDARD_VORLAGE
from ..derive import derive
from ..errors import ERROR_TEXTS, OfferteError, WarningCollector
from ..extract import extract
from ..formatters import chf, date_de, int_ch
from ..mapping import select_mapping
from ..pipeline import generiere
from ..workbook import Kalktool, read_version_cell
from .jobs import Auftragsspeicher

log = logging.getLogger("offerttool.web")

STATIC = Path(__file__).with_name("static")

# Ein Kalktool der Referenzgrösse liegt bei rund 120 kB; 15 MB je Datei sind
# grosszügig und begrenzen trotzdem, was ein einzelner Upload anrichten kann.
MAX_DATEIGROESSE = 15 * 1024 * 1024
MAX_DATEIEN = 20
ERLAUBTE_ENDUNGEN = {".xlsx", ".xlsm"}

CRM_FELDER = (
    "offertnummer",
    "offertversion",
    "kontakt.anrede",
    "kontakt.vorname",
    "kontakt.nachname",
    "vk.funktion",
    "vk.email",
    "vk.telefon",
)

speicher = Auftragsspeicher()

@asynccontextmanager
async def _lebenszyklus(_app: FastAPI):
    yield
    # Beim Herunterfahren bleibt kein hochgeladenes Kalktool zurück.
    speicher.alles_loeschen()


app = FastAPI(
    title="Offerttool V3",
    description="Erzeugt eine Offerte aus Kalktool-Dateien – regelbasiert, ohne KI.",
    version="3.0.0",
    lifespan=_lebenszyklus,
)


@app.exception_handler(OfferteError)
def _offertfehler(_request, exc: OfferteError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "fehler": {
                "code": exc.code,
                "bedeutung": ERROR_TEXTS.get(exc.code, "Unbekannter Fehler"),
                "detail": exc.detail,
            }
        },
    )


# --- Hochgeladene Dateien --------------------------------------------------


def _ablegen(dateien: list[UploadFile], ziel: Path) -> list[Path]:
    """Uploads prüfen und unter eigenen Namen ablegen.

    Der Dateiname des Clients wird nie als Pfad verwendet – nur als Anzeigename.
    """
    if not dateien:
        raise HTTPException(400, "Kein Kalktool hochgeladen.")
    if len(dateien) > MAX_DATEIEN:
        raise HTTPException(400, f"Höchstens {MAX_DATEIEN} Kalktools je Offerte.")

    pfade: list[Path] = []
    for nummer, datei in enumerate(dateien, start=1):
        name = Path(datei.filename or "kalktool.xlsx").name
        if Path(name).suffix.lower() not in ERLAUBTE_ENDUNGEN:
            raise HTTPException(
                400, f"{name}: nur {' und '.join(sorted(ERLAUBTE_ENDUNGEN))} werden gelesen."
            )
        pfad = ziel / f"{nummer:02d}_{_saeubern(name)}"
        groesse = 0
        with pfad.open("wb") as fh:
            while stueck := datei.file.read(1024 * 1024):
                groesse += len(stueck)
                if groesse > MAX_DATEIGROESSE:
                    raise HTTPException(
                        413, f"{name}: grösser als {MAX_DATEIGROESSE // 1024 // 1024} MB."
                    )
                fh.write(stueck)
        if groesse == 0:
            raise HTTPException(400, f"{name}: Datei ist leer.")
        pfade.append(pfad)
    return pfade


def _saeubern(name: str) -> str:
    erlaubt = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_ "
    sauber = "".join(z if z in erlaubt else "_" for z in name).strip() or "kalktool.xlsx"
    return sauber[:120]


def _crm_aus_formular(werte: dict[str, str]) -> dict:
    """Formularfelder in die verschachtelte CRM-Struktur übersetzen."""
    crm: dict = {}
    for feld in CRM_FELDER:
        wert = (werte.get(feld) or "").strip()
        if not wert:
            continue
        ziel = crm
        *pfad, letzt = feld.split(".")
        for teil in pfad:
            ziel = ziel.setdefault(teil, {})
        ziel[letzt] = wert
    return {"crm": crm} if crm else {}


# --- Schnittstellen --------------------------------------------------------


@app.get("/api/gesundheit")
def gesundheit() -> dict:
    from ..docxutil.toc import soffice_verfuegbar

    from ..hardware import Bibliothek

    datenblaetter = (
        len(Bibliothek.laden(STANDARD_DATENBLAETTER))
        if STANDARD_DATENBLAETTER.is_dir()
        else 0
    )
    return {
        "version": app.version,
        "auftraege": len(speicher),
        "seitenzahlen_moeglich": soffice_verfuegbar(),
        "datenblaetter": datenblaetter,
    }


@app.post("/api/pruefen")
async def pruefen(dateien: list[UploadFile] = File(...)) -> dict:
    """Zeigt, was aus den Kalktools gelesen wird – ohne ein Dokument zu erzeugen.

    Entspricht ``offerttool inspect`` und ist der Blick vor dem Klick.
    """
    auftrag = speicher.neu()
    try:
        pfade = _ablegen(dateien, auftrag.verzeichnis)
        standorte = []
        warnungen = WarningCollector()
        for nummer, pfad in enumerate(pfade, start=1):
            warnungen.standort = nummer
            mapping = select_mapping(read_version_cell(pfad))
            with Kalktool(pfad, mapping, warnungen) as kt:
                ctx = extract(kt, mapping, warnungen)
            ctx.index = nummer
            standorte.append((ctx, derive(ctx, warnungen)))
        warnungen.standort = None
        return {
            "standorte": [_standort_kurz(c, d) for c, d in standorte],
            "kopf": _kopf(standorte),
            "warnungen": _warnungen(warnungen),
        }
    finally:
        speicher.loeschen(auftrag.id)


@app.post("/api/erzeugen")
async def erzeugen(
    dateien: list[UploadFile] = File(...),
    offertnummer: str = Form(""),
    offertversion: str = Form(""),
    anrede: str = Form(""),
    vorname: str = Form(""),
    nachname: str = Form(""),
    vk_funktion: str = Form(""),
    vk_email: str = Form(""),
    vk_telefon: str = Form(""),
    seitenzahlen: bool = Form(True),
    datenblaetter: bool = Form(True),
    spezifikation: bool = Form(True),
) -> dict:
    """Erzeugt die Offerte und hält sie zum Abholen bereit."""
    import json

    auftrag = speicher.neu()
    try:
        pfade = _ablegen(dateien, auftrag.verzeichnis)

        crm = _crm_aus_formular(
            {
                "offertnummer": offertnummer,
                "offertversion": offertversion,
                "kontakt.anrede": anrede,
                "kontakt.vorname": vorname,
                "kontakt.nachname": nachname,
                "vk.funktion": vk_funktion,
                "vk.email": vk_email,
                "vk.telefon": vk_telefon,
            }
        )
        crm_pfad = None
        if crm:
            crm_pfad = auftrag.verzeichnis / "crm.json"
            crm_pfad.write_text(json.dumps(crm, ensure_ascii=False), encoding="utf-8")

        ziel = auftrag.verzeichnis / "Offerte.docx"
        with speicher.semaphore:
            ergebnis = generiere(
                pfade,
                STANDARD_VORLAGE,
                ziel,
                crm_pfad,
                toc_seitenzahlen=seitenzahlen,
                datenblaetter_pfad=(
                    STANDARD_DATENBLAETTER
                    if datenblaetter and STANDARD_DATENBLAETTER.is_dir()
                    else None
                ),
                mit_spezifikation=spezifikation,
            )
    except Exception:
        speicher.loeschen(auftrag.id)
        raise

    # Die Kalktools werden nach der Generierung sofort gelöscht; nur das
    # Ergebnis bleibt bis zum Abholen liegen.
    for pfad in pfade:
        pfad.unlink(missing_ok=True)
    if crm_pfad is not None:
        crm_pfad.unlink(missing_ok=True)

    auftrag.dateiname = _dateiname(ergebnis.standorte)
    auftrag.offerte = ergebnis.offerte
    auftrag.protokoll = ergebnis.protokoll
    auftrag.warnungen = _warnungen(ergebnis.warnungen)
    auftrag.zusammenfassung = {
        "kopf": _kopf(ergebnis.standorte),
        "standorte": [_standort_kurz(c, d) for c, d in ergebnis.standorte],
    }
    return {
        "auftrag": auftrag.id,
        "dateiname": auftrag.dateiname,
        **auftrag.zusammenfassung,
        "warnungen": auftrag.warnungen,
    }


@app.get("/api/holen/{kennung}/{was}")
def holen(kennung: str, was: str):
    auftrag = speicher.holen(kennung)
    if auftrag is None:
        raise HTTPException(404, "Auftrag abgelaufen oder unbekannt. Bitte neu erzeugen.")
    if was == "offerte" and auftrag.offerte:
        return FileResponse(
            auftrag.offerte,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=auftrag.dateiname,
        )
    if was == "protokoll" and auftrag.protokoll:
        return FileResponse(
            auftrag.protokoll,
            media_type="text/markdown; charset=utf-8",
            filename=auftrag.dateiname + ".pruefprotokoll.md",
        )
    raise HTTPException(404, "Unbekannte Datei.")


@app.delete("/api/holen/{kennung}")
def verwerfen(kennung: str) -> dict:
    """Ergebnis vorzeitig vom Server löschen."""
    speicher.loeschen(kennung)
    return {"geloescht": True}


# --- Aufbereitung für die Anzeige -----------------------------------------


def _warnungen(sammler: WarningCollector) -> list[dict]:
    return [
        {"code": w.code, "bedeutung": w.text, "detail": w.detail, "standort": w.standort}
        for w in sammler.items
    ]


def _kopf(standorte: list) -> dict:
    """Kopfdaten stammen immer aus dem ersten Kalktool (Abschnitt 11)."""
    ctx, d = standorte[0]
    ort = ctx.get("kunde.plz_ort") or {}
    return {
        "variante": d.variante,
        "kunde": ctx.text("kunde.firma"),
        "kundenort": f"{ort.get('plz', '')} {ort.get('ort', '')}".strip(),
        "verkaeufer": ctx.text("vk.name"),
        "verkaufschance": ctx.text("verkaufschance"),
        "laufzeit": int_ch(ctx.num("laufzeit")),
        "datum": date_de(ctx.get("datum")),
        "gueltig_bis": date_de(d.gueltig_bis),
        "kalktool_version": ctx.text("kalktool.version"),
        "anzahl_standorte": len(standorte),
    }


def _standort_kurz(ctx, d) -> dict:
    return {
        "index": ctx.index,
        "quelle": _anzeigename(ctx.quelle),
        "name": ctx.text("standort.name"),
        "adresse": _adresse(ctx),
        "geraet": d.geraet,
        "hardware": [p.bezeichnung for p in ctx.listen.get("hardware", [])],
        "einmalig": chf(d.dienstleistung_total),
        "monatlich": chf(ctx.num("monatspauschale_total")) if d.variante != "KAUF" else None,
        "kaufpreis": chf(ctx.num("vertragswert")) if d.variante == "KAUF" else None,
        "schalter": {k: bool(v) for k, v in sorted(d.show.items())},
    }


def _anzeigename(quelle: str) -> str:
    """Den internen Reihenfolge-Präfix wieder abstreifen."""
    import re

    return re.sub(r"^\d{2}_", "", quelle)


def _adresse(ctx) -> str:
    ort = ctx.get("standort.plz_ort") or {}
    teile = [ctx.text("standort.strasse"), f"{ort.get('plz', '')} {ort.get('ort', '')}".strip()]
    return ", ".join(t for t in teile if t)


def _dateiname(standorte: list) -> str:
    ctx = standorte[0][0]
    kunde = _saeubern(ctx.text("kunde.firma") or "Offerte").replace(" ", "_")
    chance = _saeubern(ctx.text("verkaufschance") or "").replace(" ", "_")
    teile = ["Offerte", kunde] + ([chance] if chance else [])
    return "_".join(teile)[:150] + ".docx"


# Die Oberfläche liegt unter "/" und wird zuletzt eingehängt, damit sie die
# Schnittstellen unter "/api" nicht verdeckt.
app.mount("/", StaticFiles(directory=str(STATIC), html=True), name="oberflaeche")
