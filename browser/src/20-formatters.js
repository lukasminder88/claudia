/* Formatter (Spezifikation V3, Abschnitt 7).

   Verbindlich inklusive Trennzeichen. Tausendertrenner ist das typografische
   Apostroph U+2019. Gerundet wird kaufmännisch (half-up) und erst bei der
   Ausgabe – Zwischensummen rechnen mit dem vollen Wert. */

const FMT = (() => {
  "use strict";

  const APOSTROPH = "’";

  /** Zahl aus Zelle, Text oder bereits formatiertem Betrag. */
  function zahl(wert) {
    if (wert === null || wert === undefined || wert === "") return 0;
    if (typeof wert === "number") return Number.isFinite(wert) ? wert : 0;
    if (typeof wert === "boolean") return wert ? 1 : 0;
    if (wert instanceof Date) return 0;
    const t = String(wert).replace(/CHF/g, "").replace(/[’' \s]/g, "").trim();
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : 0;
  }

  /**
   * Kaufmännisches Runden auf eine feste Stellenzahl.
   *
   * toFixed rundet auf der binären Näherung und liefert für 1.005 fälschlich
   * "1.00". Gerundet wird deshalb auf der kürzesten Dezimaldarstellung –
   * genau das, was Decimal(repr(x)).quantize(ROUND_HALF_UP) auf der
   * Python-Seite tut.
   */
  function festkomma(wert, stellen, gruppieren) {
    let n = zahl(wert);
    let s = String(n);
    if (s.includes("e") || s.includes("E")) s = n.toFixed(20);

    const negativ = s.startsWith("-");
    if (negativ) s = s.slice(1);

    let [ganz, bruch = ""] = s.split(".");

    if (bruch.length > stellen) {
      const naechste = bruch.charCodeAt(stellen) - 48;
      const ziffern = (ganz + bruch.slice(0, stellen)).split("");
      if (naechste >= 5) {
        let i = ziffern.length - 1;
        for (; i >= 0; i--) {
          if (ziffern[i] === "9") ziffern[i] = "0";
          else { ziffern[i] = String(Number(ziffern[i]) + 1); break; }
        }
        if (i < 0) ziffern.unshift("1");
      }
      const alle = ziffern.join("");
      ganz = stellen ? alle.slice(0, alle.length - stellen) || "0" : alle;
      bruch = stellen ? alle.slice(alle.length - stellen) : "";
    } else {
      bruch = bruch.padEnd(stellen, "0");
    }

    ganz = ganz.replace(/^0+(?=\d)/, "");
    if (gruppieren) ganz = ganz.replace(/\B(?=(\d{3})+(?!\d))/g, APOSTROPH);

    const ergebnis = stellen ? `${ganz}.${bruch}` : ganz;
    return negativ && /[1-9]/.test(ergebnis) ? "-" + ergebnis : ergebnis;
  }

  // --- Textformatter -----------------------------------------------------

  /** Leerraum aussen entfernen, innere Mehrfachleerzeichen auf eines reduzieren. */
  function trim(wert) {
    if (wert === null || wert === undefined) return "";
    if (wert instanceof Date) return dateDe(wert);
    if (typeof wert === "number" && Number.isInteger(wert)) wert = String(wert);
    return String(wert).replace(/\s+/g, " ").trim();
  }

  /** Erster Buchstabe klein (Formatter |klein aus Abschnitt 8.4). */
  function klein(wert) {
    const t = trim(wert);
    return t ? t[0].toLowerCase() + t.slice(1) : t;
  }

  // --- Zahlenformatter ---------------------------------------------------

  const chf = (w) => "CHF " + festkomma(w, 2, true);
  const rate = (w) => "CHF " + festkomma(w, 4, false);
  const intCh = (w) => festkomma(w, 0, true);
  const monate = (w) => intCh(w) + " Monate";

  /** TT.MM.JJJJ */
  function dateDe(wert) {
    if (!wert) return "";
    if (wert instanceof Date) {
      const t = String(wert.getUTCDate()).padStart(2, "0");
      const m = String(wert.getUTCMonth() + 1).padStart(2, "0");
      return `${t}.${m}.${wert.getUTCFullYear()}`;
    }
    const s = String(wert).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
  }

  // --- label_clean (Abschnitt 7.7) --------------------------------------

  /** "I n t e g r a t i o n - Netzwerk" -> "Integration Netzwerk" */
  function labelClean(wert) {
    let t = String(wert ?? "");
    t = t.replace(/\b(?:[\wÀ-ÿ]\s){2,}[\wÀ-ÿ]\b/g, (m) => m.replace(/\s/g, ""));
    t = t.replace(/ - /g, " ");
    t = t.replace(/\s+/g, " ").trim();
    return t ? t[0].toUpperCase() + t.slice(1) : t;
  }

  return { zahl, festkomma, trim, klein, chf, rate, intCh, monate, dateDe, labelClean, APOSTROPH };
})();
