/* Kalktool lesen.

   Gebraucht werden nur Zellwerte zweier Blätter, deshalb ein eigener,
   knapper Leser statt einer grossen Fremdbibliothek. Gelesen werden die
   zwischengespeicherten Ergebnisse der Formeln (<v>), nie die Formel selbst –
   das entspricht data_only=True auf der Python-Seite. */

const XLSX = (() => {
  "use strict";

  const parser = new DOMParser();

  function xml(dateien, name) {
    return parser.parseFromString(ZIP.text(dateien, name), "application/xml");
  }

  /** "BC12" -> {spalte: 55, zeile: 12} */
  function adresse(a1) {
    const m = /^([A-Z]+)(\d+)$/.exec(a1);
    if (!m) return null;
    let spalte = 0;
    for (const z of m[1]) spalte = spalte * 26 + (z.charCodeAt(0) - 64);
    return { spalte, zeile: parseInt(m[2], 10) };
  }

  function spaltenName(n) {
    let s = "";
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  // Excel zählt Tage ab 1899-12-30 (mit dem bekannten 1900-Schaltjahrfehler).
  const EPOCHE = Date.UTC(1899, 11, 30);

  function alsDatum(zahl) {
    return new Date(EPOCHE + Math.round(zahl) * 86400000);
  }

  /** Formatcodes, die ein Datum bedeuten. */
  function istDatumsformat(code) {
    if (!code) return false;
    const ohneText = code.replace(/\[[^\]]*\]/g, "").replace(/"[^"]*"/g, "");
    return /[dmyhs]/i.test(ohneText) && /[dmy]/i.test(ohneText);
  }

  const EINGEBAUTE_DATUMSFORMATE = new Set([
    14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57,
  ]);

  /**
   * Öffnet ein Kalktool.
   * Blätter werden nach Position angesprochen; der Name dient nur der Prüfung.
   */
  async function oeffnen(puffer) {
    const dateien = await ZIP.lesen(puffer);

    // Gemeinsame Zeichenketten
    let texte = [];
    if (dateien.has("xl/sharedStrings.xml")) {
      const d = xml(dateien, "xl/sharedStrings.xml");
      texte = [...d.getElementsByTagName("si")].map((si) =>
        [...si.getElementsByTagName("t")].map((t) => t.textContent).join("")
      );
    }

    // Zahlenformate, um Datumszellen zu erkennen
    const datumsStil = new Set();
    if (dateien.has("xl/styles.xml")) {
      const d = xml(dateien, "xl/styles.xml");
      const eigene = new Map();
      for (const f of d.getElementsByTagName("numFmt")) {
        eigene.set(parseInt(f.getAttribute("numFmtId"), 10), f.getAttribute("formatCode"));
      }
      const xf = d.getElementsByTagName("cellXfs")[0];
      if (xf) {
        [...xf.getElementsByTagName("xf")].forEach((e, i) => {
          const id = parseInt(e.getAttribute("numFmtId") || "0", 10);
          if (EINGEBAUTE_DATUMSFORMATE.has(id) || istDatumsformat(eigene.get(id))) {
            datumsStil.add(i);
          }
        });
      }
    }

    // Blattreihenfolge aus der Arbeitsmappe und ihren Beziehungen
    const mappe = xml(dateien, "xl/workbook.xml");
    const bezug = xml(dateien, "xl/_rels/workbook.xml.rels");
    const ziele = new Map();
    for (const r of bezug.getElementsByTagName("Relationship")) {
      ziele.set(r.getAttribute("Id"), r.getAttribute("Target"));
    }

    const blaetter = [];
    for (const s of mappe.getElementsByTagName("sheet")) {
      const id = s.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
              || s.getAttribute("r:id");
      let pfad = ziele.get(id) || "";
      pfad = pfad.replace(/^\/?xl\//, "").replace(/^\//, "");
      blaetter.push({ name: s.getAttribute("name"), pfad: "xl/" + pfad });
    }

    const gelesen = blaetter.map((b) => {
      const leer = { zellen: new Map(), formeln: new Map() };
      const inhalt = b.pfad && dateien.has(b.pfad)
        ? zellenLesen(xml(dateien, b.pfad), texte, datumsStil)
        : leer;
      return { name: b.name, ...inhalt };
    });

    return {
      blaetter: gelesen,
      /** Zellwert nach Blattposition und A1-Adresse. */
      zelle(index, a1) {
        const b = gelesen[index];
        return b ? (b.zellen.get(a1) ?? null) : null;
      },
      blattName(index) {
        const b = gelesen[index];
        return b ? b.name : null;
      },
      /**
       * Ob die Zelle eine Formel mit dem genannten Namen trägt.
       * M9 enthält im Referenz-Kalktool =TODAY(); der gelesene Wert ist dann
       * das Öffnungsdatum, nicht das Offertdatum (Abschnitt 6.4).
       */
      hatFormel(index, a1, name) {
        const b = gelesen[index];
        if (!b) return false;
        const f = b.formeln.get(a1);
        return !!f && f.toUpperCase().includes(name.toUpperCase());
      },
    };
  }

  function zellenLesen(doc, texte, datumsStil) {
    const zellen = new Map();
    const formeln = new Map();
    for (const c of doc.getElementsByTagName("c")) {
      const a1 = c.getAttribute("r");
      if (!a1) continue;
      const typ = c.getAttribute("t");
      const stil = parseInt(c.getAttribute("s") || "-1", 10);

      if (typ === "inlineStr") {
        const is = c.getElementsByTagName("is")[0];
        zellen.set(a1, is ? [...is.getElementsByTagName("t")].map((t) => t.textContent).join("") : "");
        continue;
      }

      const f = [...c.children].find((k) => k.tagName === "f");
      if (f) formeln.set(a1, f.textContent || "");

      // Nur das zwischengespeicherte Ergebnis, nie die Formel.
      const v = [...c.children].find((k) => k.tagName === "v");
      if (!v) continue;
      const roh = v.textContent;

      if (typ === "s") {
        zellen.set(a1, texte[parseInt(roh, 10)] ?? "");
      } else if (typ === "str" || typ === "e") {
        zellen.set(a1, roh);
      } else if (typ === "b") {
        zellen.set(a1, roh === "1");
      } else {
        const zahl = parseFloat(roh);
        if (Number.isNaN(zahl)) zellen.set(a1, roh);
        else if (datumsStil.has(stil) && zahl > 0) zellen.set(a1, alsDatum(zahl));
        else zellen.set(a1, zahl);
      }
    }
    return { zellen, formeln };
  }

  return { oeffnen, adresse, spaltenName };
})();
