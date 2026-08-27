/* Gerätedatenblätter beschaffen und in die Offerte einsetzen.

   Zwei Wege, je nachdem, wo die Seite läuft:

   * von einem Server geladen – dann liegt neben der Seite ein Verzeichnis
     `datenblaetter/` mit einer `index.json`, und geholt wird nur das eine
     gebrauchte Datenblatt statt aller;
   * als Datei geöffnet oder ohne Netz – dann zieht man das Datenblatt von
     Hand hinein, wie das Kalktool.

   Zugeordnet wird über den Modellnamen. Passt nichts oder mehreres, entsteht
   eine Warnung – geraten wird nicht. */

const DATENBLAETTER = (() => {
  "use strict";

  const VERZEICHNIS = "datenblaetter/";
  const INDEX = VERZEICHNIS + "index.json";

  // Überschriften heissen in den Datenblättern anders als in der
  // Offertvorlage; ohne Zuordnung fände das Inhaltsverzeichnis das Kapitel nicht.
  const STIL_ABBILDUNG = {
    berschrift1: "Heading1",
    berschrift2: "Heading2",
    berschrift3: "Heading3",
    berschrift4: "Heading4",
  };

  const STIL_SPEZIFIKATION = "Fliesstext10ptSpezifikationGerte";

  /** Modellnamen vergleichbar machen: ohne Sprachkürzel, Version, Trennzeichen. */
  function normalisieren(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\b(de|fr|it|en)\b/g, " ")
      .replace(/\bv\d+\b/g, " ")
      .replace(/[^a-z0-9]+/g, "");
  }

  /** Von Hand hinzugefügte Datenblätter: Dateiname -> File. */
  let eigene = [];

  const setzeEigene = (dateien) => { eigene = [...dateien]; };
  const anzahlEigene = () => eigene.length;

  let serverIndex = null;   // null = noch nicht gefragt, [] = keine vorhanden

  /**
   * Verzeichnis der Datenblätter auf dem Server.
   * Fehlt es oder läuft die Seite als Datei, bleibt die Liste leer.
   */
  async function serverListe() {
    if (serverIndex !== null) return serverIndex;
    serverIndex = [];
    if (location.protocol !== "http:" && location.protocol !== "https:") {
      return serverIndex;
    }
    try {
      const antwort = await fetch(INDEX, { cache: "no-cache" });
      if (!antwort.ok) return serverIndex;
      const daten = await antwort.json();
      if (Array.isArray(daten && daten.datenblaetter)) {
        serverIndex = daten.datenblaetter.map((e) => ({
          modell: e.modell,
          datei: e.datei,
          schluessel: normalisieren(e.modell),
        }));
      }
    } catch {
      // Kein Verzeichnis, kein Netz – die Offerte entsteht ohne das Kapitel.
    }
    return serverIndex;
  }

  const verfuegbar = async () => (await serverListe()).length + eigene.length;

  /** Alle bekannten Quellen als einheitliche Liste. */
  async function alle() {
    const aus = (await serverListe()).map((e) => ({ ...e, herkunft: "server" }));
    for (const datei of eigene) {
      const modell = datei.name.replace(/\.(dotx|docx|dotm|docm)$/i, "");
      aus.push({ modell, datei, schluessel: normalisieren(modell), herkunft: "datei" });
    }
    return aus;
  }

  /** Das Datenblatt zu einer Gerätebezeichnung; sonst null und eine Warnung. */
  async function finde(bezeichnung, warn) {
    const gesucht = normalisieren(bezeichnung);
    if (!gesucht) return null;
    const liste = await alle();

    const genau = liste.filter((e) => e.schluessel === gesucht);
    const treffer = genau.length ? genau : liste.filter((e) => e.schluessel.includes(gesucht));

    if (treffer.length === 1) return treffer[0];
    if (treffer.length > 1) {
      warn.add("W330", `${bezeichnung}: ${treffer.map((t) => t.modell).join(", ")}`);
      return null;
    }
    if (liste.length) warn.add("W331", bezeichnung);
    return null;
  }

  async function puffer(eintrag) {
    if (eintrag.herkunft === "datei") return eintrag.datei.arrayBuffer();
    const antwort = await fetch(VERZEICHNIS + eintrag.datei, { cache: "no-cache" });
    if (!antwort.ok) throw new OfferteError("E201", `${eintrag.datei} nicht erreichbar`);
    return antwort.arrayBuffer();
  }

  const absatzStil = (el) => {
    if (el.localName === "tbl") {
      const pr = DOCX.ersteKind(el, "tblPr");
      const s = pr && DOCX.ersteKind(pr, "tblStyle");
      return s ? DOCX.attr(s, "w:val") : "";
    }
    const ppr = DOCX.ersteKind(el, "pPr");
    const s = ppr && DOCX.ersteKind(ppr, "pStyle");
    return s ? DOCX.attr(s, "w:val") : "Normal";
  };

  /**
   * Blockelemente ab der Modellüberschrift.
   * Überschrift 1 und 2 setzt der Renderer einmal für alle Geräte.
   */
  function bloecke(quelle, mitSpezifikation) {
    const body = quelle.document.getElementsByTagNameNS(W_NS, "body")[0];
    const aus = [];
    let begonnen = false;
    for (const kind of body.children) {
      if (kind.localName !== "p" && kind.localName !== "tbl") continue;
      const stil = absatzStil(kind);
      if (!begonnen) {
        if (kind.localName === "p" && (stil === "berschrift3" || stil === "Heading3")) {
          begonnen = true;
        } else {
          continue;
        }
      }
      if (!mitSpezifikation && stil === STIL_SPEZIFIKATION) continue;
      aus.push(kind);
    }
    return aus;
  }

  /**
   * Je angebotenem Gerät ein Datenblatt, ohne Wiederholungen.
   * Gesucht wird zum Gerät, nicht zum Zubehör.
   */
  async function fuerStandorte(standorte, warn) {
    const aus = [];
    const gesehen = new Set();
    for (const { ctx, d } of standorte) {
      warn.standort = ctx.index;
      if (!d.geraet) continue;
      const eintrag = await finde(d.geraet, warn);
      if (!eintrag) continue;
      const kennung = eintrag.herkunft + ":" + eintrag.modell;
      if (gesehen.has(kennung)) continue;
      gesehen.add(kennung);
      aus.push({ ...eintrag, kennung });
    }
    warn.standort = null;
    return aus;
  }

  return {
    normalisieren, setzeEigene, anzahlEigene, verfuegbar, alle, finde,
    puffer, bloecke, fuerStandorte,
    STIL_ABBILDUNG, VERZEICHNIS,
  };
})();
