"""Web-Schnittstelle (Betrieb im Firmennetz).

Geprüft wird vor allem, dass keine Kundendaten auf dem Server liegenbleiben
und dass ein Abbruch als lesbarer Fehlercode ankommt statt als Absturz.
"""

from __future__ import annotations

import shutil
import zipfile

import openpyxl
import pytest

pytest.importorskip("fastapi")
from fastapi.testclient import TestClient  # noqa: E402

from offerttool.web import app as webapp  # noqa: E402

from .conftest import KALKTOOL  # noqa: E402


@pytest.fixture
def client():
    with TestClient(webapp.app) as c:
        yield c
    webapp.speicher.alles_loeschen()


def kalktool(name: str = "Kalktool.xlsx", pfad=None):
    return ("dateien", (name, open(pfad or KALKTOOL, "rb"), "application/vnd.ms-excel"))


def variante(tmp_path, name: str, **zellen):
    ziel = tmp_path / name
    shutil.copy(KALKTOOL, ziel)
    wb = openpyxl.load_workbook(ziel, data_only=True)
    for adresse, wert in zellen.items():
        wb.worksheets[0][adresse] = wert
    wb.save(ziel)
    return ziel


def test_gesundheit(client):
    d = client.get("/api/gesundheit").json()
    assert d["version"] == "3.0.0"
    assert "seitenzahlen_moeglich" in d


def test_oberflaeche_wird_ausgeliefert(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "Offerttool" in r.text
    for datei in ("/stil.css", "/app.js", "/favicon.svg"):
        assert client.get(datei).status_code == 200, datei


def test_pruefen_liest_ohne_zu_erzeugen(client):
    d = client.post("/api/pruefen", files=[kalktool()]).json()
    assert d["kopf"]["variante"] == "MIETE"
    assert d["kopf"]["kunde"] == "Gemeindeverwaltung Birsfelden"
    assert d["kopf"]["gueltig_bis"] == "26.09.2026"
    assert d["standorte"][0]["name"] == "Museum"
    assert d["standorte"][0]["einmalig"] == "CHF 300.00"
    assert {w["code"] for w in d["warnungen"]} >= {"W308", "W312"}
    # Ein Prüflauf hinterlässt keinen Auftrag.
    assert len(webapp.speicher) == 0


def test_erzeugen_und_herunterladen(client):
    d = client.post(
        "/api/erzeugen",
        files=[kalktool()],
        data={"offertnummer": "OF-1", "offertversion": "2.0", "seitenzahlen": "false"},
    ).json()
    assert d["dateiname"].endswith(".docx")

    offerte = client.get(f"/api/holen/{d['auftrag']}/offerte")
    assert offerte.status_code == 200
    assert offerte.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument"
    )

    text = zipfile.ZipFile(__import__("io").BytesIO(offerte.content)).read(
        "word/document.xml"
    ).decode("utf-8")
    assert "Gemeindeverwaltung Birsfelden" in text
    assert "OF-1" in text
    # Sperrliste hält auch über die Web-Schnittstelle (Abschnitt 13.2).
    for gesperrt in ("2’645", "1’587", "2’024.75"):
        assert gesperrt not in text

    assert client.get(f"/api/holen/{d['auftrag']}/protokoll").status_code == 200


def test_crm_felder_landen_im_dokument(client):
    d = client.post(
        "/api/erzeugen",
        files=[kalktool()],
        data={
            "anrede": "Herr",
            "vorname": "Tom",
            "nachname": "Wiedmer",
            "vk_funktion": "Account Manager",
            "vk_telefon": "+41 58 551 11 22",
            "seitenzahlen": "false",
        },
    ).json()
    text = client.get(f"/api/holen/{d['auftrag']}/offerte").content
    xml = zipfile.ZipFile(__import__("io").BytesIO(text)).read("word/document.xml").decode()
    assert "Account Manager" in xml
    assert "Direkt +41 58 551 11 22" in xml


def test_kalktools_werden_nach_der_generierung_geloescht(client):
    """Kundendaten und Margen bleiben nicht auf dem Server liegen."""
    d = client.post(
        "/api/erzeugen", files=[kalktool()], data={"seitenzahlen": "false"}
    ).json()
    auftrag = webapp.speicher.holen(d["auftrag"])
    verbliebene = sorted(p.name for p in auftrag.verzeichnis.iterdir())
    assert not any(n.endswith((".xlsx", ".xlsm")) for n in verbliebene), verbliebene
    assert not any(n == "crm.json" for n in verbliebene), verbliebene


def test_ergebnis_verschwindet_nach_ablauf(client, monkeypatch):
    d = client.post(
        "/api/erzeugen", files=[kalktool()], data={"seitenzahlen": "false"}
    ).json()
    auftrag = webapp.speicher.holen(d["auftrag"])
    verzeichnis = auftrag.verzeichnis
    monkeypatch.setattr(webapp.speicher, "_lebensdauer", -1)
    assert webapp.speicher.holen(d["auftrag"]) is None
    assert not verzeichnis.exists()
    assert client.get(f"/api/holen/{d['auftrag']}/offerte").status_code == 404


def test_verwerfen_loescht_sofort(client):
    d = client.post(
        "/api/erzeugen", files=[kalktool()], data={"seitenzahlen": "false"}
    ).json()
    assert client.delete(f"/api/holen/{d['auftrag']}").json() == {"geloescht": True}
    assert client.get(f"/api/holen/{d['auftrag']}/offerte").status_code == 404


def test_reihenfolge_bestimmt_die_standorte(client, tmp_path):
    zweit = variante(tmp_path, "Werkhof.xlsx", B7="Werkhof")
    d = client.post(
        "/api/erzeugen",
        files=[kalktool("Werkhof.xlsx", zweit), kalktool("Museum.xlsx")],
        data={"seitenzahlen": "false"},
    ).json()
    assert [s["name"] for s in d["standorte"]] == ["Werkhof", "Museum"]
    assert d["kopf"]["anzahl_standorte"] == 2


def test_abbruch_kommt_als_lesbarer_code(client, tmp_path):
    kaputt = variante(tmp_path, "kaputt.xlsx", I16=9)
    r = client.post("/api/erzeugen", files=[kalktool("kaputt.xlsx", kaputt)])
    assert r.status_code == 422
    fehler = r.json()["fehler"]
    assert fehler["code"] == "E401"
    assert "finanzierungsart" in fehler["bedeutung"]
    # Ein Abbruch hinterlässt keinen Auftrag und keine Datei.
    assert len(webapp.speicher) == 0


def test_falscher_dateityp_wird_abgelehnt(client):
    r = client.post(
        "/api/erzeugen", files=[("dateien", ("notiz.txt", b"kein Kalktool", "text/plain"))]
    )
    assert r.status_code == 400
    assert ".xlsx" in r.json()["detail"]


def test_leere_datei_wird_abgelehnt(client):
    r = client.post("/api/erzeugen", files=[("dateien", ("leer.xlsx", b"", "application/x"))])
    assert r.status_code == 400


def test_zu_grosse_datei_wird_abgelehnt(client, monkeypatch):
    monkeypatch.setattr(webapp, "MAX_DATEIGROESSE", 1024)
    r = client.post("/api/erzeugen", files=[kalktool()])
    assert r.status_code == 413


def test_zu_viele_dateien_werden_abgelehnt(client, monkeypatch):
    monkeypatch.setattr(webapp, "MAX_DATEIEN", 1)
    r = client.post("/api/erzeugen", files=[kalktool("a.xlsx"), kalktool("b.xlsx")])
    assert r.status_code == 400


def test_dateiname_des_clients_wird_nicht_als_pfad_verwendet(client):
    r = client.post(
        "/api/pruefen",
        files=[("dateien", ("../../../etc/passwd.xlsx", open(KALKTOOL, "rb"), "application/x"))],
    )
    assert r.status_code == 200
    # Der Name taucht nur bereinigt als Anzeigename auf.
    assert "/" not in r.json()["standorte"][0]["quelle"]


# --- Gerätedatenblätter ----------------------------------------------------

DATENBLAETTER = __import__("pathlib").Path(__file__).resolve().parent.parent / "datenblaetter"
ohne_datenblaetter = pytest.mark.skipif(
    not DATENBLAETTER.is_dir() or not any(DATENBLAETTER.rglob("*.dotx")),
    reason="Verzeichnis datenblaetter/ ist nicht vorhanden",
)


def test_gesundheit_nennt_die_datenblaetter(client):
    d = client.get("/api/gesundheit").json()
    assert "datenblaetter" in d
    assert isinstance(d["datenblaetter"], int)


@ohne_datenblaetter
def test_datenblaetter_lassen_sich_abwaehlen(client):
    def xml_von(**daten):
        antwort = client.post(
            "/api/erzeugen", files=[kalktool()],
            data={"seitenzahlen": "false", **daten},
        ).json()
        inhalt = client.get(f"/api/holen/{antwort['auftrag']}/offerte").content
        return zipfile.ZipFile(__import__("io").BytesIO(inhalt)).read(
            "word/document.xml"
        ).decode("utf-8")

    mit = xml_von(datenblaetter="true", spezifikation="true")
    ohne_spez = xml_von(datenblaetter="true", spezifikation="false")
    ganz_ohne = xml_von(datenblaetter="false")

    # "Multifunktionsgeräte" steht auch im Einleitungstext von Kapitel 1.1;
    # geprüft wird deshalb auf Text, den es nur im Datenblatt gibt.
    assert "Die Vorteile auf einen Blick" in mit
    assert "Artikel-Nr" in mit

    assert "Die Vorteile auf einen Blick" in ohne_spez
    assert "Artikel-Nr" not in ohne_spez

    assert "Die Vorteile auf einen Blick" not in ganz_ohne
