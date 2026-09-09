/**
 * Uebersetzt die Eingabezellen einer Fixture in eine Engine-Eingabe.
 *
 * Grundlage ist spec/vorlage-defaults.json - die Werte, die in der leeren
 * Vorlage stehen. Die Fixture ueberschreibt davon nur, was ihr Fall setzt.
 * So rechnet die Engine mit genau denselben Zahlen wie das Excel.
 */

import vorgaben from "../spec/vorlage-defaults.json" with { type: "json" };
import type {
  DienstleistungsPosition,
  DienstleistungsZusatzZeile,
  Eingabe,
  FaktLeasing,
  HardwarePosition,
  SolutionsPosition,
  SolutionsZusatzZeile,
  Vertragsart,
  ZusatzPosition,
} from "../src/engine";

export type Zellwert = number | string | boolean | null;
export type Eingabezellen = Record<string, Record<string, Zellwert>>;

type Blatt = "Kalkulation" | "Detail Solutions";

class Zellen {
  private readonly werte: Record<Blatt, Record<string, Zellwert>>;

  constructor(fixtureZellen: Eingabezellen) {
    this.werte = {
      Kalkulation: { ...vorgaben.Kalkulation, ...(fixtureZellen["Kalkulation"] ?? {}) },
      "Detail Solutions": {
        ...vorgaben["Detail Solutions"],
        ...(fixtureZellen["Detail Solutions"] ?? {}),
      },
    };
  }

  roh(blatt: Blatt, adresse: string): Zellwert {
    return this.werte[blatt][adresse] ?? null;
  }

  /** Zahl der Zelle; eine leere Zelle ist im Excel in jeder Rechnung 0. */
  zahl(blatt: Blatt, adresse: string, vorgabe = 0): number {
    const wert = this.roh(blatt, adresse);
    return typeof wert === "number" ? wert : vorgabe;
  }

  /** Zahl oder null, wenn die Zelle die Formel der Vorlage behaelt. */
  zahlOderNull(blatt: Blatt, adresse: string): number | null {
    const wert = this.roh(blatt, adresse);
    return typeof wert === "number" ? wert : null;
  }

  wahrheit(blatt: Blatt, adresse: string): boolean {
    return this.roh(blatt, adresse) === true;
  }

  text(blatt: Blatt, adresse: string, vorgabe: string): string {
    const wert = this.roh(blatt, adresse);
    return typeof wert === "string" ? wert : vorgabe;
  }
}

function zeilen(von: number, bis: number): number[] {
  return Array.from({ length: bis - von + 1 }, (_, i) => von + i);
}

function hardwareZeilen(zellen: Zellen, von: number, bis: number): HardwarePosition[] {
  return zeilen(von, bis).map((zeile) => ({
    bezeichnung: zellen.text("Kalkulation", `B${zeile}`, ""),
    listenpreis: zellen.zahl("Kalkulation", `C${zeile}`),
    kalkulationsart: zellen.zahl("Kalkulation", `D${zeile}`),
  }));
}

function solutionsZeilen(zellen: Zellen, von: number, bis: number): SolutionsPosition[] {
  return zeilen(von, bis).map((zeile) => ({
    anzahl: zellen.zahl("Detail Solutions", `A${zeile}`),
    artikelNr: zellen.text("Detail Solutions", `B${zeile}`, ""),
    bezeichnung: zellen.text("Detail Solutions", `C${zeile}`, ""),
    listenpreisProArtikel: zellen.zahl("Detail Solutions", `D${zeile}`),
    kalkulationsart: zellen.zahl("Detail Solutions", `F${zeile}`),
    nettoPreis: zellen.zahlOderNull("Detail Solutions", `H${zeile}`),
    functionCode: zellen.text("Detail Solutions", `J${zeile}`, ""),
  }));
}

function dienstleistungsZeilen(zellen: Zellen): DienstleistungsPosition[] {
  return zeilen(61, 70).map((zeile) => ({
    stunden: zellen.zahl("Detail Solutions", `A${zeile}`),
    artikelNr: zellen.text("Detail Solutions", `B${zeile}`, ""),
    bezeichnung: zellen.text("Detail Solutions", `C${zeile}`, ""),
    preisProStunde: zellen.zahl("Detail Solutions", `G${zeile}`),
  }));
}

function solutionsZusatz(zellen: Zellen, von: number, bis: number): SolutionsZusatzZeile[] {
  return zeilen(von, bis).map((zeile) => ({
    bezeichnung: zellen.text("Kalkulation", `G${zeile}`, ""),
    listenpreis: zellen.zahl("Kalkulation", `I${zeile}`),
    kalkulationsart: zellen.zahl("Kalkulation", `J${zeile}`),
    nettoVerkaufspreis: zellen.zahlOderNull("Kalkulation", `L${zeile}`),
  }));
}

function dienstleistungsZusatz(zellen: Zellen): DienstleistungsZusatzZeile[] {
  return zeilen(46, 48).map((zeile) => ({
    bezeichnung: zellen.text("Kalkulation", `G${zeile}`, ""),
    stunden: zellen.zahl("Kalkulation", `I${zeile}`),
    preisProStunde: zellen.zahl("Kalkulation", `J${zeile}`),
  }));
}

/** Transport, Integration und weitere Positionen - Zeilen 73 bis 93. */
const ZUSATZZEILEN = [73, 75, 77, 79, 81, 84, 87, 90, 93];

function zusatzpositionen(zellen: Zellen): ZusatzPosition[] {
  return ZUSATZZEILEN.map((zeile) => ({
    bezeichnung: `Zeile ${zeile}`,
    verrechnet: zellen.zahl("Kalkulation", `A${zeile}`),
    finanziert: zellen.zahl("Kalkulation", `B${zeile}`),
  }));
}

export function eingabeAusZellen(fixtureZellen: Eingabezellen): Eingabe {
  const z = new Zellen(fixtureZellen);
  return {
    vertrag: {
      art: z.zahl("Kalkulation", "I16", 2) as Vertragsart,
      laufzeitMonate: z.zahl("Kalkulation", "J16", 48),
      kam: z.wahrheit("Kalkulation", "B17"),
      verlaengerungNew: z.wahrheit("Kalkulation", "C14"),
      faktLeasing: z.text("Kalkulation", "I15", "Monatlich") as FaktLeasing,
      faktorSpezialMiete: z.zahl("Kalkulation", "G16"),
      faktorSpezialLeasing: z.zahl("Kalkulation", "H16"),
    },
    hardware: {
      positionen: hardwareZeilen(z, 27, 46),
      positionenNachSupport: hardwareZeilen(z, 48, 52),
      rabattsatz: z.zahl("Kalkulation", "E21"),
      supportSatz: z.zahl("Kalkulation", "B66"),
      supportPauschale: z.zahl("Kalkulation", "B67"),
      supportKalkulationsart: z.zahl("Kalkulation", "D27"),
    },
    solutions: {
      software: solutionsZeilen(z, 21, 38),
      maintenance: solutionsZeilen(z, 43, 56),
      dienstleistungen: dienstleistungsZeilen(z),
      softwareZusatz: solutionsZusatz(z, 28, 30),
      maintenanceZusatz: solutionsZusatz(z, 37, 37),
      dienstleistungenZusatz: dienstleistungsZusatz(z),
      maintenanceInServicepauschale: z.text("Kalkulation", "I40", "Nein") === "Ja",
      dienstleistungVerrechnet: z.zahl("Kalkulation", "J51"),
    },
    altvertrag: {
      vertragNichtErfuellt: z.wahrheit("Kalkulation", "D21"),
      offeneMietraten: z.zahl("Kalkulation", "J19"),
      mieteProMonat: z.zahl("Kalkulation", "J21"),
      faktor: z.zahl("Kalkulation", "M19", 1),
      aufrechnung: z.wahrheit("Kalkulation", "L23"),
    },
    zusatzpositionen: zusatzpositionen(z),
    volumen: {
      swSeiten: z.zahl("Kalkulation", "H56"),
      swPreis: z.zahl("Kalkulation", "H57"),
      swMehrseitenpreis: z.zahl("Kalkulation", "H59"),
      colorSeiten: z.zahl("Kalkulation", "H61"),
      colorPreis: z.zahl("Kalkulation", "H62"),
      colorMehrseitenpreis: z.zahl("Kalkulation", "H64"),
      scanSeiten: z.zahl("Kalkulation", "H66"),
      scanPreis: z.zahl("Kalkulation", "H67"),
      mehrscanpreis: z.zahl("Kalkulation", "H69"),
    },
    pauschalen: {
      sla: z.zahl("Kalkulation", "M58"),
      grundpauschale: z.zahl("Kalkulation", "M59"),
      wartungController: z.zahl("Kalkulation", "M60"),
      wartungMuenzer: z.zahl("Kalkulation", "M61"),
      bizhubSecure: z.zahl("Kalkulation", "M62"),
      solutions: zeilen(64, 69).map((zeile) => z.zahl("Kalkulation", `M${zeile}`)),
    },
  };
}
