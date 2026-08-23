"""Offerttool V3 – regelbasierte Generierung einer Offerte aus n Kalktools.

Der Generator trifft **keine** Entscheidungen.  Jede Ausgabe ist Funktion von
(Vorlage, Kalktool-Zellen, CRM-Datensatz, Spezifikation).  Gleiche Eingabe
ergibt byteweise gleiche Ausgabe – kein Sprachmodell ist beteiligt.
"""

from .errors import OfferteError, Warning_, WarningCollector  # noqa: F401

__version__ = "3.0.0"
__all__ = ["OfferteError", "Warning_", "WarningCollector", "generiere", "prepare"]


def __getattr__(name):
    if name == "generiere":
        from .pipeline import generiere

        return generiere
    if name == "prepare":
        from .prepare import prepare

        return prepare
    raise AttributeError(name)
