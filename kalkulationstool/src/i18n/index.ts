/**
 * Sprachen der Oberflaeche.
 *
 * Regel aus dem Vorgehen: kein deutscher oder franzoesischer Text im Code.
 * Alles laeuft ueber t() und die Woerterbuecher; Dropdown-Werte kommen aus
 * listen.*.json und damit aus dem Blatt "Listen" des Excel.
 */

import de from "./de.json";
import fr from "./fr.json";
import listenDe from "./listen.de.json";
import listenFr from "./listen.fr.json";

export const SPRACHEN = ["de", "fr"] as const;
export type Sprache = (typeof SPRACHEN)[number];

type Woerterbuch = Record<string, string>;

const WOERTERBUECHER: Record<Sprache, Woerterbuch> = { de, fr };

/** Listen der Vorlage. Quelle ist immer die deutsche Fassung. */
export type Listenname = keyof typeof listenDe;

const LISTEN_UEBERSETZT = listenFr as Record<string, unknown>;

/**
 * Text zum Schluessel. Fehlt er, kommt der Schluessel selbst zurueck - so
 * faellt eine Luecke in der Maske auf, statt still zu verschwinden.
 */
export function t(sprache: Sprache, schluessel: string): string {
  return WOERTERBUECHER[sprache][schluessel] ?? schluessel;
}

/**
 * Eintraege einer Liste in der gewaehlten Sprache. Die Werte selbst - also
 * das, womit gerechnet und was gespeichert wird - bleiben immer die deutschen
 * aus dem Excel. Uebersetzt wird nur die Anzeige.
 */
export function liste(sprache: Sprache, name: Listenname): { wert: string | number; text: string }[] {
  const werte = listenDe[name] as (string | number)[];
  const uebersetzt = LISTEN_UEBERSETZT[name];
  const texte = Array.isArray(uebersetzt) ? (uebersetzt as string[]) : null;
  return werte.map((wert, index) => ({
    wert,
    text: sprache === "de" || texte === null ? String(wert) : (texte[index] ?? String(wert)),
  }));
}

/** Zahlformat der Schweiz: 1'234.50. */
export function formatBetrag(wert: number | null, sprache: Sprache, nachkommastellen = 2): string {
  if (wert === null || !Number.isFinite(wert)) return "–";
  return new Intl.NumberFormat(sprache === "fr" ? "fr-CH" : "de-CH", {
    minimumFractionDigits: nachkommastellen,
    maximumFractionDigits: nachkommastellen,
  }).format(wert);
}

export function formatProzent(wert: number | null, sprache: Sprache, nachkommastellen = 2): string {
  if (wert === null || !Number.isFinite(wert)) return "–";
  return new Intl.NumberFormat(sprache === "fr" ? "fr-CH" : "de-CH", {
    style: "percent",
    minimumFractionDigits: nachkommastellen,
    maximumFractionDigits: nachkommastellen,
  }).format(wert);
}
