/* WordprocessingML bearbeiten (Abschnitte 3 und 10).

   Adressiert wird ausschliesslich über w:tag von Inhaltssteuerelementen –
   nie über Textsuche. Tabellen werden aus Musterzeilen geklont, nie neu
   aufgebaut; dabei blieben tblGrid und Rahmen sonst auf der Strecke. */

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const DOCX = (() => {
  "use strict";

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const el = (doc, name) => doc.createElementNS(W_NS, name);
  const attr = (knoten, name) => knoten.getAttributeNS(W_NS, name.replace("w:", ""));
  const setAttr = (knoten, name, wert) => knoten.setAttributeNS(W_NS, name, wert);

  /** Direkte Kinder mit dem gegebenen Namen (nicht rekursiv). */
  function kinder(knoten, name) {
    const out = [];
    for (const k of knoten.children) if (k.localName === name) out.push(k);
    return out;
  }

  function ersteKind(knoten, name) {
    for (const k of knoten.children) if (k.localName === name) return k;
    return null;
  }

  /** Alle Nachfahren mit dem gegebenen Namen. */
  const alle = (knoten, name) => [...knoten.getElementsByTagNameNS(W_NS, name)];

  function entfernen(knoten) {
    if (knoten && knoten.parentNode) knoten.parentNode.removeChild(knoten);
  }

  // --- Absätze -----------------------------------------------------------

  /** Sichtbarer Text eines Knotens, inklusive Inhalt von Steuerelementen. */
  function knotenText(knoten) {
    let out = "";
    const lauf = (n) => {
      for (const k of n.children) {
        if (k.localName === "t") out += k.textContent;
        else if (k.localName === "tab") out += "\t";
        else if (k.localName === "br" || k.localName === "cr") out += "\n";
        else lauf(k);
      }
    };
    lauf(knoten);
    return out;
  }

  /**
   * Absatzinhalt durch genau einen Run ersetzen.
   * Die Zeichenformatierung des ersten bestehenden Runs bleibt erhalten.
   */
  function setzeAbsatzText(p, text) {
    const doc = p.ownerDocument;
    const ersterRun = ersteKind(p, "r");
    const rPr = ersterRun ? ersteKind(ersterRun, "rPr") : null;
    const rPrKopie = rPr ? rPr.cloneNode(true) : null;

    for (const k of [...p.children]) {
      if (k.localName !== "pPr") p.removeChild(k);
    }
    if (text === "") return;

    const run = el(doc, "w:r");
    if (rPrKopie) run.appendChild(rPrKopie);
    String(text).split("\n").forEach((zeile, i) => {
      if (i) run.appendChild(el(doc, "w:br"));
      const t = el(doc, "w:t");
      t.setAttribute("xml:space", "preserve");
      t.textContent = zeile;
      run.appendChild(t);
    });
    p.appendChild(run);
  }

  /** Formatvorlage eines Absatzes über ihre interne ID setzen. */
  function setzeAbsatzStil(p, stilId) {
    const doc = p.ownerDocument;
    let pPr = ersteKind(p, "pPr");
    if (!pPr) { pPr = el(doc, "w:pPr"); p.insertBefore(pPr, p.firstChild); }
    let pStyle = ersteKind(pPr, "pStyle");
    if (!pStyle) { pStyle = el(doc, "w:pStyle"); pPr.insertBefore(pStyle, pPr.firstChild); }
    setAttr(pStyle, "w:val", stilId);
  }

  function neuerAbsatz(muster, text, stilId) {
    const p = muster.cloneNode(true);
    setzeAbsatzText(p, text ?? "");
    if (stilId) setzeAbsatzStil(p, stilId);
    return p;
  }

  // --- Inhaltssteuerelemente --------------------------------------------

  function sdtTag(sdt) {
    const pr = ersteKind(sdt, "sdtPr");
    if (!pr) return null;
    const tag = ersteKind(pr, "tag");
    return tag ? attr(tag, "w:val") : null;
  }

  const sdtInhalt = (sdt) => ersteKind(sdt, "sdtContent");

  /** w:tag -> Liste der Steuerelemente, in Dokumentreihenfolge. */
  function ankerKarte(wurzel) {
    const karte = new Map();
    for (const sdt of alle(wurzel, "sdt")) {
      const tag = sdtTag(sdt);
      if (tag) {
        if (!karte.has(tag)) karte.set(tag, []);
        karte.get(tag).push(sdt);
      }
    }
    return karte;
  }

  function finde(wurzel, tag) {
    for (const sdt of alle(wurzel, "sdt")) if (sdtTag(sdt) === tag) return sdt;
    return null;
  }

  /**
   * w:sdt durch seinen Inhalt ersetzen (Abschnitt 10.3).
   * Ohne diesen Schritt überleben Reste der Vorlage sichtbar im Text.
   */
  function aufloesen(sdt) {
    const eltern = sdt.parentNode;
    if (!eltern) return;
    const inhalt = sdtInhalt(sdt);
    if (inhalt) {
      while (inhalt.firstChild) eltern.insertBefore(inhalt.firstChild, sdt);
    }
    eltern.removeChild(sdt);
  }

  /** Alle Steuerelemente innerhalb eines Bereichs auflösen. */
  function aufloesenInnere(bereich) {
    let sdts = alle(bereich, "sdt");
    let schutz = 0;
    while (sdts.length && schutz++ < 200) {
      for (const sdt of sdts) aufloesen(sdt);
      sdts = alle(bereich, "sdt");
    }
  }

  const absaetzeVon = (sdt) => kinder(sdtInhalt(sdt), "p");
  const tabellenVon = (sdt) => kinder(sdtInhalt(sdt), "tbl");

  /** TEXT-Anker: Inhalt durch genau einen Run ersetzen. */
  function setzeText(sdt, text, stilId) {
    aufloesenInnere(sdtInhalt(sdt));
    const absaetze = absaetzeVon(sdt);
    if (!absaetze.length) throw new OfferteError("E101", `TEXT-Anker ohne Absatz: ${sdtTag(sdt)}`);
    absaetze.slice(1).forEach(entfernen);
    setzeAbsatzText(absaetze[0], text);
    if (stilId) setzeAbsatzStil(absaetze[0], stilId);
  }

  /**
   * BLOCK-Anker: Inhalt durch n Absätze ersetzen.
   * Eine leere Liste löscht den Absatz vollständig – ein leeres Kann-Feld
   * erzeugt keine leere Zeile (Abschnitt 4.4).
   */
  function setzeBlock(sdt, zeilen, stilId) {
    const inhalt = sdtInhalt(sdt);
    aufloesenInnere(inhalt);
    const absaetze = absaetzeVon(sdt);
    if (!absaetze.length) throw new OfferteError("E101", `BLOCK-Anker ohne Absatz: ${sdtTag(sdt)}`);
    const muster = absaetze[0].cloneNode(true);
    absaetze.forEach(entfernen);
    for (const zeile of zeilen) {
      const [text, stil] = Array.isArray(zeile) ? zeile : [zeile, stilId];
      inhalt.appendChild(neuerAbsatz(muster, text, stil));
    }
  }

  /** SWITCH-Anker: genau eine Kindvariante bleibt stehen (Abschnitt 3.1). */
  function waehleVariante(sdt, variantenTag) {
    const inhalt = sdtInhalt(sdt);
    let treffer = null;
    for (const k of [...inhalt.children]) {
      if (k.localName !== "sdt") continue;
      if (sdtTag(k) === variantenTag) treffer = k;
      else inhalt.removeChild(k);
    }
    if (!treffer) throw new OfferteError("E101", `SWITCH-Variante fehlt: ${variantenTag}`);
    aufloesen(treffer);
  }

  /** Anker-Steuerelement direkt hinter sich selbst duplizieren (Abschnitt 11). */
  function klonNach(sdt) {
    const neu = sdt.cloneNode(true);
    sdt.parentNode.insertBefore(neu, sdt.nextSibling);
    return neu;
  }

  // --- Tabellen (Abschnitt 10) ------------------------------------------

  const zeilen = (tbl) => kinder(tbl, "tr");
  const zellen = (tr) => kinder(tr, "tc");

  /**
   * Zellinhalt absatzweise setzen (Abschnitt 10.2).
   * Überzählige Absätze werden gelöscht, fehlende durch Klonen des letzten
   * ergänzt. Steuerelemente in der Zelle werden vorher aufgelöst.
   */
  function setzeZelle(tc, texte) {
    aufloesenInnere(tc);
    const liste = (texte && texte.length ? texte : [""]).map((t) => String(t ?? ""));
    let absaetze = kinder(tc, "p");
    if (!absaetze.length) throw new OfferteError("E101", "Tabellenzelle ohne Absatz");

    while (absaetze.length < liste.length) {
      const neu = absaetze[absaetze.length - 1].cloneNode(true);
      tc.insertBefore(neu, absaetze[absaetze.length - 1].nextSibling);
      absaetze = kinder(tc, "p");
    }
    absaetze.slice(liste.length).forEach(entfernen);
    absaetze = kinder(tc, "p");
    liste.forEach((text, i) => setzeAbsatzText(absaetze[i], text));
  }

  /** Je Datensatz eine Musterzeile klonen und füllen. */
  function fuelleZeilen(tbl, musterIndex, datensaetze) {
    const trs = zeilen(tbl);
    if (musterIndex >= trs.length) {
      throw new OfferteError("E101", `Musterzeile ${musterIndex} fehlt`);
    }
    const muster = trs[musterIndex];
    for (const satz of datensaetze) {
      const tr = muster.cloneNode(true);
      tbl.appendChild(tr);
      const tcs = zellen(tr);
      tcs.forEach((tc, i) => {
        const inhalt = satz[i];
        if (inhalt === undefined || inhalt === null) setzeZelle(tc, [""]);
        else setzeZelle(tc, Array.isArray(inhalt) ? inhalt : [inhalt]);
      });
    }
    entfernen(muster);
  }

  /**
   * Eine Spalte samt ihrer Breite entfernen.
   * Die freiwerdende Breite geht an die Nachbarspalte, damit die Tabelle so
   * breit bleibt wie in der Vorlage.
   */
  function spalteEntfernen(tbl, index) {
    const grid = ersteKind(tbl, "tblGrid");
    if (grid) {
      const cols = kinder(grid, "gridCol");
      if (index < cols.length && cols.length > 1) {
        const frei = parseInt(attr(cols[index], "w:w") || "0", 10);
        const nachbar = cols[index + 1] || cols[index - 1];
        setAttr(nachbar, "w:w", String(parseInt(attr(nachbar, "w:w") || "0", 10) + frei));
        entfernen(cols[index]);
      }
    }
    for (const tr of zeilen(tbl)) {
      const tcs = zellen(tr);
      if (index >= tcs.length || tcs.length <= 1) continue;
      const frei = zellenBreite(tcs[index]);
      const nachbar = tcs[index + 1] || tcs[index - 1];
      setzeZellenBreite(nachbar, zellenBreite(nachbar) + frei);
      entfernen(tcs[index]);
    }
  }

  function zellenBreite(tc) {
    const tcPr = ersteKind(tc, "tcPr");
    const tcW = tcPr && ersteKind(tcPr, "tcW");
    if (!tcW) return 0;
    const typ = attr(tcW, "w:type");
    if (typ && typ !== "dxa") return 0;
    return parseInt(attr(tcW, "w:w") || "0", 10) || 0;
  }

  function setzeZellenBreite(tc, breite) {
    const tcPr = ersteKind(tc, "tcPr");
    const tcW = tcPr && ersteKind(tcPr, "tcW");
    if (!tcW) return;
    setAttr(tcW, "w:w", String(breite));
    setAttr(tcW, "w:type", "dxa");
  }

  /**
   * tblLook steuert die bedingte Formatierung (Abschnitt 10.4).
   * Listentabellen ohne Summenzeile brauchen 04A0 (ohne lastRow), sonst wird
   * die letzte Position fett dargestellt und liest sich wie ein Total.
   */
  function setzeTblLook(tbl, wert) {
    const tblPr = ersteKind(tbl, "tblPr");
    if (!tblPr) return;
    let look = ersteKind(tblPr, "tblLook");
    if (!look) { look = el(tbl.ownerDocument, "w:tblLook"); tblPr.appendChild(look); }
    const bits = parseInt(wert, 16);
    setAttr(look, "w:val", wert);
    setAttr(look, "w:firstRow", bits & 0x0020 ? "1" : "0");
    setAttr(look, "w:lastRow", bits & 0x0040 ? "1" : "0");
    setAttr(look, "w:firstColumn", bits & 0x0080 ? "1" : "0");
    setAttr(look, "w:lastColumn", bits & 0x0100 ? "1" : "0");
    setAttr(look, "w:noHBand", bits & 0x0200 ? "1" : "0");
    setAttr(look, "w:noVBand", bits & 0x0400 ? "1" : "0");
  }

  // --- Felder einfrieren (Abschnitt 12.2) -------------------------------

  const FELDTYPEN = ["TIME", "DATE", "CREATEDATE", "PRINTDATE", "SAVEDATE"];

  /**
   * TIME-Felder im Fliesstext durch einen statischen Run ersetzen.
   * Sie würden beim Öffnen auf das Tagesdatum springen und das Offertdatum
   * überschreiben. Das Feld in der Fusszeile bleibt – es ist das Druckdatum.
   */
  function friereFelder(wurzel, ersatz) {
    let ersetzt = 0;
    for (const p of alle(wurzel, "p")) {
      let runs = kinder(p, "r");
      let i = 0;
      while (i < runs.length) {
        const fld = ersteKind(runs[i], "fldChar");
        if (!fld || attr(fld, "w:fldCharType") !== "begin") { i++; continue; }

        let ende = -1, instr = "";
        for (let j = i; j < runs.length; j++) {
          for (const it of kinder(runs[j], "instrText")) instr += it.textContent + " ";
          const f = ersteKind(runs[j], "fldChar");
          if (f && attr(f, "w:fldCharType") === "end") { ende = j; break; }
        }
        if (ende < 0) { i++; continue; }

        const name = instr.trim().split(/\s+/)[0].toUpperCase();
        if (!FELDTYPEN.includes(name)) { i = ende + 1; continue; }

        const ziel = runs[i];
        for (const k of [...ziel.children]) if (k.localName !== "rPr") ziel.removeChild(k);
        const t = el(p.ownerDocument, "w:t");
        t.setAttribute("xml:space", "preserve");
        t.textContent = ersatz;
        ziel.appendChild(t);
        runs.slice(i + 1, ende + 1).forEach(entfernen);

        runs = kinder(p, "r");
        i = 0;
        ersetzt++;
      }
    }
    return ersetzt;
  }

  return {
    parser, serializer, el, attr, setAttr, kinder, ersteKind, alle, entfernen,
    knotenText, setzeAbsatzText, setzeAbsatzStil, neuerAbsatz,
    sdtTag, sdtInhalt, ankerKarte, finde, aufloesen, aufloesenInnere,
    absaetzeVon, tabellenVon, setzeText, setzeBlock, waehleVariante, klonNach,
    zeilen, zellen, setzeZelle, fuelleZeilen, setzeTblLook, spalteEntfernen,
    friereFelder,
  };
})();
