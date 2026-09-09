/**
 * Regelwerk - alle Faktoren, die das Rechenergebnis beeinflussen.
 *
 * Quelle: spec/excel/Kalkulationstool_Vorlage_Q42025_rev1_D.xlsx,
 * Blaetter "Miete Graphax" (B8:H14) und "GE-Leasing" (B8:F14, B17:F23).
 *
 * Wird ein Faktor geaendert, entsteht eine neue Version mit eigenem
 * gueltigAb. Eine gespeicherte Offerte haelt fest, mit welcher Version sie
 * gerechnet wurde - alte Offerten aendern sich dadurch nie.
 */

export interface Faktortabelle {
  /** Untergrenzen des Vertragswerts, aufsteigend. */
  stufen: number[];
  /** Laufzeiten in Monaten, Spaltenreihenfolge der Faktormatrix. */
  laufzeiten: number[];
  /** faktoren[stufe][laufzeit]. null = in der Vorlage nicht hinterlegt. */
  faktoren: (number | null)[][];
}

export interface Regelwerk {
  version: string;
  gueltigAb: string;
  quelle: string;
  /**
   * Miete Graphax, Blatt "Miete Graphax" Zeilen 9-14.
   * Die Stufe "ab 2'000" gilt im Excel ab jedem Betrag: Zeile 15 faellt ohne
   * Treffer auf Zeile 9 zurueck. Die Untergrenze ist deshalb 0, nicht 2'000.
   */
  mieteGraphax: Faktortabelle;
  /** ZKB-Leasing monatlich, Blatt "GE-Leasing" Zeilen 18-23. */
  leasingMonatlich: Faktortabelle;
  /** ZKB-Leasing quartalsweise, Blatt "GE-Leasing" Zeilen 9-14. */
  leasingQuartalsweise: Faktortabelle;
  /** Kalkulation H83 - Anzeigefaktor beim Kauf. */
  kaufFaktor: number;
  /** Kalkulation D55 - Faktor der Marge "alt". */
  margeAltFaktor: number;
  /** Kalkulation H14 - Amortisationsdauer bei 12 Monaten Laufzeit. */
  amortisationsdauerBei12: number;
  /** Kalkulation H14 - Teiler der Amortisationsdauer bei 24 Monaten Laufzeit. */
  amortisationsteilerBei24: number;
}

const MIETE_LAUFZEITEN = [12, 24, 36, 48, 60, 72];

/** Blatt "Miete Graphax" C9:H14, Spaltenreihenfolge auf MIETE_LAUFZEITEN gedreht. */
const MIETE_FAKTOREN: (number | null)[][] = [
  // 12,   24,                    36,                    48,                    60,                    72
  [null, 0.04499959265162453, 0.03110621816065643, 0.023946244662442908, 0.019990462799663104, 0.0161],
  [null, 0.04454625143351099, 0.030740117113828926, 0.023668858652362693, 0.019706974220893663, 0.01606],
  [null, 0.044095656158136605, 0.030376647901819112, 0.023393442992278125, 0.01942593552802612, 0.01601],
  [null, 0.04364781155208344, 0.03001581551411288, 0.023120001443289972, 0.019147353285954433, 0.01597],
  [null, 0.04320272213574351, 0.029657624652128355, 0.022848537550567444, 0.018871233644010936, 0.01592],
  [null, 0.042760392221688225, 0.029302079726910808, 0.022579054641689984, 0.01859758233167177, 0.01587],
];

/** Blatt "GE-Leasing" C18:F23 - monatliche Faktoren. */
const LEASING_MONATLICH: number[][] = [
  [0.043217, 0.0297, 0.02295, 0.018906],
  [0.043217, 0.0297, 0.02295, 0.018906],
  [0.043217, 0.0297, 0.02295, 0.018906],
  [0.043217, 0.0297, 0.02295, 0.018906],
  [0.043095, 0.029574, 0.022819, 0.018775],
  [0.04315, 0.0296, 0.022850000000000002, 0.018799999999999997],
];

/**
 * Blatt "GE-Leasing" C9:F14 - quartalsweise Faktoren.
 * Die Zeilen 9-13 sind im Excel das Dreifache der monatlichen Zeilen 18-22.
 * Zeile 14 ist dort fest eingetragen und wird deshalb auch hier fest gefuehrt.
 */
const LEASING_QUARTALSWEISE: number[][] = [
  ...LEASING_MONATLICH.slice(0, 5).map((zeile) => zeile.map((faktor) => faktor * 3)),
  [0.12945, 0.0888, 0.06855, 0.0564],
];

export const REGELWERK: Regelwerk = {
  version: "Q4 2025 rev. 1",
  gueltigAb: "2026-09-09",
  quelle: "Kalkulationstool_Vorlage_Q42025_rev1_D.xlsx",
  mieteGraphax: {
    stufen: [0, 10000, 20000, 50000, 100000, 250000],
    laufzeiten: MIETE_LAUFZEITEN,
    faktoren: MIETE_FAKTOREN,
  },
  leasingMonatlich: {
    stufen: [2000, 10000, 20000, 30000, 50000, 100000],
    laufzeiten: [24, 36, 48, 60],
    faktoren: LEASING_MONATLICH,
  },
  leasingQuartalsweise: {
    stufen: [2000, 10000, 20000, 30000, 50000, 100000],
    laufzeiten: [24, 36, 48, 60],
    faktoren: LEASING_QUARTALSWEISE,
  },
  kaufFaktor: 0.025,
  margeAltFaktor: (1 / 1.08) * 1.23,
  amortisationsdauerBei12: 24,
  amortisationsteilerBei24: 0.95,
};
