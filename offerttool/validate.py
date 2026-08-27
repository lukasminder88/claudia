"""Schritt VALIDATE_INPUT und VALIDATE_OUTPUT (Abschnitt 13).

Bricht eine Prüfung ab, entsteht keine Datei – nie eine halbe Offerte.
"""

from __future__ import annotations

import re
from decimal import Decimal

from .derive import Derived
from .errors import OfferteError, WarningCollector
from .extract import StandortContext
from .docxutil.xmlutil import paragraph_text
from .formatters import _to_decimal, chf, int_ch, rate
from .mapping import Mapping

TOLERANZ = Decimal("0.01")

RE_PLATZHALTER = re.compile(r"%%[^%\s]+%%|\{[a-z][\w.|]*\}")
RE_ZAHL = re.compile(r"-?\d[\d’]*(?:\.\d+)?")


def validate_input(ctx: StandortContext, d: Derived, mapping: Mapping) -> None:
    """Abbruchregeln je Standort (Abschnitt 13.1)."""
    # Pflichtfelder des Feldkatalogs
    for name, spec in mapping.fields.items():
        if not spec.required_for(d.variante):
            continue
        value = ctx.values.get(name)
        if value is None or (isinstance(value, str) and not value.strip()):
            raise OfferteError("E211", f"{ctx.quelle}: Pflichtfeld {name} ({spec.cell.a1}) ist leer")

    if d.variante in ("MIETE", "LEASING"):
        if ctx.num("laufzeit") <= 0:
            raise OfferteError("E411", ctx.quelle)
        if ctx.num("pauschale_ohne_service") == 0:
            raise OfferteError("E413", ctx.quelle)
    if d.variante == "KAUF" and ctx.num("vertragswert") == 0:
        raise OfferteError("E414", ctx.quelle)

    if not any(p.bezeichnung for p in ctx.listen.get("hardware", [])):
        raise OfferteError("E412", ctx.quelle)

    # Doppelzählungssperre (Abschnitt 5.4): L95 = L92 + L93 + L94
    if d.variante in ("MIETE", "LEASING"):
        total = ctx.num("monatspauschale_total")
        teile = (
            ctx.num("pauschale_ohne_service")
            + ctx.num("service.solution")
            + ctx.num("service.geraet")
        )
        if abs(total - teile) > TOLERANZ:
            raise OfferteError(
                "E402", f"{ctx.quelle}: L95={total} != L92+L93+L94={teile}"
            )


def validate_across(standorte: list[tuple[StandortContext, Derived]], warn: WarningCollector) -> None:
    """Regeln über Standorte hinweg (Abschnitt 11)."""
    if len(standorte) < 2:
        return
    varianten = {d.variante for _, d in standorte}
    if len(varianten) > 1:
        raise OfferteError("E403", ", ".join(sorted(varianten)))

    kunden = {ctx.text("kunde.firma") for ctx, _ in standorte}
    if len(kunden) > 1:
        raise OfferteError("E404", ", ".join(sorted(kunden)))

    laufzeiten = {int(ctx.num("laufzeit")) for ctx, _ in standorte}
    if len(laufzeiten) > 1:
        warn.add("W310", ", ".join(str(x) for x in sorted(laufzeiten)))

    versionen = {ctx.text("kalktool.version") for ctx, _ in standorte}
    if len(versionen) > 1:
        warn.add("W311", ", ".join(sorted(versionen)))


def blocked_strings(standorte: list[tuple[StandortContext, Derived]]) -> set[str]:
    """Formatierte Ausprägungen aller gesperrten Zellwerte (Abschnitt 13.2)."""
    out: set[str] = set()
    for ctx, _d in standorte:
        for _addr, value in ctx.blocked_values:
            dec = _to_decimal(value)
            # Kleine Zahlen wie 1, 60 oder 0.6 kommen als Stückzahl, Laufzeit
            # oder Kalkulationsfaktor legitim vor und sind nicht unterscheidbar.
            if dec < 100:
                continue
            for text in (chf(dec), rate(dec), int_ch(dec)):
                out.add(text.replace("CHF ", "").strip())
    return out


def statische_token(vorlage_pfad) -> set[str]:
    """Zahlen, die in der Vorlage ohnehin stehen und keiner Zelle entstammen.

    Die Konditionentabelle nennt die Stundensätze für Technikereinsätze
    (180, 120, 200, 130). Steht eine dieser Zahlen zufällig auch in einer
    gesperrten Zelle des Kalktools, wäre das kein Leck – sie stand schon im
    Dokument, bevor überhaupt ein Kalktool gelesen wurde.

    Der Inhalt der **Blattanker** zählt nicht dazu: was dort steht, soll der
    Renderer überschreiben. Bleibt eine Zahl von dort stehen, ist das ein
    Vorlagenrest und wird weiterhin erkannt.
    """
    import docx

    from .docxutil.xmlutil import W, sdt_content, sdt_tag

    doc = docx.Document(str(vorlage_pfad))
    for sdt in doc.element.body.findall(".//" + W("w:sdt")):
        if sdt.findall(".//" + W("w:sdt")):
            continue  # Behälter: nur seine Blätter werden gefüllt
        if sdt_tag(sdt) == "SYS.TOC":
            continue  # das Verzeichnis wird ohnehin neu aufgebaut
        inhalt = sdt_content(sdt)
        if inhalt is not None:
            for kind in list(inhalt):
                inhalt.remove(kind)

    text = "\n".join(
        paragraph_text(p) for p in doc.element.body.iter(W("w:p"))
    )
    return set(RE_ZAHL.findall(text))


def validate_output(text: str, gesperrt: set[str], emitted: set[str] | None = None) -> None:
    """Sperrliste und Restplatzhalter im gerenderten Dokument (Abschnitt 13.2).

    Verglichen wird auf ganzen Zahltoken, nicht auf Teilzeichenketten: sonst
    fände ``300`` aus einer gesperrten Zelle einen Treffer in ``CHF 300.00``.

    ``emitted`` sind die Beträge, die der Renderer nachweislich selbst gesetzt
    hat.  Ein Wert kann zugleich in einer gesperrten und in einer freigegebenen
    Zelle stehen – das Dienstleistungstotal 300.00 etwa auch in ``KM!M74``.
    Nur ein Token, das der Renderer *nicht* gesetzt hat, ist ein Leck.
    """
    emitted = emitted or set()
    im_dokument = set(RE_ZAHL.findall(text))
    treffer = sorted(w for w in gesperrt if w not in emitted and w in im_dokument)
    if treffer:
        raise OfferteError("E601", ", ".join(treffer[:5]))
    rest = RE_PLATZHALTER.search(text)
    if rest:
        raise OfferteError("E602", rest.group(0))
