/* Inhalte eines Datenblatts in die Offerte übernehmen.

   Ein Absatz lässt sich nicht einfach kopieren: er verweist über Bezeichner
   auf Formatvorlagen, Nummerierungen und Bilder, die im Zieldokument entweder
   fehlen oder etwas anderes bedeuten. Diese Klasse führt Buch über alle drei
   und schlüsselt jeden Verweis um – dieselben Regeln wie in der Python-Fassung
   (offerttool/docxutil/uebernehmen.py).

   Die Datenblätter und die Offertvorlage teilen sich keine einzige
   Formatvorlage: die einen nennen ihre Überschriften berschrift1, die andere
   Heading1. Ohne Zuordnung fände das Inhaltsverzeichnis das Kapitel nicht. */

const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const REL_BILD = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

const UEBERNAHME = (() => {
  "use strict";

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const BILDARTEN = {
    png: "image/png", jpeg: "image/jpeg", jpg: "image/jpeg", gif: "image/gif",
    emf: "image/x-emf", wmf: "image/x-wmf", svg: "image/svg+xml",
    tiff: "image/tiff", tif: "image/tiff", bmp: "image/bmp",
  };

  /** Ein gelesenes Datenblatt mit allen Nebenteilen. */
  async function quelleLesen(puffer) {
    const dateien = await ZIP.lesen(puffer);
    const xml = (name) =>
      dateien.has(name) ? parser.parseFromString(ZIP.text(dateien, name), "application/xml") : null;

    const beziehungen = new Map();
    const rels = xml("word/_rels/document.xml.rels");
    if (rels) {
      for (const r of rels.getElementsByTagName("Relationship")) {
        beziehungen.set(r.getAttribute("Id"), {
          typ: r.getAttribute("Type"),
          ziel: r.getAttribute("Target"),
        });
      }
    }
    return {
      dateien,
      document: xml("word/document.xml"),
      styles: xml("word/styles.xml"),
      numbering: xml("word/numbering.xml"),
      beziehungen,
    };
  }

  class Uebernahme {
    /**
     * @param ziel    Map des Zielarchivs (Name -> Inhalt)
     * @param zielDoc geparstes word/document.xml des Ziels
     * @param abbildung Zuordnung von Formatvorlagen-Bezeichnern
     */
    constructor(ziel, zielDoc, abbildung) {
      this.ziel = ziel;
      this.zielDoc = zielDoc;
      this.abbildung = abbildung || {};
      this.stile = this._zielStile();
      this.rels = parser.parseFromString(
        ZIP.text(ziel, "word/_rels/document.xml.rels"), "application/xml");
      this.contentTypes = parser.parseFromString(
        ZIP.text(ziel, "[Content_Types].xml"), "application/xml");
      this.numbering = ziel.has("word/numbering.xml")
        ? parser.parseFromString(ZIP.text(ziel, "word/numbering.xml"), "application/xml")
        : null;
      this._numids = new Map();
      this._bilder = new Map();
      this._zaehler = 0;
      this._naechsteNumId = this._hoechsteNumId() + 1;
      this._naechsteAbstrakt = this._hoechsteAbstrakt() + 1;
    }

    // -- Formatvorlagen -------------------------------------------------

    _zielStilWurzel() {
      if (!this._stilDoc) {
        this._stilDoc = parser.parseFromString(
          ZIP.text(this.ziel, "word/styles.xml"), "application/xml");
      }
      return this._stilDoc.documentElement;
    }

    _zielStile() {
      const aus = new Set();
      for (const s of this._zielStilWurzel().getElementsByTagNameNS(W_NS, "style")) {
        aus.add(s.getAttributeNS(W_NS, "styleId"));
      }
      return aus;
    }

    /** Fehlende Formatvorlagen ergänzen; vorhandene bleiben unangetastet. */
    stileErgaenzen(quelle) {
      if (!quelle.styles) return;
      const wurzel = this._zielStilWurzel();
      for (const stil of quelle.styles.documentElement.getElementsByTagNameNS(W_NS, "style")) {
        const kennung = stil.getAttributeNS(W_NS, "styleId");
        if (!kennung || this.abbildung[kennung] || this.stile.has(kennung)) continue;
        wurzel.appendChild(this.zielDoc.importNode(stil, true));
        this.stile.add(kennung);
      }
    }

    _stilUmschreiben(element) {
      for (const tag of ["pStyle", "rStyle", "tblStyle"]) {
        for (const e of element.getElementsByTagNameNS(W_NS, tag)) {
          const alt = e.getAttributeNS(W_NS, "val");
          if (this.abbildung[alt]) e.setAttributeNS(W_NS, "w:val", this.abbildung[alt]);
        }
      }
    }

    // -- Nummerierung ---------------------------------------------------

    _hoechsteNumId() {
      if (!this.numbering) return 1000;
      let hoch = 1000;
      for (const n of this.numbering.documentElement.getElementsByTagNameNS(W_NS, "num")) {
        hoch = Math.max(hoch, parseInt(n.getAttributeNS(W_NS, "numId") || "0", 10) || 0);
      }
      return hoch;
    }

    _hoechsteAbstrakt() {
      if (!this.numbering) return 1000;
      let hoch = 1000;
      for (const a of this.numbering.documentElement.getElementsByTagNameNS(W_NS, "abstractNum")) {
        hoch = Math.max(hoch, parseInt(a.getAttributeNS(W_NS, "abstractNumId") || "0", 10) || 0);
      }
      return hoch;
    }

    /** Listendefinitionen unter neuen Bezeichnern übernehmen. */
    nummerierungErgaenzen(quelle, kennung) {
      if (!quelle.numbering || !this.numbering) return;
      const wurzel = this.numbering.documentElement;
      const abstrakt = new Map();

      const erstesNum = wurzel.getElementsByTagNameNS(W_NS, "num")[0] || null;
      for (const a of [...quelle.numbering.documentElement.getElementsByTagNameNS(W_NS, "abstractNum")]) {
        const alt = a.getAttributeNS(W_NS, "abstractNumId");
        const neu = String(this._naechsteAbstrakt++);
        const kopie = this.numbering.importNode(a, true);
        kopie.setAttributeNS(W_NS, "w:abstractNumId", neu);
        // nsid darf nicht mit einer vorhandenen Liste kollidieren.
        for (const n of [...kopie.getElementsByTagNameNS(W_NS, "nsid")]) {
          kopie.removeChild(n);
        }
        this._stilUmschreiben(kopie);
        wurzel.insertBefore(kopie, erstesNum);
        abstrakt.set(alt, neu);
      }

      for (const n of [...quelle.numbering.documentElement.getElementsByTagNameNS(W_NS, "num")]) {
        const verweis = n.getElementsByTagNameNS(W_NS, "abstractNumId")[0];
        if (!verweis) continue;
        const zielAbstrakt = abstrakt.get(verweis.getAttributeNS(W_NS, "val"));
        if (!zielAbstrakt) continue;
        const neu = String(this._naechsteNumId++);
        const kopie = this.numbering.importNode(n, true);
        kopie.setAttributeNS(W_NS, "w:numId", neu);
        kopie.getElementsByTagNameNS(W_NS, "abstractNumId")[0]
             .setAttributeNS(W_NS, "w:val", zielAbstrakt);
        wurzel.appendChild(kopie);
        this._numids.set(`${kennung}|${n.getAttributeNS(W_NS, "numId")}`, neu);
      }
    }

    _numidUmschreiben(element, kennung) {
      for (const e of element.getElementsByTagNameNS(W_NS, "numId")) {
        const neu = this._numids.get(`${kennung}|${e.getAttributeNS(W_NS, "val")}`);
        if (neu) e.setAttributeNS(W_NS, "w:val", neu);
      }
    }

    // -- Bilder ---------------------------------------------------------

    _bildUebernehmen(quelle, kennung, rid) {
      const schluessel = `${kennung}|${rid}`;
      if (this._bilder.has(schluessel)) return this._bilder.get(schluessel);

      const eintrag = quelle.beziehungen.get(rid);
      if (!eintrag || eintrag.typ !== REL_BILD) return null;
      const quellpfad = ("word/" + eintrag.ziel).replace(/\/\.\//g, "/").replace(/^word\/\.\.\//, "");
      const daten = quelle.dateien.get(quellpfad);
      if (!daten) return null;

      const endung = (quellpfad.split(".").pop() || "").toLowerCase();
      const art = BILDARTEN[endung];
      if (!art) return null;

      const name = `word/media/datenblatt${++this._zaehler}.${endung}`;
      this.ziel.set(name, daten);
      this.ziel.reihenfolge.push(name);
      this._endungEintragen(endung, art);

      const neueRid = `rIdDb${this._zaehler}`;
      const rel = this.rels.createElementNS(REL_NS, "Relationship");
      rel.setAttribute("Id", neueRid);
      rel.setAttribute("Type", REL_BILD);
      rel.setAttribute("Target", `media/datenblatt${this._zaehler}.${endung}`);
      this.rels.documentElement.appendChild(rel);

      this._bilder.set(schluessel, neueRid);
      return neueRid;
    }

    /** Jede Dateiendung braucht einen Eintrag in [Content_Types].xml. */
    _endungEintragen(endung, art) {
      const wurzel = this.contentTypes.documentElement;
      for (const d of wurzel.getElementsByTagName("Default")) {
        if ((d.getAttribute("Extension") || "").toLowerCase() === endung) return;
      }
      const neu = this.contentTypes.createElementNS(CT_NS, "Default");
      neu.setAttribute("Extension", endung);
      neu.setAttribute("ContentType", art);
      wurzel.insertBefore(neu, wurzel.firstChild);
    }

    _bilderUmschreiben(element, quelle, kennung) {
      for (const e of element.getElementsByTagName("*")) {
        for (const attribut of ["embed", "link"]) {
          const alt = e.getAttributeNS(R_NS, attribut);
          if (!alt) continue;
          const neu = this._bildUebernehmen(quelle, kennung, alt);
          if (neu) e.setAttributeNS(R_NS, "r:" + attribut, neu);
          else e.removeAttributeNS(R_NS, attribut);
        }
      }
    }

    // -- Blockelemente ---------------------------------------------------

    /** Vorbereiten: Formatvorlagen und Nummerierungen bereitstellen. */
    vorbereiten(quelle, kennung) {
      this.stileErgaenzen(quelle);
      this.nummerierungErgaenzen(quelle, kennung);
    }

    /** Ein Blockelement übernehmen und alle Verweise umschlüsseln. */
    block(element, quelle, kennung) {
      const kopie = this.zielDoc.importNode(element, true);
      this._stilUmschreiben(kopie);
      this._numidUmschreiben(kopie, kennung);
      this._bilderUmschreiben(kopie, quelle, kennung);
      _fremdeVerweiseEntfernen(kopie);
      return kopie;
    }

    /** Geänderte Nebenteile zurück ins Archiv schreiben. */
    abschliessen() {
      if (this._stilDoc) {
        this.ziel.set("word/styles.xml", serializer.serializeToString(this._stilDoc));
      }
      if (this.numbering) {
        this.ziel.set("word/numbering.xml", serializer.serializeToString(this.numbering));
      }
      this.ziel.set("word/_rels/document.xml.rels", serializer.serializeToString(this.rels));
      this.ziel.set("[Content_Types].xml", serializer.serializeToString(this.contentTypes));
    }
  }

  /** Verweise entfernen, die im Ziel ins Leere zeigen würden. */
  function _fremdeVerweiseEntfernen(element) {
    for (const e of [...element.getElementsByTagNameNS(W_NS, "hyperlink")]) {
      e.removeAttributeNS(R_NS, "id");
    }
    for (const tag of ["object", "pict"]) {
      for (const e of [...element.getElementsByTagNameNS(W_NS, tag)]) {
        let hatBild = false;
        for (const k of e.getElementsByTagName("*")) {
          if (k.getAttributeNS(R_NS, "embed")) { hatBild = true; break; }
        }
        if (!hatBild && e.parentNode) e.parentNode.removeChild(e);
      }
    }
  }

  return { quelleLesen, Uebernahme };
})();
