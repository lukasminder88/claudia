/* Inhaltsverzeichnis neu aufbauen (Abschnitt 12.1).

   Nach dem Rendern stimmen weder Einträge noch Seitenzahlen des
   zwischengespeicherten Verzeichnisses – ohne Neuaufbau bliebe "Standort A"
   aus der Vorlage stehen.

   Von den sechs Schritten des Abschnitts sind fünf hier umsetzbar. Schritt 4
   (Seitenzahl je Überschrift aus einem PDF-Rendering lesen) kann der Browser
   nicht; die PAGEREF-Felder bleiben deshalb ohne zwischengespeichertes
   Ergebnis und Word füllt sie beim Öffnen. */

const TOC = (() => {
  "use strict";

  const EBENEN = { Heading1: 1, Heading2: 2, Heading3: 3 };
  const TOC_STIL = { 1: "TOC1", 2: "TOC2", 3: "TOC3" };

  function absatzStil(p) {
    const pPr = DOCX.ersteKind(p, "pPr");
    if (!pPr) return "Normal";
    const st = DOCX.ersteKind(pPr, "pStyle");
    return st ? DOCX.attr(st, "w:val") : "Normal";
  }

  /** Überschriften einsammeln und durchnummerieren (Schritte 1 und 2). */
  function ueberschriften(koerper) {
    const zaehler = [0, 0, 0];
    const eintraege = [];
    for (const p of DOCX.alle(koerper, "p")) {
      const ebene = EBENEN[absatzStil(p)];
      if (!ebene) continue;
      const titel = DOCX.knotenText(p).trim();
      if (!titel) continue;

      zaehler[ebene - 1] += 1;
      for (let i = ebene; i < 3; i++) zaehler[i] = 0;

      const nummer = ebene === 1 ? `${zaehler[0]}.0`
                   : ebene === 2 ? `${zaehler[0]}.${zaehler[1]}`
                   : `${zaehler[0]}.${zaehler[1]}.${zaehler[2]}`;
      eintraege.push({ nummer, titel, ebene, marke: `_Toc${900000 + eintraege.length}`, absatz: p });
    }
    return eintraege;
  }

  /** Bestehende _Toc-Lesezeichen entfernen, neue setzen (Schritt 3). */
  function lesezeichen(koerper, eintraege) {
    const offen = new Set();
    for (const start of DOCX.alle(koerper, "bookmarkStart")) {
      const name = DOCX.attr(start, "w:name") || "";
      if (name.startsWith("_Toc")) {
        offen.add(DOCX.attr(start, "w:id"));
        DOCX.entfernen(start);
      }
    }
    for (const ende of DOCX.alle(koerper, "bookmarkEnd")) {
      if (offen.has(DOCX.attr(ende, "w:id"))) DOCX.entfernen(ende);
    }

    eintraege.forEach((e, i) => {
      const doc = e.absatz.ownerDocument;
      const start = DOCX.el(doc, "w:bookmarkStart");
      DOCX.setAttr(start, "w:id", String(9000 + i));
      DOCX.setAttr(start, "w:name", e.marke);
      const ende = DOCX.el(doc, "w:bookmarkEnd");
      DOCX.setAttr(ende, "w:id", String(9000 + i));

      const pPr = DOCX.ersteKind(e.absatz, "pPr");
      e.absatz.insertBefore(start, pPr ? pPr.nextSibling : e.absatz.firstChild);
      e.absatz.appendChild(ende);
    });
  }

  /** Verzeichniseinträge aus den Vorlagen-Absätzen klonen (Schritt 5). */
  function aufbauen(tocSdt, eintraege) {
    const inhalt = DOCX.sdtInhalt(tocSdt);
    if (!inhalt) return;

    const muster = {};
    let kopf = null;
    for (const p of DOCX.kinder(inhalt, "p")) {
      const stil = absatzStil(p);
      const alsToc = Object.entries(TOC_STIL).find(([, name]) => name === stil);
      if (alsToc) {
        if (!muster[alsToc[0]]) muster[alsToc[0]] = p.cloneNode(true);
      } else if (!kopf) {
        kopf = p.cloneNode(true);
      }
    }
    const vorhandene = DOCX.kinder(inhalt, "p");
    if (!Object.keys(muster).length) {
      if (!vorhandene.length) return;
      const letzter = vorhandene[vorhandene.length - 1].cloneNode(true);
      for (const ebene of [1, 2, 3]) muster[ebene] = letzter.cloneNode(true);
    }

    for (const k of [...inhalt.children]) inhalt.removeChild(k);
    if (kopf) inhalt.appendChild(kopf);

    for (const e of eintraege) {
      const vorlage = muster[e.ebene] || muster[Math.max(...Object.keys(muster).map(Number))];
      const p = vorlage.cloneNode(true);
      DOCX.setzeAbsatzText(p, "");
      DOCX.setzeAbsatzStil(p, TOC_STIL[e.ebene]);
      eintragFuellen(p, e);
      inhalt.appendChild(p);
    }
  }

  function eintragFuellen(p, e) {
    const doc = p.ownerDocument;
    const link = DOCX.el(doc, "w:hyperlink");
    DOCX.setAttr(link, "w:anchor", e.marke);
    DOCX.setAttr(link, "w:history", "1");
    p.appendChild(link);

    run(link, `${e.nummer}\t${e.titel}`);
    run(link, "\t");
    pageref(link, e);
  }

  function run(eltern, text) {
    const doc = eltern.ownerDocument;
    const r = DOCX.el(doc, "w:r");
    text.split("\t").forEach((teil, i) => {
      if (i) r.appendChild(DOCX.el(doc, "w:tab"));
      if (teil) {
        const t = DOCX.el(doc, "w:t");
        t.setAttribute("xml:space", "preserve");
        t.textContent = teil;
        r.appendChild(t);
      }
    });
    eltern.appendChild(r);
    return r;
  }

  /** PAGEREF-Feld ohne zwischengespeichertes Ergebnis – Word rechnet es aus. */
  function pageref(eltern, e) {
    const doc = eltern.ownerDocument;

    const mitFldChar = (typ) => {
      const r = DOCX.el(doc, "w:r");
      const f = DOCX.el(doc, "w:fldChar");
      DOCX.setAttr(f, "w:fldCharType", typ);
      r.appendChild(f);
      eltern.appendChild(r);
    };

    mitFldChar("begin");
    const r = DOCX.el(doc, "w:r");
    const it = DOCX.el(doc, "w:instrText");
    it.setAttribute("xml:space", "preserve");
    it.textContent = ` PAGEREF ${e.marke} \\h `;
    r.appendChild(it);
    eltern.appendChild(r);
    mitFldChar("separate");
    run(eltern, "");
    mitFldChar("end");
  }

  function neuAufbauen(koerper) {
    const tocSdt = DOCX.finde(koerper, "SYS.TOC");
    if (!tocSdt) return 0;
    const eintraege = ueberschriften(koerper);
    lesezeichen(koerper, eintraege);
    aufbauen(tocSdt, eintraege);
    return eintraege.length;
  }

  return { neuAufbauen, ueberschriften };
})();
