"""Fehler- und Warnungscodes gemäss Spezifikation V3, Abschnitt 13.

Der Generator trifft keine Entscheidungen: Jede Abweichung von der Spezifikation
ist entweder ein Abbruch (``E...``) oder eine Warnung (``W...``).  Warnungen
landen im Log und im Prüfprotokoll, nie im Dokument.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# --- Abbruchcodes (Abschnitt 13.1) -----------------------------------------
ERROR_TEXTS = {
    "E101": "Anker aus Abschnitt 3.2 fehlt in der Vorlage",
    "E102": "Unbekannter Anker in der Vorlage",
    "E201": "Kalktool nicht lesbar oder Blattanzahl < 2",
    "E211": "Zelle aus dem Feldkatalog ausserhalb des Blattbereichs",
    "E401": "finanzierungsart leer oder nicht in 1-5",
    "E402": "L95 != L92 + L93 + L94 (Toleranz 0.01)",
    "E403": "Gemischte Finanzierungsarten über mehrere Standorte",
    "E404": "Unterschiedliche Kunden über mehrere Standorte",
    "E411": "laufzeit leer oder <= 0 bei MIETE/LEASING",
    "E412": "Kein Hardwareartikel mit Bezeichnung",
    "E413": "MIETE/LEASING und L92 = 0",
    "E414": "KAUF und C62 = 0",
    "E601": "Wert aus der Sperrliste im gerenderten Dokument",
    "E801": "Textbaustein fehlerhaft",
    "E802": "Textbaustein fehlt oder ist unbekannt",
    "E602": "Unaufgelöster Platzhalter im gerenderten Dokument",
}

# --- Warnungscodes (Abschnitt 13.3) ----------------------------------------
WARNING_TEXTS = {
    "W301": "PLZ/Ort nicht trennbar",
    "W302": "Mail oder Telefon in J5 nicht gefunden",
    "W303": "Name in J5 mehrdeutig",
    "W304": "Vertragsbeginn in A100 nicht parsbar",
    "W305": "Offertnummer aus CRM fehlt, Verkaufschance eingesetzt",
    "W306": "Offertversion fehlt, 1.0 eingesetzt",
    "W307": "C53 != Summe der Listenpreise, Stückzahl nicht belegbar",
    "W308": "M9 liefert TODAY() statt eines eingefrorenen Datums",
    "W309": "standort.name leer",
    "W310": "Unterschiedliche Laufzeiten über mehrere Standorte",
    "W311": "Unterschiedliche Kalktool-Versionen",
    "W312": "#DIV/0! in H32 oder H39 (rein intern, ohne Wirkung auf die Offerte)",
    "W320": "Blattname weicht vom erwarteten Namen ab",
    "W321": "Inhaltsverzeichnis ohne Seitenzahlen erzeugt (kein PDF-Renderer verfügbar)",
    "W330": "Mehrere Datenblätter passen auf dieselbe Gerätebezeichnung",
    "W331": "Kein Datenblatt zu diesem Gerät gefunden",
    "W332": "Bild aus einem Datenblatt konnte nicht übernommen werden",
}


class OfferteError(Exception):
    """Abbruch der Pipeline.  Es entsteht keine Ausgabedatei."""

    def __init__(self, code: str, detail: str = "") -> None:
        self.code = code
        self.detail = detail
        base = ERROR_TEXTS.get(code, "Unbekannter Fehler")
        super().__init__(f"{code}: {base}" + (f" – {detail}" if detail else ""))


@dataclass(frozen=True)
class Warning_:
    """Eine Warnung mit Code, Standortbezug und freiem Detailtext."""

    code: str
    detail: str = ""
    standort: int | None = None

    @property
    def text(self) -> str:
        return WARNING_TEXTS.get(self.code, "Unbekannte Warnung")

    def __str__(self) -> str:
        ort = f" [Standort {self.standort}]" if self.standort else ""
        det = f" – {self.detail}" if self.detail else ""
        return f"{self.code}{ort}: {self.text}{det}"


@dataclass
class WarningCollector:
    """Sammelt Warnungen in Auftrittsreihenfolge, ohne Duplikate."""

    items: list[Warning_] = field(default_factory=list)
    standort: int | None = None

    def add(self, code: str, detail: str = "") -> None:
        w = Warning_(code, detail, self.standort)
        if w not in self.items:
            self.items.append(w)

    def codes(self) -> list[str]:
        seen: list[str] = []
        for w in self.items:
            if w.code not in seen:
                seen.append(w.code)
        return seen

    def extend(self, other: "WarningCollector") -> None:
        for w in other.items:
            if w not in self.items:
                self.items.append(w)
