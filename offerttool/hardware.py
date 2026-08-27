"""Gerätedatenblätter (Hardware-Offertvorlagen).

Zu jedem Gerätemodell gibt es eine Word-Vorlage mit Beschreibung, technischen
Daten und einer Optionsliste.  Sie tragen dieselben Kopf- und Fusszeilen wie die
Offerte und sind erkennbar dafür gemacht, als Kapitel darin zu stehen.

Zugeordnet wird über den Modellnamen.  Ist die Zuordnung nicht eindeutig oder
findet sich nichts, entsteht eine Warnung – geraten wird nicht.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from docx.oxml.ns import qn

from .docxutil.uebernehmen import Quelldokument
from .docxutil.xmlutil import W
from .errors import WarningCollector

ENDUNGEN = (".dotx", ".docx", ".dotm", ".docm")

# Die Optionsliste am Schluss trägt im Word-Dokument eine eigene
# Formatvorlage – daran lässt sie sich zuverlässig abtrennen.
STIL_SPEZIFIKATION = "Fliesstext10ptSpezifikationGerte"

# Überschriften heissen in den Datenblättern anders als in der Offertvorlage.
# Ohne diese Zuordnung fände das Inhaltsverzeichnis das Kapitel nicht.
STIL_ABBILDUNG = {
    "berschrift1": "Heading1",
    "berschrift2": "Heading2",
    "berschrift3": "Heading3",
    "berschrift4": "Heading4",
    "Heading1": "Heading1",
}


def normalisieren(text: str) -> str:
    """Modellnamen vergleichbar machen: ohne Zubehör, Sprache und Trennzeichen."""
    t = unicodedata.normalize("NFKD", str(text or "")).lower()
    t = re.sub(r"\b(de|fr|it|en)\b", " ", t)
    t = re.sub(r"\bv\d+\b", " ", t)
    t = re.sub(r"[^a-z0-9]+", "", t)
    return t


@dataclass
class Datenblatt:
    """Ein Gerätedatenblatt und die Stelle, an der die Spezifikation beginnt."""

    pfad: Path
    modell: str
    schluessel: str
    quelle: Quelldokument | None = None

    def laden(self) -> Quelldokument:
        if self.quelle is None:
            self.quelle = Quelldokument.oeffnen(self.pfad)
        return self.quelle

    def bloecke(self, mit_spezifikation: bool) -> list:
        """Blockelemente des Datenblatts, ohne die eigenen Kapitelüberschriften.

        Überschrift 1 und 2 („Hardware", „Multifunktionsgeräte") setzt der
        Renderer einmal für alle Geräte; aus dem Datenblatt kommt alles ab der
        Modellüberschrift.
        """
        quelle = self.laden()
        aus: list = []
        begonnen = False
        for kind in quelle.body.iterchildren():
            if kind.tag not in (W("w:p"), W("w:tbl")):
                continue
            stil = _absatzstil(kind)
            if not begonnen:
                # Alles vor der Modellüberschrift überspringen.
                if kind.tag == W("w:p") and stil in ("berschrift3", "Heading3"):
                    begonnen = True
                else:
                    continue
            if not mit_spezifikation and stil == STIL_SPEZIFIKATION:
                continue
            aus.append(kind)
        return aus

    @property
    def hat_spezifikation(self) -> bool:
        quelle = self.laden()
        return any(
            _absatzstil(k) == STIL_SPEZIFIKATION
            for k in quelle.body.iterchildren()
            if k.tag == W("w:p")
        )


def _absatzstil(element) -> str:
    if element.tag != W("w:p"):
        pr = element.find(W("w:tblPr"))
        stil = pr.find(W("w:tblStyle")) if pr is not None else None
        return stil.get(qn("w:val")) if stil is not None else ""
    ppr = element.find(W("w:pPr"))
    if ppr is None:
        return "Normal"
    stil = ppr.find(W("w:pStyle"))
    return stil.get(qn("w:val")) if stil is not None else "Normal"


@dataclass
class Bibliothek:
    """Alle Datenblätter eines Verzeichnisses, nach Modell auffindbar."""

    verzeichnis: Path
    blaetter: list[Datenblatt] = field(default_factory=list)

    @classmethod
    def laden(cls, verzeichnis: str | Path) -> "Bibliothek":
        p = Path(verzeichnis)
        blaetter = []
        for pfad in sorted(p.rglob("*")):
            if pfad.suffix.lower() not in ENDUNGEN or pfad.name.startswith("~$"):
                continue
            modell = pfad.stem
            blaetter.append(
                Datenblatt(pfad=pfad, modell=modell, schluessel=normalisieren(modell))
            )
        return cls(verzeichnis=p, blaetter=blaetter)

    def finde(self, bezeichnung: str, warn: WarningCollector | None = None) -> Datenblatt | None:
        """Das Datenblatt zu einer Gerätebezeichnung aus dem Kalktool.

        Gesucht wird zuerst nach genauer Übereinstimmung, dann danach, ob der
        Dateiname die Bezeichnung enthält.  Bleiben mehrere Treffer, wird
        keiner gewählt – stattdessen `W330`.
        """
        gesucht = normalisieren(bezeichnung)
        if not gesucht:
            return None

        genau = [b for b in self.blaetter if b.schluessel == gesucht]
        if len(genau) == 1:
            return genau[0]
        if len(genau) > 1:
            if warn:
                warn.add("W330", f"{bezeichnung}: {', '.join(b.modell for b in genau)}")
            return None

        teil = [b for b in self.blaetter if gesucht and gesucht in b.schluessel]
        if len(teil) == 1:
            return teil[0]
        if len(teil) > 1:
            if warn:
                warn.add("W330", f"{bezeichnung}: {', '.join(b.modell for b in teil)}")
            return None

        if warn:
            warn.add("W331", bezeichnung)
        return None

    def __len__(self) -> int:
        return len(self.blaetter)


def datenblaetter_fuer(
    standorte: list, bibliothek: Bibliothek, warn: WarningCollector
) -> list[tuple[str, Datenblatt]]:
    """Je angebotenem Gerät ein Datenblatt, ohne Wiederholungen.

    Gesucht wird nur zum Gerät, nicht zum Zubehör: ein Kalktool ist ein
    Standort ist ein Gerät (Abschnitt 2.2), und das Gerät ist die erste
    Hardwareposition.  Für Papierkassetten und Unterschränke gibt es keine
    Datenblätter, sie würden nur Fehlmeldungen erzeugen.

    Steht dasselbe Modell an mehreren Standorten, erscheint sein Datenblatt
    trotzdem nur einmal.
    """
    aus: list[tuple[str, Datenblatt]] = []
    gesehen: set[Path] = set()
    for ctx, d in standorte:
        warn.standort = ctx.index
        if not d.geraet:
            continue
        blatt = bibliothek.finde(d.geraet, warn)
        if blatt is None or blatt.pfad in gesehen:
            continue
        gesehen.add(blatt.pfad)
        aus.append((d.geraet, blatt))
    warn.standort = None
    return aus
