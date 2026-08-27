"""Textbausteine: Laden, Prüfen und Wirkung im Dokument (Abschnitt 8).

Der Wortlaut steht in ``textbausteine.yaml`` und soll ohne Programmierkenntnisse
änderbar sein. Diese Tests sichern, dass ein Tippfehler auffällt statt ein
kaputtes Dokument zu erzeugen.
"""

from __future__ import annotations

import subprocess
import sys

import pytest
import yaml

from offerttool.bausteine import Bausteine, lade, zusammenfuehren
from offerttool.errors import OfferteError

from .conftest import KALKTOOL, ROOT, VORLAGE


@pytest.fixture(scope="module")
def standard():
    return lade()


def _abgewandelt(standard, schluessel, text):
    daten = standard.als_dict()
    eintrag = daten["bausteine"][schluessel]
    eintrag.pop("absaetze", None)
    eintrag["text"] = text
    return daten


def test_mitgelieferte_bausteine_sind_gueltig(standard):
    assert len(standard.bausteine) > 40
    assert standard.version
    # Jeder Baustein gehört in eine bekannte Gruppe und hat einen Titel.
    for b in standard.bausteine.values():
        assert b.titel
        assert b.gruppe in standard.gruppen, (b.schluessel, b.gruppe)


def test_jeder_platzhalter_hat_beschreibung_und_beispiel(standard):
    for b in standard.bausteine.values():
        for p in b.platzhalter:
            assert p in standard.platzhalter, f"{b.schluessel}: {p} nicht beschrieben"
            assert p in standard.beispiele, f"{b.schluessel}: {p} ohne Beispiel"


def test_text_wird_gefuellt(standard):
    assert standard.text("head_standort", index=1, name="Museum") == "Standort 1: Museum"


def test_absaetze_werden_gefuellt(standard):
    absaetze = standard.absaetze(
        "vertrag_miete", vertragsart="Mietvertrag", beginn="am 01.08.2026", laufzeit="60"
    )
    assert len(absaetze) == 1
    assert "Der Mietvertrag tritt am 01.08.2026 in Kraft" in absaetze[0]


def test_unbekannter_platzhalter_bricht_ab(standard):
    with pytest.raises(OfferteError) as exc:
        Bausteine(_abgewandelt(standard, "head_standort", "Standort {index}: {naem}"))
    assert exc.value.code == "E801"
    # Die Meldung nennt die erlaubten Platzhalter.
    assert "{index}" in str(exc.value) and "{name}" in str(exc.value)


def test_nicht_vorgesehener_platzhalter_bricht_ab(standard):
    """{geraet} gibt es, ist in diesem Baustein aber nicht vorgesehen."""
    with pytest.raises(OfferteError) as exc:
        Bausteine(_abgewandelt(standard, "head_standort", "Standort {geraet}"))
    assert exc.value.code == "E801"
    assert "nicht vorgesehen" in str(exc.value)


def test_einzelne_klammer_bricht_ab(standard):
    with pytest.raises(OfferteError) as exc:
        Bausteine(_abgewandelt(standard, "klassifizierung", "Vertraulich {"))
    assert exc.value.code == "E801"


def test_doppelte_klammer_ist_ein_zeichen(standard):
    b = Bausteine(_abgewandelt(standard, "klassifizierung", "Vertraulich {{intern}}"))
    assert b.text("klassifizierung") == "Vertraulich {intern}"


def test_fehlender_wert_bricht_ab(standard):
    with pytest.raises(OfferteError) as exc:
        standard.text("head_standort", index=1)
    assert exc.value.code == "E802"


def test_unbekannter_baustein_bricht_ab(standard):
    with pytest.raises(OfferteError):
        standard.text("gibt_es_nicht")


def test_zusammenfuehren_ersetzt_nur_genanntes(standard):
    neu = zusammenfuehren(standard, {"klassifizierung": "Intern"})
    assert neu.text("klassifizierung") == "Intern"
    assert neu.text("total_kauf") == standard.text("total_kauf")


def test_zusammenfuehren_weist_unbekannten_schluessel_ab(standard):
    with pytest.raises(OfferteError) as exc:
        zusammenfuehren(standard, {"gibt_es_nicht": "x"})
    assert exc.value.code == "E802"


def test_eigene_datei_wirkt_im_dokument(tmp_path):
    from offerttool.docxutil.xmlutil import W, paragraph_text
    from offerttool.pipeline import generiere

    import docx

    daten = yaml.safe_load(
        (ROOT / "offerttool" / "resources" / "textbausteine.yaml").read_text("utf-8")
    )
    daten["bausteine"]["head_standort"]["text"] = "Einsatzort {index} – {name}"
    daten["bausteine"]["klassifizierung"]["text"] = "Intern"
    eigene = tmp_path / "eigene.yaml"
    eigene.write_text(yaml.dump(daten, allow_unicode=True, sort_keys=False), "utf-8")

    ergebnis = generiere(
        [KALKTOOL], VORLAGE, tmp_path / "eigen.docx",
        toc_seitenzahlen=False, bausteine_pfad=eigene,
    )
    d = docx.Document(str(ergebnis.offerte))
    text = "\n".join(paragraph_text(p) for p in d.element.body.iter(W("w:p")))
    assert "Einsatzort 1 – Museum" in text
    assert "Intern" in text
    # Das Prüfprotokoll hält fest, welche Bausteine galten.
    assert "eigene.yaml" in ergebnis.protokoll.read_text("utf-8")


def test_fehlerhafte_datei_erzeugt_keine_offerte(tmp_path):
    from offerttool.pipeline import generiere

    daten = yaml.safe_load(
        (ROOT / "offerttool" / "resources" / "textbausteine.yaml").read_text("utf-8")
    )
    daten["bausteine"]["head_standort"]["text"] = "Standort {index}: {naem}"
    kaputt = tmp_path / "kaputt.yaml"
    kaputt.write_text(yaml.dump(daten, allow_unicode=True, sort_keys=False), "utf-8")

    ziel = tmp_path / "nie.docx"
    with pytest.raises(OfferteError) as exc:
        generiere([KALKTOOL], VORLAGE, ziel, toc_seitenzahlen=False, bausteine_pfad=kaputt)
    assert exc.value.code == "E801"
    assert not ziel.exists()


def test_cli_prueft_die_bausteine():
    ergebnis = subprocess.run(
        [sys.executable, "-m", "offerttool.cli", "bausteine"],
        capture_output=True, text=True, cwd=ROOT,
    )
    assert ergebnis.returncode == 0, ergebnis.stderr
    assert "geprüft, in Ordnung" in ergebnis.stdout


def test_browser_fassung_hat_dieselben_bausteine():
    """Die erzeugte JavaScript-Fassung darf nicht veralten."""
    import json

    js = (ROOT / "browser" / "src" / "26-bausteine-standard.js").read_text("utf-8")
    daten = json.loads(js.split("const BAUSTEINE_STANDARD = ", 1)[1].rsplit(";", 1)[0])
    assert daten == lade().als_dict(), (
        "26-bausteine-standard.js ist veraltet: python tools/browser_daten.py"
    )
