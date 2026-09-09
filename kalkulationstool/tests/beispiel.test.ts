/**
 * Die Beispieldaten der Maske muessen dieselben Zahlen liefern wie das Excel.
 *
 * Damit ist nicht nur die Engine geprueft, sondern auch das, was ein Verkaeufer
 * beim ersten Klick auf "Beispiel laden" zu sehen bekommt.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { berechnen } from "../src/engine";
import { beispielEingabe } from "../src/ui/beispiel";

const fixture = JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "spec", "fixtures", "beispiel_maske.json"), "utf-8"),
) as { erwartet: Record<string, number | string | null> };

function wertNachPfad(objekt: unknown, pfad: string): unknown {
  return pfad.split(".").reduce<unknown>((aktuell, teil) => {
    if (aktuell === null || typeof aktuell !== "object") return undefined;
    return (aktuell as Record<string, unknown>)[teil];
  }, objekt);
}

describe("Beispiel der Web-Maske", () => {
  it("rechnet auf den Rappen wie das Excel", () => {
    const ergebnis = berechnen(beispielEingabe("de"));
    const abweichungen: string[] = [];

    for (const [pfad, erwartet] of Object.entries(fixture.erwartet)) {
      if (typeof erwartet !== "number") continue;
      const ist = wertNachPfad(ergebnis, pfad);
      if (typeof ist !== "number" || Math.abs(ist - erwartet) > Math.max(1e-6, Math.abs(erwartet) * 1e-9)) {
        abweichungen.push(`${pfad}: Excel ${erwartet}, Engine ${String(ist)}`);
      }
    }

    expect(abweichungen, abweichungen.join("\n")).toEqual([]);
  });

  it("liefert die franzoesische Fassung mit denselben Zahlen", () => {
    const de = berechnen(beispielEingabe("de"));
    const fr = berechnen(beispielEingabe("fr"));
    expect(fr.total.vertragswert).toBe(de.total.vertragswert);
    expect(fr.ergebnis.monatspauschaleTotal).toBe(de.ergebnis.monatspauschaleTotal);
  });
});
