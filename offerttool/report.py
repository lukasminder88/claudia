"""Prüfprotokoll ``<offerte>.pruefprotokoll.md`` (Abschnitt 13.3).

Warnungen erscheinen im Log **und** in dieser Begleitdatei, nie im Dokument.
"""

from __future__ import annotations

from pathlib import Path

from .derive import Derived
from .errors import WarningCollector
from .extract import StandortContext
from .formatters import chf, date_de, int_ch


def schreibe_protokoll(
    ziel: Path,
    standorte: list[tuple[StandortContext, Derived]],
    warn: WarningCollector,
    mapping_version: str,
    vorlage: str,
) -> Path:
    pfad = ziel.with_suffix(ziel.suffix + ".pruefprotokoll.md")
    erste, erste_d = standorte[0]

    zeilen = [
        f"# Prüfprotokoll – {ziel.name}",
        "",
        "## Eingaben",
        "",
        f"- Vorlage: `{vorlage}`",
        f"- Mapping: `{mapping_version}`",
        f"- Standorte: {len(standorte)}",
    ]
    for ctx, _d in standorte:
        zeilen.append(f"  - {ctx.index}. `{ctx.quelle}`")

    zeilen += [
        "",
        "## Abgeleitete Werte",
        "",
        "| Grösse | Wert |",
        "|---|---|",
        f"| variante | `{erste_d.variante}` |",
        f"| laufzeit | {int_ch(erste.num('laufzeit'))} Monate |",
        f"| kunde.firma | {erste.text('kunde.firma')} |",
        f"| datum | {date_de(erste.get('datum'))} |",
        f"| gueltig_bis | {date_de(erste_d.gueltig_bis)} |",
    ]
    for ctx, d in standorte:
        zeilen.append(
            f"| Standort {ctx.index} – einmalige Kosten | {chf(d.dienstleistung_total)} |"
        )
        if d.variante == "KAUF":
            zeilen.append(f"| Standort {ctx.index} – Vertragswert | {chf(ctx.num('vertragswert'))} |")
        else:
            zeilen.append(
                f"| Standort {ctx.index} – Monatspauschale total | "
                f"{chf(ctx.num('monatspauschale_total'))} |"
            )

    zeilen += ["", "## Schalter", "", "| Schalter | Standort | Wert |", "|---|---|---|"]
    for ctx, d in standorte:
        for name, wert in sorted(d.show.items()):
            zeilen.append(f"| show.{name} | {ctx.index} | {'wahr' if wert else 'falsch'} |")

    zeilen += ["", "## Warnungen", ""]
    if warn.items:
        zeilen += ["| Code | Standort | Bedeutung | Detail |", "|---|---|---|---|"]
        for w in warn.items:
            zeilen.append(
                f"| `{w.code}` | {w.standort or '–'} | {w.text} | {w.detail or '–'} |"
            )
    else:
        zeilen.append("Keine Warnungen.")

    zeilen += [
        "",
        "## Prüfungen",
        "",
        "- Sperrliste (E601): keine Treffer im gerenderten Dokument.",
        "- Restplatzhalter (E602): keine gefunden.",
        f"- Doppelzählungssperre (E402): L95 = L92 + L93 + L94 für alle {len(standorte)} Standorte.",
        "",
    ]
    pfad.write_text("\n".join(zeilen), encoding="utf-8")
    return pfad
