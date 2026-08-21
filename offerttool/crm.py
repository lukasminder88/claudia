"""CRM-Datensatz (Abschnitt 2.3 und 4.4).

JSON, ein Objekt je Offerte.  Ein leeres Kann-Feld erzeugt keine leere Zeile im
Dokument – der Absatz wird gelöscht.
"""

from __future__ import annotations

import json
from pathlib import Path

from .errors import WarningCollector
from .formatters import trim


def _flatten(obj, prefix: str = "") -> dict:
    out = {}
    for key, value in (obj or {}).items():
        name = f"{prefix}{key}"
        if isinstance(value, dict):
            out.update(_flatten(value, name + "."))
        else:
            out[name] = value
    return out


class CRM:
    """Zugriff auf den CRM-Datensatz mit den Ersatzregeln aus Abschnitt 4.4."""

    FELDER = (
        "offertnummer",
        "offertversion",
        "kontakt.anrede",
        "kontakt.vorname",
        "kontakt.nachname",
        "vk.funktion",
        "vk.email",
        "vk.telefon",
    )

    def __init__(self, data: dict | None = None) -> None:
        flat = _flatten(data or {})
        # Sowohl "crm.offertnummer" als auch "offertnummer" werden akzeptiert.
        self.data = {k[4:] if k.startswith("crm.") else k: v for k, v in flat.items()}

    @classmethod
    def load(cls, path: str | Path | None) -> "CRM":
        if path is None:
            return cls({})
        with Path(path).open(encoding="utf-8") as fh:
            return cls(json.load(fh))

    def get(self, name: str) -> str:
        return trim(self.data.get(name, ""))

    def offertnummer(self, verkaufschance: str, warn: WarningCollector) -> str:
        value = self.get("offertnummer")
        if value:
            return value
        warn.add("W305", f"Ersatz: {verkaufschance}")
        return verkaufschance

    def offertversion(self, warn: WarningCollector) -> str:
        value = self.get("offertversion")
        if value:
            return value
        warn.add("W306", "Ersatz: 1.0")
        return "1.0"

    def unbekannte_felder(self) -> list[str]:
        return sorted(k for k in self.data if k not in self.FELDER)
