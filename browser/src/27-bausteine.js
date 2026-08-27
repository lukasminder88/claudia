/* Textbausteine zur Laufzeit (Abschnitt 8).

   Grundlage sind die mitgelieferten Bausteine; eigene Fassungen werden im
   Browser gespeichert und liegen darüber. Jeder Baustein wird gegen seine
   erlaubten Platzhalter geprüft – ein Tippfehler bricht mit einer klaren
   Meldung ab, statt ein kaputtes Dokument zu schreiben. */

const BAUSTEINE = (() => {
  "use strict";

  const SPEICHER = "offerttool.bausteine.v1";
  // {feld} – doppelte Klammern {{ }} sind ein Zeichen, kein Platzhalter.
  const RE = /(?<!\{)\{([a-z_][a-z0-9_]*)\}(?!\})/g;

  /** Eigene Texte aus dem Browserspeicher; fehlerhafte werden verworfen. */
  function eigeneLesen() {
    try {
      const roh = localStorage.getItem(SPEICHER);
      const daten = roh ? JSON.parse(roh) : {};
      return daten && typeof daten === "object" ? daten : {};
    } catch {
      return {};
    }
  }

  function eigeneSchreiben(eigene) {
    try {
      if (Object.keys(eigene).length) {
        localStorage.setItem(SPEICHER, JSON.stringify(eigene));
      } else {
        localStorage.removeItem(SPEICHER);
      }
      return true;
    } catch {
      // Privates Fenster oder gesperrter Speicher: die Änderungen gelten
      // dann nur für diese Sitzung.
      return false;
    }
  }

  let eigene = eigeneLesen();

  const standard = (schluessel) => BAUSTEINE_STANDARD.bausteine[schluessel];

  /** Absätze eines Bausteins: eigene Fassung, sonst die mitgelieferte. */
  function absaetzeVon(schluessel) {
    const s = standard(schluessel);
    if (!s) throw new OfferteError("E802", `Unbekannter Textbaustein: ${schluessel}`);
    const wert = eigene[schluessel];
    if (wert !== undefined) return Array.isArray(wert) ? wert : [String(wert)];
    return s.absaetze ? s.absaetze : [s.text];
  }

  const istMehrzeilig = (schluessel) => Boolean(standard(schluessel).absaetze);

  const erlaubte = (schluessel) => standard(schluessel).platzhalter || [];

  /** Fehlermeldung, wenn ein Baustein einen unzulässigen Platzhalter nutzt. */
  function pruefeText(schluessel, absaetze) {
    const s = standard(schluessel);
    const erlaubt = new Set(erlaubte(schluessel));
    const liste = erlaubt.size
      ? [...erlaubt].map((p) => "{" + p + "}").join(", ")
      : "keine";

    for (const absatz of absaetze) {
      RE.lastIndex = 0;
      let treffer;
      while ((treffer = RE.exec(absatz)) !== null) {
        const name = treffer[1];
        if (erlaubt.has(name)) continue;
        const bekannt = name in BAUSTEINE_STANDARD.platzhalter;
        return bekannt
          ? `{${name}} ist in diesem Baustein nicht vorgesehen. Erlaubt: ${liste}`
          : `{${name}} gibt es nicht. Erlaubt: ${liste}`;
      }
      const ohne = absatz.replace(RE, "").split("{{").join("").split("}}").join("");
      if (ohne.includes("{") || ohne.includes("}")) {
        return "Eine geschweifte Klammer steht allein. Als Zeichen bitte {{ oder }} schreiben.";
      }
    }
    return null;
  }

  function fuellen(schluessel, vorlage, werte) {
    RE.lastIndex = 0;
    return vorlage
      .replace(RE, (_, name) => String(werte[name] ?? ""))
      .split("{{").join("{")
      .split("}}").join("}");
  }

  return {
    /** Einzeiligen Baustein füllen. */
    text(schluessel, werte) {
      return fuellen(schluessel, absaetzeVon(schluessel)[0], werte || {});
    },

    /** Mehrzeiligen Baustein füllen. */
    absaetze(schluessel, werte) {
      return absaetzeVon(schluessel).map((a) => fuellen(schluessel, a, werte || {}));
    },

    // -- Für den Editor -------------------------------------------------

    katalog: BAUSTEINE_STANDARD,
    istMehrzeilig,
    erlaubte,
    pruefeText,
    rohtext: absaetzeVon,

    /** Wurde dieser Baustein geändert? */
    geaendert: (schluessel) => eigene[schluessel] !== undefined,

    /** Gibt es überhaupt eigene Texte? */
    anzahlGeaendert: () => Object.keys(eigene).length,

    /** Eigenen Text setzen; null stellt den mitgelieferten wieder her. */
    setzen(schluessel, absaetze) {
      if (!standard(schluessel)) {
        throw new OfferteError("E802", `Unbekannter Textbaustein: ${schluessel}`);
      }
      if (absaetze === null) {
        delete eigene[schluessel];
      } else {
        const liste = Array.isArray(absaetze) ? absaetze : [String(absaetze)];
        const fehler = pruefeText(schluessel, liste);
        if (fehler) throw new OfferteError("E801", fehler);
        eigene[schluessel] = istMehrzeilig(schluessel) ? liste : liste[0];
      }
      return eigeneSchreiben(eigene);
    },

    /** Alle eigenen Texte verwerfen. */
    zuruecksetzen() {
      eigene = {};
      return eigeneSchreiben(eigene);
    },

    /** Eigene Texte zum Sichern. */
    exportieren: () => JSON.parse(JSON.stringify(eigene)),

    /** Gesicherte Texte laden; prüft jeden Eintrag. */
    importieren(daten) {
      if (!daten || typeof daten !== "object") {
        throw new OfferteError("E801", "Die Datei enthält keine Textbausteine.");
      }
      const neu = {};
      for (const [schluessel, wert] of Object.entries(daten)) {
        if (!standard(schluessel)) {
          throw new OfferteError("E802", `Unbekannter Textbaustein: ${schluessel}`);
        }
        const liste = Array.isArray(wert) ? wert.map(String) : [String(wert)];
        const fehler = pruefeText(schluessel, liste);
        if (fehler) {
          throw new OfferteError("E801", `${standard(schluessel).titel}: ${fehler}`);
        }
        neu[schluessel] = istMehrzeilig(schluessel) ? liste : liste[0];
      }
      eigene = neu;
      eigeneSchreiben(eigene);
      return Object.keys(neu).length;
    },
  };
})();
