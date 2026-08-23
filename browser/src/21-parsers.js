/* Parser für Freitextfelder (Abschnitt 6).

   Trifft kein Muster, greift der Fallback und es entsteht eine Warnung –
   nie eine stille Zuweisung. */

const PARSE = (() => {
  "use strict";

  const RE_PLZ_ORT = /^\s*(\d{4})\s+(.+?)\s*$/;
  const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
  const RE_TELEFON = /(?:\+41|0)[\s\d]{8,}/;
  const RE_DATUM = /(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/;

  /** "4127 Birsfelden" -> {plz, ort}; sonst W301. */
  function plzOrt(roh, warn, feld) {
    const text = (roh ?? "").toString().trim();
    const m = RE_PLZ_ORT.exec(text);
    if (!m) {
      warn.add("W301", feld ? `${feld}="${text}"` : `"${text}"`);
      return { plz: "", ort: text.replace(/\s+/g, " ") };
    }
    return { plz: m[1], ort: m[2].replace(/\s+/g, " ") };
  }

  /** Name, Mail und Telefon aus einem Freitextfeld trennen (Abschnitt 6.2). */
  function kontakt(roh, warn) {
    let text = (roh ?? "").toString();
    const ergebnis = { vorname: "", nachname: "", email: "", telefon: "" };

    const mMail = RE_EMAIL.exec(text);
    if (mMail) {
      ergebnis.email = mMail[0];
      text = text.slice(0, mMail.index) + "  " + text.slice(mMail.index + mMail[0].length);
    }
    const mTel = RE_TELEFON.exec(text);
    if (mTel) {
      ergebnis.telefon = mTel[0].replace(/\s+/g, " ").trim();
      text = text.slice(0, mTel.index) + "  " + text.slice(mTel.index + mTel[0].length);
    }
    if (!mMail || !mTel) {
      warn.add("W302", `email=${mMail ? "ja" : "nein"}, telefon=${mTel ? "ja" : "nein"}`);
    }

    const rest = text.replace(/\s+/g, " ").trim();
    if (rest) {
      const teile = rest.split(" ");
      ergebnis.vorname = teile[0];
      ergebnis.nachname = teile.slice(1).join(" ");
      if (teile.length > 2) warn.add("W303", rest);
    }
    return ergebnis;
  }

  /** "Vertragsbeginn 01.08.2026" -> Date; sonst null und W304. */
  function vertragsbeginn(roh, warn) {
    if (roh instanceof Date) return roh;
    const text = (roh ?? "").toString();
    const m = RE_DATUM.exec(text);
    if (!m) {
      warn.add("W304", `"${text.trim()}"`);
      return null;
    }
    let jahr = parseInt(m[3], 10);
    if (jahr < 100) jahr += 2000;
    const tag = parseInt(m[1], 10);
    const monat = parseInt(m[2], 10);
    if (monat < 1 || monat > 12 || tag < 1 || tag > 31) {
      warn.add("W304", `"${text.trim()}"`);
      return null;
    }
    return new Date(Date.UTC(jahr, monat - 1, tag));
  }

  /** "Premium - CHF 50.00" -> "Premium" (Abschnitt 8.2). */
  function slaKurz(roh) {
    const text = String(roh ?? "").replace(/\s+/g, " ").trim();
    return text.split(" - CHF")[0].replace(/^[\s-]+|[\s-]+$/g, "");
  }

  return { plzOrt, kontakt, vertragsbeginn, slaKurz };
})();
