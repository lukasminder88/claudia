#!/usr/bin/env python3
"""Testfaelle fuer die Fixture-Erzeugung.

Jeder Fall beschreibt nur die Eingabezellen. Die erwarteten Zahlen kommen aus
dem Excel (siehe extract_fixtures.py) und werden hier bewusst nicht notiert.
"""

from __future__ import annotations

KAUF, MIETE, LEASING, SPEZIAL_LEASING, SPEZIAL_MIETE = 1, 2, 3, 4, 5


def hardware(*preise: float, kalkulationsart: float = 0.6) -> dict:
    """Hardware-Positionen ab Zeile 27 (Listenpreis C, Kalkulationsart D)."""
    zellen: dict[str, object] = {}
    for versatz, preis in enumerate(preise):
        zeile = 27 + versatz
        zellen[f"C{zeile}"] = preis
        zellen[f"D{zeile}"] = kalkulationsart
    return zellen


def software(*posten: tuple[float, float], kalkulationsart: float = 0.7) -> dict:
    """Solutions-Software auf 'Detail Solutions' ab Zeile 21: (Anzahl, LP)."""
    zellen: dict[str, object] = {}
    for versatz, (anzahl, preis) in enumerate(posten):
        zeile = 21 + versatz
        zellen[f"A{zeile}"] = anzahl
        zellen[f"D{zeile}"] = preis
        zellen[f"F{zeile}"] = kalkulationsart
    return zellen


def maintenance(*posten: tuple[float, float], kalkulationsart: float = 0.7) -> dict:
    """Solutions-Maintenance auf 'Detail Solutions' ab Zeile 43: (Anzahl, LP)."""
    zellen: dict[str, object] = {}
    for versatz, (anzahl, preis) in enumerate(posten):
        zeile = 43 + versatz
        zellen[f"A{zeile}"] = anzahl
        zellen[f"D{zeile}"] = preis
        zellen[f"F{zeile}"] = kalkulationsart
    return zellen


def dienstleistungen(*posten: tuple[float, float]) -> dict:
    """Dienstleistungen auf 'Detail Solutions' ab Zeile 61: (Stunden, Ansatz)."""
    zellen: dict[str, object] = {}
    for versatz, (stunden, ansatz) in enumerate(posten):
        zeile = 61 + versatz
        zellen[f"A{zeile}"] = stunden
        zellen[f"G{zeile}"] = ansatz
    return zellen


def vertrag(
    art: int,
    laufzeit: int,
    *,
    kam: bool = False,
    verlaengerung: bool = False,
    rabatt: float = 0.0,
    fakt_leasing: str = "Monatlich",
    faktor_spezial_miete: float = 0.018914,
    faktor_spezial_leasing: object = None,
    maintenance_in_pauschale: str = "Nein",
    dienstleistung_verrechnet: float = 0.0,
) -> dict:
    zellen: dict[str, object] = {
        "I16": art,
        "J16": laufzeit,
        "B17": kam,
        "C14": verlaengerung,
        "E21": rabatt,
        "I15": fakt_leasing,
        "G16": faktor_spezial_miete,
        "I40": maintenance_in_pauschale,
        "J51": dienstleistung_verrechnet,
    }
    if faktor_spezial_leasing is not None:
        zellen["H16"] = faktor_spezial_leasing
    return zellen


def pauschalen(
    *,
    sw_volumen: float = 0.0,
    sw_preis: float = 0.0,
    color_volumen: float = 0.0,
    color_preis: float = 0.0,
    scan_volumen: float = 0.0,
    scan_preis: float = 0.0,
    sla: float = 0.0,
    grundpauschale: float = 0.0,
    solutions_monatlich: float = 0.0,
) -> dict:
    return {
        "H56": sw_volumen, "H57": sw_preis,
        "H61": color_volumen, "H62": color_preis,
        "H66": scan_volumen, "H67": scan_preis,
        "M58": sla, "M59": grundpauschale, "M64": solutions_monatlich,
    }


def zusatz(transport: tuple[float, float] = (0.0, 0.0),
           netzwerk: tuple[float, float] = (0.0, 0.0)) -> dict:
    """Transport (Zeile 73) und Integration Netzwerk (Zeile 77): (Verrechnet, Finanziert)."""
    return {
        "A73": transport[0], "B73": transport[1],
        "A77": netzwerk[0], "B77": netzwerk[1],
    }


def altvertrag(*, nicht_erfuellt: bool = False, offene_raten: float = 0.0,
               miete_pro_monat: float = 0.0, aufrechnung: bool = False) -> dict:
    return {
        "D21": nicht_erfuellt, "J19": offene_raten, "J21": miete_pro_monat,
        "M19": 1, "L23": aufrechnung,
    }


def fall(kalkulation: dict, detail: dict | None = None) -> dict:
    return {"Kalkulation": kalkulation, "Detail Solutions": detail or {}}


# Vier Geraetekonfigurationen ueber die geforderte Spanne 5'000 - 300'000.
GERAETE = {
    "klein": (5000.0,),
    "mittel": (13680.0, 4200.0),
    "gross": (48000.0, 12500.0, 6800.0),
    "sehr_gross": (180000.0, 74000.0, 46000.0),
}

SOLUTIONS = fall(
    {},
    {
        **software((1, 4800.0), (25, 120.0)),
        **maintenance((1, 950.0), (25, 24.0)),
        **dienstleistungen((16, 185.0), (8, 210.0)),
    },
)


def mit_solutions(kalkulation: dict, **detail_extra) -> dict:
    detail = dict(SOLUTIONS["Detail Solutions"])
    detail.update(detail_extra)
    return fall(kalkulation, detail)


FAELLE: list[tuple[str, str, dict]] = []


def hinzu(name: str, beschreibung: str, eingaben: dict) -> None:
    FAELLE.append((name, beschreibung, eingaben))


# --- Kauf ------------------------------------------------------------------
for groesse, preise in GERAETE.items():
    hinzu(
        f"kauf_{groesse}",
        f"Kauf, Geraetekonfiguration {groesse}, ohne Solutions",
        fall({**vertrag(KAUF, 48), **hardware(*preise), **pauschalen(sw_volumen=1000, sw_preis=0.015, grundpauschale=50)}),
    )

hinzu(
    "kauf_mit_rabatt",
    "Kauf mit 12 % Rabatt auf den Listenpreis",
    fall({**vertrag(KAUF, 48, rabatt=0.12), **hardware(*GERAETE["mittel"])}),
)
hinzu(
    "kauf_mit_solutions",
    "Kauf mit Software, Maintenance und Dienstleistungen",
    mit_solutions({**vertrag(KAUF, 48), **hardware(*GERAETE["mittel"]),
                   **pauschalen(sw_volumen=2000, sw_preis=0.012, color_volumen=800,
                                color_preis=0.075, grundpauschale=50, solutions_monatlich=35)}),
)
hinzu(
    "kauf_maintenance_in_pauschale",
    "Kauf, Maintenance laeuft ueber die Monatspauschale statt ueber den Verkauf",
    mit_solutions({**vertrag(KAUF, 48, maintenance_in_pauschale="Ja"), **hardware(*GERAETE["mittel"])}),
)

# --- Miete Graphax ---------------------------------------------------------
for laufzeit in (12, 24, 36, 48, 60, 72):
    hinzu(
        f"miete_{laufzeit}_ohne_solutions",
        f"Miete Graphax {laufzeit} Monate, ohne Solutions, ohne KAM-Faktor",
        fall({**vertrag(MIETE, laufzeit), **hardware(*GERAETE["mittel"]),
              **pauschalen(sw_volumen=1000, sw_preis=0.015, grundpauschale=50)}),
    )

for laufzeit in (24, 36, 48, 60):
    hinzu(
        f"miete_{laufzeit}_mit_solutions",
        f"Miete Graphax {laufzeit} Monate mit Solutions",
        mit_solutions({**vertrag(MIETE, laufzeit), **hardware(*GERAETE["mittel"]),
                       **pauschalen(sw_volumen=2000, sw_preis=0.012, color_volumen=800,
                                    color_preis=0.075, grundpauschale=50, solutions_monatlich=35)}),
    )

for groesse in ("klein", "gross", "sehr_gross"):
    hinzu(
        f"miete_48_{groesse}",
        f"Miete Graphax 48 Monate, Geraetekonfiguration {groesse} (Faktorstufe pruefen)",
        fall({**vertrag(MIETE, 48), **hardware(*GERAETE[groesse]),
              **pauschalen(sw_volumen=1000, sw_preis=0.015, grundpauschale=50)}),
    )

hinzu(
    "miete_48_kam",
    "Miete 48 Monate mit KAM-Haken - Faktorstufe 'Ab 250000' unabhaengig vom Vertragswert",
    fall({**vertrag(MIETE, 48, kam=True), **hardware(*GERAETE["mittel"])}),
)
hinzu(
    "miete_12_verlaengerung",
    "Miete 12 Monate mit Verlaengerung/New - Sonderfall Hardware zum 12-Monats-Faktor",
    fall({**vertrag(MIETE, 12, verlaengerung=True), **hardware(*GERAETE["mittel"])}),
)
hinzu(
    "miete_24_amortisationsdauer",
    "Miete 24 Monate - Amortisationsdauer 24/0.95 statt 24",
    fall({**vertrag(MIETE, 24), **hardware(*GERAETE["mittel"])}),
)
hinzu(
    "miete_48_altvertrag",
    "Miete 48 Monate mit aufgerechnetem Restwert aus dem alten Vertrag",
    fall({**vertrag(MIETE, 48), **hardware(*GERAETE["mittel"]),
          **altvertrag(nicht_erfuellt=True, offene_raten=7, miete_pro_monat=280.0, aufrechnung=True)}),
)
hinzu(
    "miete_48_zusatzpositionen",
    "Miete 48 Monate mit Transport und Netzwerkintegration, verrechnet und finanziert",
    fall({**vertrag(MIETE, 48), **hardware(*GERAETE["mittel"]),
          **zusatz(transport=(0.0, 450.0), netzwerk=(320.0, 780.0))}),
)
hinzu(
    "miete_48_dl_teilweise_verrechnet",
    "Miete 48 Monate, Dienstleistungen teilweise direkt verrechnet",
    mit_solutions({**vertrag(MIETE, 48, dienstleistung_verrechnet=1500.0), **hardware(*GERAETE["mittel"])}),
)
hinzu(
    "miete_48_maintenance_in_pauschale",
    "Miete 48 Monate, Maintenance in der Servicepauschale",
    mit_solutions({**vertrag(MIETE, 48, maintenance_in_pauschale="Ja"), **hardware(*GERAETE["mittel"]),
                   **pauschalen(grundpauschale=50, solutions_monatlich=35)}),
)
hinzu(
    "miete_48_alle_volumen",
    "Miete 48 Monate mit s/w-, Color- und Scan-Volumen sowie allen Pauschalen",
    fall({**vertrag(MIETE, 48), **hardware(*GERAETE["mittel"]),
          "H56": 3000, "H57": 0.011, "H59": 0.013,
          "H61": 1200, "H62": 0.072, "H64": 0.079,
          "H66": 500, "H67": 0.008, "H69": 0.009,
          "M58": 50, "M59": 55, "M60": 18, "M61": 12, "M62": 9,
          "M64": 35, "M65": 12}),
)

# --- ZKB-Leasing -----------------------------------------------------------
for laufzeit in (24, 36, 48, 60):
    hinzu(
        f"leasing_{laufzeit}_monatlich",
        f"ZKB-Leasing {laufzeit} Monate, Fakturierung monatlich",
        fall({**vertrag(LEASING, laufzeit), **hardware(*GERAETE["mittel"]),
              **pauschalen(sw_volumen=1000, sw_preis=0.015, grundpauschale=50)}),
    )

hinzu(
    "leasing_48_quartalsweise",
    "ZKB-Leasing 48 Monate, Fakturierung quartalsweise (Faktor mal 3)",
    fall({**vertrag(LEASING, 48, fakt_leasing="Quartalsweise"), **hardware(*GERAETE["mittel"])}),
)
for groesse in ("klein", "gross", "sehr_gross"):
    hinzu(
        f"leasing_48_{groesse}",
        f"ZKB-Leasing 48 Monate, Geraetekonfiguration {groesse}",
        fall({**vertrag(LEASING, 48), **hardware(*GERAETE[groesse])}),
    )
hinzu(
    "leasing_48_mit_solutions",
    "ZKB-Leasing 48 Monate mit Solutions",
    mit_solutions({**vertrag(LEASING, 48), **hardware(*GERAETE["mittel"]),
                   **pauschalen(grundpauschale=50, solutions_monatlich=35)}),
)
hinzu(
    "leasing_unter_2000",
    "ZKB-Leasing mit Vertragswert unter 2000 - kein Faktor hinterlegt",
    fall({**vertrag(LEASING, 48), **hardware(1500.0)}),
)
hinzu(
    "leasing_laufzeit_72_ohne_faktor",
    "ZKB-Leasing 72 Monate - in der Leasingtabelle nicht hinterlegt",
    fall({**vertrag(LEASING, 72), **hardware(*GERAETE["mittel"])}),
)

# --- Spezialfaktoren -------------------------------------------------------
hinzu(
    "spezial_miete_48",
    "Spezial Miete 48 Monate mit frei gesetztem Faktor",
    fall({**vertrag(SPEZIAL_MIETE, 48, faktor_spezial_miete=0.0205), **hardware(*GERAETE["mittel"]),
          **pauschalen(grundpauschale=50)}),
)
hinzu(
    "spezial_miete_60_mit_solutions",
    "Spezial Miete 60 Monate mit Solutions und frei gesetztem Faktor",
    mit_solutions({**vertrag(SPEZIAL_MIETE, 60, faktor_spezial_miete=0.0172),
                   **hardware(*GERAETE["gross"]), **pauschalen(grundpauschale=50, solutions_monatlich=35)}),
)
hinzu(
    "spezial_leasing_48",
    "Spezial Leasing 48 Monate mit frei gesetztem Faktor",
    fall({**vertrag(SPEZIAL_LEASING, 48, faktor_spezial_leasing=0.0241),
          **hardware(*GERAETE["mittel"]), **pauschalen(grundpauschale=50)}),
)

# --- Support und Randfaelle ------------------------------------------------
hinzu(
    "kauf_mit_supportabzug",
    "Kauf mit Supportabzug: 3 Prozent auf die CIF-Summe plus 500 fix",
    fall({**vertrag(KAUF, 48), **hardware(*GERAETE["mittel"]), "B66": 0.03, "B67": 500.0}),
)
hinzu(
    "leer",
    "Alle Eingaben leer - Grundzustand der Vorlage",
    fall({**vertrag(MIETE, 48)}),
)

# --- Zeilen, die direkt auf dem Blatt Kalkulation erfasst werden -----------
hinzu(
    "miete_48_kalkulationszeilen",
    "Miete 48 Monate mit Solutions-Zeilen direkt auf dem Blatt Kalkulation "
    "(I28:I30 Software, I37 Maintenance, I46:I48 Dienstleistungen)",
    fall({
        **vertrag(MIETE, 48), **hardware(*GERAETE["mittel"]),
        "I28": 3200.0, "J28": 0.7,
        "I29": 890.0, "J29": 0.55,
        "I37": 1400.0, "J37": 0.7,
        "I46": 12.0, "J46": 195.0,
        "I47": 4.0, "J47": 240.0,
    }),
)
hinzu(
    "miete_48_software_rabatt",
    "Miete 48 Monate, Netto-Verkaufspreis einzelner Solutions-Zeilen "
    "von Hand unter den Listenpreis gesetzt",
    fall(
        {**vertrag(MIETE, 48), **hardware(*GERAETE["mittel"])},
        {**software((1, 4800.0), (25, 120.0)),
         **maintenance((1, 950.0)),
         "H21": 3840.0, "H22": 2700.0, "H43": 800.0},
    ),
)
hinzu(
    "miete_48_hardware_unter_support",
    "Miete 48 Monate mit Hardware-Zeilen unterhalb der Supportzeile "
    "(Zeilen 48 bis 52, ausserhalb der Support-Bemessungsgrundlage)",
    fall({
        **vertrag(MIETE, 48), **hardware(*GERAETE["mittel"]),
        "C48": 2400.0, "D48": 0.6,
        "C49": 1150.0, "D49": 0.45,
        "B66": 0.03, "B67": 250.0,
    }),
)

# --- Beispiel der Web-Maske ------------------------------------------------
# Muss Zeile fuer Zeile zu src/ui/beispiel.ts passen. Der Test
# tests/beispiel.test.ts prueft die Maskendaten gegen genau diese Fixture.
hinzu(
    "beispiel_maske",
    "Beispielkalkulation der Web-Maske: Miete 48 Monate, bizhub C360i mit "
    "Finisher, 5 Prozent Rabatt, Solutions, Transport und Pauschalen",
    fall(
        {
            **vertrag(MIETE, 48, rabatt=0.05),
            **hardware(13680.0, 4200.0),
            "A73": 0.0, "B73": 450.0,
            "A77": 320.0, "B77": 780.0,
            "H56": 3000, "H57": 0.011, "H59": 0.013,
            "H61": 1200, "H62": 0.072, "H64": 0.079,
            "M58": 50, "M59": 55, "M64": 35,
        },
        {
            **software((1, 4800.0), (25, 120.0)),
            **maintenance((1, 950.0)),
            **dienstleistungen((16, 185.0), (8, 210.0)),
        },
    ),
)
