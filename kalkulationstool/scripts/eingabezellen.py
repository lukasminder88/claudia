#!/usr/bin/env python3
"""Alle Eingabezellen der Vorlage - Grundlage fuer spec/vorlage-defaults.json.

Eine Eingabezelle ist eine Zelle, die der Verkaeufer ausfuellt. Enthaelt sie in
der Vorlage eine Formel (z.B. 'Detail Solutions'!H21 = E21), gilt der
Vorgabewert None: die Engine rechnet dann selbst, der Wert kann aber von Hand
ueberschrieben werden.
"""

from __future__ import annotations


def bereich(spalte: str, von: int, bis: int) -> list[str]:
    return [f"{spalte}{zeile}" for zeile in range(von, bis + 1)]


KALKULATION: list[str] = [
    # Vertrag
    "I16", "J16", "G16", "H16", "B17", "C14", "I15", "E21", "I40", "J51",
    # Support
    "B66", "B67",
    # Hardware Zeilen 27-46 (in der Support-Bemessung) und 48-52 (danach)
    *bereich("C", 27, 52), *bereich("D", 27, 52),
    # Solutions Software - Zusatzzeilen direkt auf dem Blatt Kalkulation
    *bereich("I", 28, 30), *bereich("J", 28, 30), *bereich("L", 28, 30),
    # Solutions Maintenance - Zusatzzeile
    "I37", "J37", "L37",
    # Dienstleistungen - Zusatzzeilen
    *bereich("I", 46, 48), *bereich("J", 46, 48),
    # Alter Vertrag
    "D21", "J19", "J21", "M19", "L23",
    # Volumen und Seitenpreise
    "H56", "H57", "H59", "H61", "H62", "H64", "H66", "H67", "H69",
    # Monatspauschalen
    "M58", "M59", "M60", "M61", "M62", *bereich("M", 64, 69),
    # Transport, Integration und weitere Positionen
    *[f"{spalte}{zeile}" for zeile in (73, 75, 77, 79, 81, 84, 87, 90, 93) for spalte in ("A", "B")],
]

DETAIL_SOLUTIONS: list[str] = [
    *bereich("A", 21, 38), *bereich("D", 21, 38), *bereich("F", 21, 38), *bereich("H", 21, 38),
    *bereich("A", 43, 56), *bereich("D", 43, 56), *bereich("F", 43, 56), *bereich("H", 43, 56),
    *bereich("A", 61, 70), *bereich("G", 61, 70),
]

EINGABEZELLEN = {"Kalkulation": KALKULATION, "Detail Solutions": DETAIL_SOLUTIONS}
