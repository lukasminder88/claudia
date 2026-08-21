"""Auftragsspeicher der Web-App.

Hochgeladene Kalktools enthalten Marge, CIF und Kundendaten – genau das, was die
Sperrliste aus Abschnitt 13.2 nie ins Dokument lässt.  Auf dem Server hat davon
nichts dauerhaft zu liegen: jeder Auftrag lebt in einem eigenen temporären
Verzeichnis und wird nach dem Abholen oder spätestens nach Ablauf der Frist
restlos gelöscht.  Es gibt keine Datenbank und kein Archiv.
"""

from __future__ import annotations

import shutil
import tempfile
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path

# Wie lange ein fertiges Ergebnis abholbar bleibt.
LEBENSDAUER_SEKUNDEN = 30 * 60

# Wie viele Generierungen gleichzeitig laufen dürfen.  Der Schritt POSTPROCESS
# startet je Auftrag einen LibreOffice-Prozess; ohne Grenze bringt eine Handvoll
# gleichzeitiger Klicks den Server in die Knie.
MAX_PARALLEL = 2


@dataclass
class Auftrag:
    """Ein Generierungsauftrag samt seinem temporären Arbeitsverzeichnis."""

    id: str
    verzeichnis: Path
    erstellt: float
    dateiname: str = "Offerte.docx"
    offerte: Path | None = None
    protokoll: Path | None = None
    warnungen: list[dict] = field(default_factory=list)
    zusammenfassung: dict = field(default_factory=dict)

    @property
    def abgelaufen(self) -> bool:
        return (time.time() - self.erstellt) > LEBENSDAUER_SEKUNDEN

    def aufraeumen(self) -> None:
        shutil.rmtree(self.verzeichnis, ignore_errors=True)


class Auftragsspeicher:
    """Hält laufende und fertige Aufträge, bis ihre Frist abläuft."""

    def __init__(self, lebensdauer: int = LEBENSDAUER_SEKUNDEN) -> None:
        self._auftraege: dict[str, Auftrag] = {}
        self._lock = threading.Lock()
        self._lebensdauer = lebensdauer
        self._wurzel = Path(tempfile.mkdtemp(prefix="offerttool-web-"))
        self.semaphore = threading.BoundedSemaphore(MAX_PARALLEL)

    def neu(self) -> Auftrag:
        self.verfallene_loeschen()
        kennung = uuid.uuid4().hex
        verzeichnis = self._wurzel / kennung
        verzeichnis.mkdir(parents=True)
        auftrag = Auftrag(id=kennung, verzeichnis=verzeichnis, erstellt=time.time())
        with self._lock:
            self._auftraege[kennung] = auftrag
        return auftrag

    def holen(self, kennung: str) -> Auftrag | None:
        with self._lock:
            auftrag = self._auftraege.get(kennung)
        if auftrag is None:
            return None
        if (time.time() - auftrag.erstellt) > self._lebensdauer:
            self.loeschen(kennung)
            return None
        return auftrag

    def loeschen(self, kennung: str) -> None:
        with self._lock:
            auftrag = self._auftraege.pop(kennung, None)
        if auftrag is not None:
            auftrag.aufraeumen()

    def verfallene_loeschen(self) -> int:
        jetzt = time.time()
        with self._lock:
            alt = [
                k for k, a in self._auftraege.items()
                if (jetzt - a.erstellt) > self._lebensdauer
            ]
        for kennung in alt:
            self.loeschen(kennung)
        return len(alt)

    def alles_loeschen(self) -> None:
        """Beim Herunterfahren bleibt nichts zurück."""
        with self._lock:
            kennungen = list(self._auftraege)
        for kennung in kennungen:
            self.loeschen(kennung)
        shutil.rmtree(self._wurzel, ignore_errors=True)

    def __len__(self) -> int:
        with self._lock:
            return len(self._auftraege)
