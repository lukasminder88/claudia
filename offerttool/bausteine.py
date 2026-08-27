"""Laden und Prüfen der Textbausteine (Abschnitt 8).

Die Formulierungen stehen in ``textbausteine.yaml`` und dürfen ohne
Programmierkenntnisse geändert werden.  Damit ein Tippfehler kein kaputtes
Dokument erzeugt, wird jeder Baustein beim Laden geprüft: erlaubt sind nur die
Platzhalter, die für ihn eingetragen sind.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from .errors import OfferteError

RESOURCES = Path(__file__).with_name("resources")
STANDARD = RESOURCES / "textbausteine.yaml"

# {feld} – doppelte Klammern {{ }} sind ein Zeichen, kein Platzhalter.
RE_PLATZHALTER = re.compile(r"(?<!\{)\{([a-z_][a-z0-9_]*)\}(?!\})")


@dataclass(frozen=True)
class Baustein:
    schluessel: str
    titel: str
    hinweis: str
    gruppe: str
    platzhalter: tuple[str, ...]
    absaetze: tuple[str, ...]
    mehrzeilig: bool

    @property
    def text(self) -> str:
        return self.absaetze[0] if self.absaetze else ""


class Bausteine:
    """Ein geladener Satz Textbausteine."""

    def __init__(self, daten: dict, quelle: Path | None = None) -> None:
        self.quelle = quelle
        self.version = str(daten.get("version", "1.0"))
        self.platzhalter: dict[str, str] = dict(daten.get("platzhalter") or {})
        self.beispiele: dict[str, str] = dict(daten.get("beispiele") or {})
        self.gruppen: dict[str, str] = dict(daten.get("gruppen") or {})
        self.bausteine: dict[str, Baustein] = {}

        for schluessel, spez in (daten.get("bausteine") or {}).items():
            if "absaetze" in spez:
                absaetze = tuple(str(a) for a in spez["absaetze"])
                mehrzeilig = True
            else:
                absaetze = (str(spez.get("text", "")),)
                mehrzeilig = False
            self.bausteine[schluessel] = Baustein(
                schluessel=schluessel,
                titel=str(spez.get("titel", schluessel)),
                hinweis=str(spez.get("hinweis", "")),
                gruppe=str(spez.get("gruppe", "")),
                platzhalter=tuple(spez.get("platzhalter") or []),
                absaetze=absaetze,
                mehrzeilig=mehrzeilig,
            )
        self.pruefen()

    # -- Prüfung ----------------------------------------------------------

    def pruefen(self) -> None:
        """Jeden Baustein gegen seine erlaubten Platzhalter halten."""
        for b in self.bausteine.values():
            erlaubt = set(b.platzhalter)
            for absatz in b.absaetze:
                for name in RE_PLATZHALTER.findall(absatz):
                    if name in erlaubt:
                        continue
                    if name in self.platzhalter:
                        raise OfferteError(
                            "E801",
                            f"Baustein «{b.titel}» ({b.schluessel}) verwendet "
                            f"{{{name}}}, das dort nicht vorgesehen ist. "
                            f"Erlaubt: {self._liste(b)}",
                        )
                    raise OfferteError(
                        "E801",
                        f"Baustein «{b.titel}» ({b.schluessel}) verwendet den "
                        f"unbekannten Platzhalter {{{name}}}. "
                        f"Erlaubt: {self._liste(b)}",
                    )
            offen = self._unpaarige_klammern(b)
            if offen:
                raise OfferteError(
                    "E801",
                    f"Baustein «{b.titel}» ({b.schluessel}): {offen} "
                    "Für eine geschweifte Klammer als Zeichen bitte {{ oder }} schreiben.",
                )

    @staticmethod
    def _liste(b: Baustein) -> str:
        return ", ".join("{" + p + "}" for p in b.platzhalter) or "keine"

    @staticmethod
    def _unpaarige_klammern(b: Baustein) -> str:
        for absatz in b.absaetze:
            ohne = RE_PLATZHALTER.sub("", absatz).replace("{{", "").replace("}}", "")
            if "{" in ohne or "}" in ohne:
                return "eine geschweifte Klammer steht allein."
        return ""

    # -- Zugriff ----------------------------------------------------------

    def __contains__(self, schluessel: str) -> bool:
        return schluessel in self.bausteine

    def hole(self, schluessel: str) -> Baustein:
        try:
            return self.bausteine[schluessel]
        except KeyError:
            raise OfferteError("E802", f"Unbekannter Textbaustein: {schluessel}") from None

    def text(self, schluessel: str, **werte) -> str:
        """Einen einzeiligen Baustein füllen."""
        return self._fuelle(self.hole(schluessel), self.hole(schluessel).text, werte)

    def absaetze(self, schluessel: str, **werte) -> list[str]:
        """Einen mehrzeiligen Baustein füllen."""
        b = self.hole(schluessel)
        return [self._fuelle(b, a, werte) for a in b.absaetze]

    def _fuelle(self, b: Baustein, vorlage: str, werte: dict) -> str:
        fehlend = [p for p in b.platzhalter if p not in werte]
        if fehlend:
            raise OfferteError(
                "E802",
                f"Baustein {b.schluessel}: kein Wert für "
                + ", ".join("{" + f + "}" for f in fehlend),
            )
        text = RE_PLATZHALTER.sub(lambda m: str(werte.get(m.group(1), "")), vorlage)
        return text.replace("{{", "{").replace("}}", "}")

    # -- Ausgabe für Editor und Browser-Fassung ---------------------------

    def als_dict(self) -> dict:
        return {
            "version": self.version,
            "platzhalter": self.platzhalter,
            "beispiele": self.beispiele,
            "gruppen": self.gruppen,
            "bausteine": {
                s: {
                    "titel": b.titel,
                    "hinweis": b.hinweis,
                    "gruppe": b.gruppe,
                    "platzhalter": list(b.platzhalter),
                    **({"absaetze": list(b.absaetze)} if b.mehrzeilig else {"text": b.text}),
                }
                for s, b in self.bausteine.items()
            },
        }


def lade(pfad: str | Path | None = None) -> Bausteine:
    """Bausteine laden; ohne Pfad die mitgelieferten."""
    p = Path(pfad) if pfad else STANDARD
    if not p.exists():
        raise OfferteError("E802", f"Textbausteine nicht gefunden: {p}")
    try:
        daten = yaml.safe_load(p.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise OfferteError("E801", f"{p.name} ist nicht lesbar: {exc}") from exc
    if not isinstance(daten, dict) or "bausteine" not in daten:
        raise OfferteError("E801", f"{p.name} enthält keinen Abschnitt «bausteine».")
    return Bausteine(daten, p)


def zusammenfuehren(basis: Bausteine, eigene: dict) -> Bausteine:
    """Eigene Texte über die mitgelieferten legen.

    ``eigene`` ist eine flache Zuordnung Schlüssel -> Text oder Absatzliste,
    wie sie der Editor der Browser-Fassung sichert.  Unbekannte Schlüssel
    werden abgewiesen, damit ein Tippfehler nicht stillschweigend wirkungslos
    bleibt.
    """
    daten = basis.als_dict()
    for schluessel, wert in (eigene or {}).items():
        if schluessel not in daten["bausteine"]:
            raise OfferteError("E802", f"Unbekannter Textbaustein: {schluessel}")
        eintrag = daten["bausteine"][schluessel]
        if isinstance(wert, list):
            eintrag.pop("text", None)
            eintrag["absaetze"] = [str(a) for a in wert]
        else:
            eintrag.pop("absaetze", None)
            eintrag["text"] = str(wert)
    return Bausteine(daten, basis.quelle)
