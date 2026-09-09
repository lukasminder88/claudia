/** Rechenhilfen, die sich genau wie Excel verhalten. */

/**
 * ROUND wie in Excel: kaufmaennisch, bei .5 vom Nullpunkt weg.
 * Math.round rundet bei negativen Zahlen zur Null hin und weicht deshalb ab.
 */
export function excelRunden(wert: number, stellen: number): number {
  const faktor = 10 ** stellen;
  const skaliert = wert * faktor;
  const gerundet = skaliert < 0 ? -Math.round(-skaliert) : Math.round(skaliert);
  return gerundet / faktor;
}

/**
 * Rundung auf 5 Rappen - im Excel durchgaengig ROUND(x*20,0)/20.
 * Gilt fuer jeden Betrag, der als Rate oder Pauschale nach aussen geht.
 */
export function aufFuenfRappen(wert: number): number {
  return excelRunden(wert * 20, 0) / 20;
}

/** Summe in fester Reihenfolge - die Reihenfolge entspricht dem Excel-Bereich. */
export function summe(werte: number[]): number {
  let ergebnis = 0;
  for (const wert of werte) ergebnis += wert;
  return ergebnis;
}

/**
 * Division mit IFERROR wie im Excel: Teilen durch null ergibt dort "" und
 * hier null. Ein NaN- oder Infinity-Ergebnis wird ebenso zu null.
 */
export function teile(zaehler: number, nenner: number): number | null {
  if (nenner === 0) return null;
  const ergebnis = zaehler / nenner;
  return Number.isFinite(ergebnis) ? ergebnis : null;
}

/**
 * 1 - a/b mit IFERROR wie im Excel. Nenner null ergibt dort "" und hier null.
 * Kommt in der Vorlage als Rabatt- und Margenformel mehrfach vor.
 */
export function einsMinusQuotient(zaehler: number, nenner: number): number | null {
  const quotient = teile(zaehler, nenner);
  return quotient === null ? null : 1 - quotient;
}
