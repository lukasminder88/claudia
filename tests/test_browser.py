"""Browser-Fassung: erzeugte Dateien und Golden Record.

Die Regeln liegen in der Browser-Fassung ein zweites Mal vor. Diese Tests
sichern, dass die generierten Teile aktuell sind – der eigentliche Golden
Record läuft im Browser (``browser/test/golden.js``, gestartet über
``dist/Pruefung.html``).
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
QUELLE = ROOT / "browser" / "src"
PUBLIC = ROOT / "public"
DIST = ROOT / "dist"


def _neu_erzeugen(tmp_path: Path) -> None:
    """Erzeugte Quellen in eine Kopie schreiben, um sie zu vergleichen."""
    subprocess.run(
        [sys.executable, str(ROOT / "tools" / "browser_daten.py")],
        check=True, capture_output=True, cwd=ROOT,
    )


def test_mapping_stimmt_mit_der_yaml_ueberein(tmp_path):
    """Die Browser-Fassung darf nicht auf einem alten Mapping sitzenbleiben."""
    import yaml

    alt = (QUELLE / "30-mapping.js").read_text("utf-8")
    _neu_erzeugen(tmp_path)
    neu = (QUELLE / "30-mapping.js").read_text("utf-8")
    assert alt == neu, "30-mapping.js ist veraltet: python tools/browser_daten.py"

    daten = json.loads(neu.split("const MAPPING = ", 1)[1].rsplit(";", 1)[0])
    yml = yaml.safe_load(
        (ROOT / "offerttool" / "resources" / "mapping_q4_2025.yaml").read_text("utf-8")
    )
    assert daten == yml


def test_vorlage_ist_eingebettet():
    import base64

    js = (QUELLE / "50-vorlage.js").read_text("utf-8")
    b64 = "".join(z.strip().strip('",') for z in js.split("[", 1)[1].rsplit("]", 1)[0].splitlines())
    bytes_ = base64.b64decode(b64)
    docx = (ROOT / "offerttool" / "resources" / "Offerte_anchored.docx").read_bytes()
    assert bytes_ == docx, "50-vorlage.js ist veraltet: python tools/browser_daten.py"


def test_einzeldatei_ist_aktuell(tmp_path):
    """dist/Offerttool.html muss zu den Quellen unter browser/src passen."""
    ziel = tmp_path / "index.html"
    subprocess.run(
        [sys.executable, str(ROOT / "tools" / "browser_bauen.py"), "--ziel", str(ziel)],
        check=True, capture_output=True, cwd=ROOT,
    )
    gebaut = PUBLIC / "index.html"
    assert gebaut.exists(), "public/index.html fehlt: python tools/browser_bauen.py"
    assert ziel.read_text("utf-8") == gebaut.read_text("utf-8"), \
        "public/index.html ist veraltet: python tools/browser_bauen.py --test"


def test_offline_paket_ist_vorhanden():
    """Das Paket wird neben der Seite ausgeliefert und ist herunterladbar."""
    import zipfile

    paket = PUBLIC / "Offerttool-PoC.zip"
    assert paket.exists(), "public/Offerttool-PoC.zip fehlt: python tools/offline_paket.py"
    namen = zipfile.ZipFile(paket).namelist()
    assert "Offerttool-PoC/Offerttool.html" in namen
    assert "Offerttool-PoC/LIESMICH.md" in namen
    assert any(n.endswith(".xlsx") for n in namen)


def test_einzeldatei_zieht_nichts_nach():
    """Eine Offline-Fassung darf nichts nachladen.

    XML-Namensräume wie ``http://schemas.openxmlformats.org/...`` sind blosse
    Bezeichner und werden nie abgerufen; geprüft wird auf die Konstrukte, die
    tatsächlich etwas laden würden.
    """
    html = (PUBLIC / "index.html").read_text("utf-8")

    # fetch() ist erlaubt, aber nur für die Gerätedatenblätter neben der
    # Seite; die CSP begrenzt es auf den eigenen Server.
    for verboten in ("<script src=", "<link rel", "@import",
                     "XMLHttpRequest", "import(", "new Worker(", "EventSource"):
        assert verboten not in html, f"Die Einzeldatei lädt nach: {verboten}"
    for treffer in re.findall(r"fetch\(([^)]*)", html):
        assert "datenblaetter" in treffer or "VERZEICHNIS" in treffer or "INDEX" in treffer, \
            f"fetch auf etwas anderes als die Datenblätter: {treffer[:60]}"

    ohne_namensraum = html.replace("http://schemas.openxmlformats.org", "")
    for schema in ("http://", "https://"):
        assert schema not in ohne_namensraum, f"Externer Verweis gefunden: {schema}"


@pytest.mark.skipif(
    shutil.which("node") is None, reason="node für den Browser-Testlauf nicht vorhanden"
)
def test_golden_record_im_browser(tmp_path):
    """Führt browser/test/golden.js in einem echten Browser aus."""
    treiber = ROOT / "tools" / "browser_pruefen.mjs"
    if not (DIST / "pruefung.html").exists():
        pytest.skip("dist/pruefung.html noch nicht gebaut")
    ergebnis = subprocess.run(
        ["node", str(treiber)], capture_output=True, text=True, cwd=ROOT, timeout=300
    )
    if ergebnis.returncode == 2:
        pytest.skip(f"Playwright/Chromium nicht verfügbar: {ergebnis.stderr.strip()[:200]}")
    assert ergebnis.returncode == 0, ergebnis.stdout + ergebnis.stderr
    assert "bestanden" in ergebnis.stdout, ergebnis.stdout


def test_datenblaetter_werden_nicht_eingebettet():
    """Die Einzeldatei bleibt klein: die Datenblätter holt sie vom Server.

    Wären sie eingebettet, wüchse die Datei um rund 6,5 MB – und auf einer
    öffentlichen Seite lägen alle Geschäftsunterlagen offen.
    """
    html = (PUBLIC / "index.html").read_text("utf-8")
    assert len(html) < 1_000_000, f"Einzeldatei zu gross: {len(html)} Zeichen"
    # Der Pfad wird zur Laufzeit zusammengesetzt; geprüft wird die Konstante.
    assert 'VERZEICHNIS = "datenblaetter/"' in html, "Verweis auf das Verzeichnis fehlt"


def test_bereitgestellte_datenblaetter_haben_ein_verzeichnis():
    """Falls Datenblätter bereitgestellt wurden, muss die index.json passen."""
    ordner = PUBLIC / "datenblaetter"
    if not ordner.is_dir():
        pytest.skip("keine Datenblätter bereitgestellt")
    daten = json.loads((ordner / "index.json").read_text("utf-8"))
    eintraege = daten["datenblaetter"]
    assert eintraege
    for e in eintraege:
        assert (ordner / e["datei"]).exists(), e["datei"]
        assert e["modell"]
