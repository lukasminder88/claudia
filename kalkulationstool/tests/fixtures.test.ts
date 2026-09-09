/**
 * Abnahme der Engine: jede Fixture aus spec/fixtures muss auf den Rappen
 * genau herauskommen.
 *
 * Die erwarteten Zahlen stammen aus dem Excel (scripts/extract_fixtures.py).
 * Weicht ein Wert ab, ist die Engine falsch - nie die Fixture.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { berechnen } from "../src/engine";
import { eingabeAusZellen, type Eingabezellen } from "./fixtureEingabe";

interface Fixture {
  name: string;
  beschreibung: string;
  quelle: string;
  eingabezellen: Eingabezellen;
  erwartet: Record<string, number | string | null>;
}

const FIXTURE_ORDNER = join(import.meta.dirname, "..", "spec", "fixtures");

const fixtures: Fixture[] = readdirSync(FIXTURE_ORDNER)
  .filter((datei) => datei.endsWith(".json"))
  .sort()
  .map((datei) => JSON.parse(readFileSync(join(FIXTURE_ORDNER, datei), "utf-8")) as Fixture);

/** Wert entlang eines Pfads wie "solutions.software.marge" holen. */
function wertNachPfad(objekt: unknown, pfad: string): unknown {
  return pfad.split(".").reduce<unknown>((aktuell, teil) => {
    if (aktuell === null || typeof aktuell !== "object") return undefined;
    return (aktuell as Record<string, unknown>)[teil];
  }, objekt);
}

/**
 * Toleranz: absolut ein Zehntausendstel Rappen, relativ 1e-9. Die Fixtures
 * tragen die Zahlen mit 15 signifikanten Stellen, wie LibreOffice sie
 * exportiert - darunter liegt kein fachlicher Unterschied.
 */
function gleich(ist: number, soll: number): boolean {
  return Math.abs(ist - soll) <= Math.max(1e-6, Math.abs(soll) * 1e-9);
}

describe("Engine gegen die Fixtures aus dem Excel", () => {
  it("findet Fixtures", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(40);
  });

  for (const fixture of fixtures) {
    it(`${fixture.name}: ${fixture.beschreibung}`, () => {
      const ergebnis = berechnen(eingabeAusZellen(fixture.eingabezellen));
      const abweichungen: string[] = [];

      for (const [pfad, erwartet] of Object.entries(fixture.erwartet)) {
        const ist = wertNachPfad(ergebnis, pfad);

        if (typeof erwartet === "string") {
          // Das Excel meldet hier einen Fehler (#VALUE!), weil kein Faktor
          // hinterlegt ist. Die Engine gibt dafuer null zurueck.
          if (ist !== null) abweichungen.push(`${pfad}: Excel ${erwartet}, Engine ${String(ist)}`);
          continue;
        }
        if (erwartet === null) {
          if (ist !== null) abweichungen.push(`${pfad}: Excel leer, Engine ${String(ist)}`);
          continue;
        }
        if (typeof ist !== "number" || !gleich(ist, erwartet)) {
          abweichungen.push(`${pfad}: Excel ${erwartet}, Engine ${String(ist)}`);
        }
      }

      expect(abweichungen, abweichungen.join("\n")).toEqual([]);
    });
  }
});
