/* Renderer und Pipeline (Abschnitte 1, 9, 11, 13).

   Die Schritte bis VALIDATE_INPUT sind seiteneffektfrei. Erst danach wird das
   Dokument berührt, erst nach bestandener Ausgabeprüfung entsteht eine Datei –
   nie eine halbe Offerte. */

const RENDER = (() => {
  "use strict";

  const num = DERIVE.num, txt = DERIVE.text;
  const STIL = MAPPING.styles;

  const ANKER_STIL = {
    "OFF.KUNDE": "Normal", "OFF.KONTAKT": "Normal", "OFF.KLASSIFIZIERUNG": "Normal",
    "OFF.NUMMER": "Normal", "OFF.VERSION": "Normal", "OFF.DATUM": "Normal",
    "OFF.GUELTIG_BIS": "Normal", "HEAD.STANDORT": "Heading3",
    "LINE.STANDORT_ADRESSE": "05Klein", "HEAD.DL": "Heading3",
    "HEAD.SERVICE_STANDORT": "Heading3", "HEAD.VERTRAGSTEXT": "Heading2",
    "LINE.NACHWEIS": "05Klein", "OFF.ORT_DATUM": "Normal",
  };

  const PER_STANDORT = ["SEC.STANDORT", "SEC.SERVICE", "TBL.TOTAL"];

  class Renderer {
    constructor(doc, crm, warn) {
      this.doc = doc;
      this.koerper = DOCX.alle(doc, "body")[0];
      this.crm = crm;
      this.warn = warn;
      // Jeder Betrag, den der Renderer selbst setzt – Grundlage der
      // Sperrlistenprüfung (Abschnitt 13.2).
      this.gesetzt = new Set();
    }

    merke(wert) {
      for (const treffer of String(wert).matchAll(/-?\d[\d’]*(?:\.\d+)?/g)) {
        this.gesetzt.add(treffer[0]);
      }
      return wert;
    }

    merkeAlle(werte) {
      for (const w of werte) Array.isArray(w) ? this.merkeAlle(w) : this.merke(w);
    }

    anker(tag, wurzel) {
      const sdt = DOCX.finde(wurzel || this.koerper, tag);
      if (!sdt) throw new OfferteError("E101", tag);
      return sdt;
    }

    text(tag, wert, wurzel) {
      DOCX.setzeText(this.anker(tag, wurzel), this.merke(wert), ANKER_STIL[tag]);
    }

    block(tag, zeilen, wurzel) {
      this.merkeAlle(zeilen);
      DOCX.setzeBlock(this.anker(tag, wurzel), zeilen, ANKER_STIL[tag]);
    }

    tabelle(tag, wurzel) {
      const sdt = this.anker(tag, wurzel);
      const tbls = DOCX.tabellenVon(sdt);
      if (!tbls.length) throw new OfferteError("E101", `${tag}: kein Tabellenelement`);
      return [sdt, tbls[0]];
    }

    // --- Deckblatt (Abschnitt 9) ---------------------------------------

    deckblatt(ctx, d) {
      const ort = ctx.values["kunde.plz_ort"] || {};
      const kontakt = ctx.values["kunde.kontakt"] || {};
      const name = [
        this.crm.get("kontakt.vorname") || kontakt.vorname || "",
        this.crm.get("kontakt.nachname") || kontakt.nachname || "",
      ].filter(Boolean).join(" ");

      const kunde = [txt(ctx, "kunde.firma")];
      if (this.crm.get("kontakt.anrede")) kunde.push(this.crm.get("kontakt.anrede"));
      if (name) kunde.push(name);
      kunde.push(txt(ctx, "kunde.strasse"));
      kunde.push(`${ort.plz || ""} ${ort.ort || ""}`.trim());
      this.block("OFF.KUNDE", kunde.filter(Boolean));

      // OFF.ANBIETER ist statisch und bleibt unverändert.
      DOCX.aufloesen(this.anker("OFF.ANBIETER"));

      const vk = [txt(ctx, "vk.name")];
      for (const [feld, praefix] of [["vk.funktion", ""], ["vk.telefon", "Direkt "], ["vk.email", ""]]) {
        const wert = this.crm.get(feld);
        if (wert) vk.push(praefix + wert);
      }
      this.block("OFF.KONTAKT", vk.filter(Boolean));

      this.text("OFF.KLASSIFIZIERUNG", TEXT.klassifizierung());
      this.text("OFF.NUMMER", this.crm.offertnummer(txt(ctx, "verkaufschance"), this.warn));
      this.text("OFF.VERSION", this.crm.offertversion(this.warn));
      this.text("OFF.DATUM", FMT.dateDe(ctx.values.datum));
      this.text("OFF.GUELTIG_BIS", TEXT.gueltigkeit(d));
    }

    // --- Standorte (Abschnitt 11) --------------------------------------

    kloneStandorte(anzahl) {
      for (const tag of PER_STANDORT) {
        let letzte = this.anker(tag);
        for (let i = 1; i < anzahl; i++) letzte = DOCX.klonNach(letzte);
      }
      const karte = DOCX.ankerKarte(this.koerper);
      const out = {};
      for (const tag of PER_STANDORT) out[tag] = karte.get(tag) || [];
      return out;
    }

    standort(secStandort, secService, tblTotal, ctx, d) {
      this.text("HEAD.STANDORT", TEXT.headStandort(ctx), secStandort);
      const adresse = TEXT.lineAdresse(ctx);
      if (adresse) {
        this.text("LINE.STANDORT_ADRESSE", adresse, secStandort);
      } else {
        this.warn.add("W315", ctx.quelle);
        DOCX.entfernen(this.anker("LINE.STANDORT_ADRESSE", secStandort));
      }
      this.hardware(ctx, secStandort);
      this.dienstleistung(ctx, d, secStandort);

      this.text("HEAD.SERVICE_STANDORT", TEXT.headStandort(ctx), secService);
      this.service(ctx, d, secService);

      this.total(tblTotal, TEXT.totalZeilen(ctx, d));
    }

    hardware(ctx, wurzel) {
      const [, tbl] = this.tabelle("TBL.HARDWARE", wurzel);

      const positionen = [...(ctx.listen.hardware || []),
                          ...(ctx.listen["solutions.sw"] || []),
                          ...(ctx.listen["solutions.maint"] || [])];

      // Das Kalktool Q4 2025 führt keine Artikelnummern (Abschnitt 16, Punkt 1).
      // Eine Spalte voller Gedankenstriche hilft niemandem, deshalb entfällt
      // sie, solange keine einzige Position eine Nummer trägt.
      const mitArtNr = positionen.some((p) => p.artnr !== "" && p.artnr !== "–");

      if (!mitArtNr) DOCX.spalteEntfernen(tbl, 0);
      const kopf = DOCX.zellen(DOCX.zeilen(tbl)[0]);
      TEXT.kopfHardware(mitArtNr).forEach((titel, i) => DOCX.setzeZelle(kopf[i], [titel]));
      const saetze = positionen.map((p) =>
        (mitArtNr ? [p.artnr] : []).concat([p.bezeichnung, p.stueck]));
      DOCX.fuelleZeilen(tbl, 1, saetze);
      // Listentabelle ohne Summenzeile: lastRow aus.
      DOCX.setzeTblLook(tbl, STIL.tbllook_liste || "04A0");
    }

    dienstleistung(ctx, d, wurzel) {
      if (!d.show.dienstleistung) {
        DOCX.entfernen(this.anker("HEAD.DL", wurzel));
        DOCX.entfernen(this.anker("TBL.DIENSTLEISTUNG", wurzel));
        return;
      }
      this.text("HEAD.DL", TEXT.headDl(ctx), wurzel);
      const [, tbl] = this.tabelle("TBL.DIENSTLEISTUNG", wurzel);
      const kopf = DOCX.zellen(DOCX.zeilen(tbl)[0]);
      TEXT.kopfDienstleistung().forEach((titel, i) => DOCX.setzeZelle(kopf[i], [titel]));

      const saetze = (ctx.listen.dienstleistung || []).map((p) => [p.bezeichnung, FMT.chf(p.betrag)]);
      for (const p of ctx.listen["solutions.dl"] || []) saetze.push([p.bezeichnung, FMT.chf(p.betrag)]);
      saetze.push([TEXT.dlTotalLabel(), FMT.chf(d.dienstleistungTotal)]);
      this.merkeAlle(saetze);
      DOCX.fuelleZeilen(tbl, 1, saetze);
      DOCX.setzeTblLook(tbl, STIL.tbllook_summe || "04E0");
    }

    service(ctx, d, wurzel) {
      const [, tbl] = this.tabelle("TBL.SERVICE", wurzel);
      const kopf = DOCX.zellen(DOCX.zeilen(tbl)[0]);
      TEXT.kopfService(d).forEach((titel, i) => DOCX.setzeZelle(kopf[i], [titel]));

      const saetze = TEXT.serviceZeilen(ctx, d).map(([texte, betraege]) => [texte, betraege]);
      this.merkeAlle(saetze);
      DOCX.fuelleZeilen(tbl, 1, saetze);
      // Kapitel 1.2 zeigt die Servicebestandteile ohne Summenzeile
      // (Abschnitt 5.4); mit lastRow käme die letzte Zeile fett.
      DOCX.setzeTblLook(tbl, STIL.tbllook_liste || "04A0");
    }

    total(sdt, zeilen) {
      const tbls = DOCX.tabellenVon(sdt);
      if (!tbls.length) throw new OfferteError("E101", "TBL.TOTAL: kein Tabellenelement");
      this.merkeAlle(zeilen);
      DOCX.fuelleZeilen(tbls[0], 0, zeilen.map(([l, b]) => [l, b]));
      DOCX.setzeTblLook(tbls[0], STIL.tbllook_summe || "04E0");
    }

    /** Summe über alle Standorte; bei einem Standort entfällt sie ersatzlos. */
    gesamttotal(g, variante, anzahl) {
      const sdt = this.anker("TBL.GESAMTTOTAL");
      if (anzahl <= 1) { DOCX.entfernen(sdt); return; }
      this.total(sdt, TEXT.gesamtZeilen(g, variante));
    }

    // --- Gerätedatenblätter --------------------------------------------

    /**
     * Je Gerät ein Abschnitt aus dem zugehörigen Datenblatt.
     * Ohne Datenblätter entfällt das Kapitel ersatzlos.
     */
    hardwareKapitel(vorbereitet) {
      const sdt = this.anker("SEC.HARDWARE");
      if (!vorbereitet || !vorbereitet.length) {
        DOCX.entfernen(sdt);
        return;
      }
      const inhalt = DOCX.sdtInhalt(sdt);
      const muster = DOCX.kinder(inhalt, "p")[0];
      if (!muster) throw new OfferteError("E101", "SEC.HARDWARE ohne Absatz");

      const bloecke = [
        DOCX.neuerAbsatz(muster, TEXT.hardwareKapitel(), "Heading1"),
        DOCX.neuerAbsatz(muster, TEXT.hardwareGruppe(), "Heading2"),
      ];
      for (const eintrag of vorbereitet) bloecke.push(...eintrag.bloecke);

      while (inhalt.firstChild) inhalt.removeChild(inhalt.firstChild);
      for (const b of bloecke) inhalt.appendChild(b);
    }

    // --- Vertragstext, Konditionen, Schluss ----------------------------

    vertragstext(ctx, d) {
      const [kopf, absaetze] = TEXT.vertragstext(ctx, d);
      this.text("HEAD.VERTRAGSTEXT", kopf);
      const sdt = this.anker("SW.VERTRAGSTEXT");
      DOCX.waehleVariante(sdt, `SW.VERTRAGSTEXT.${d.variante}`);
      this.merkeAlle(absaetze);
      DOCX.setzeBlock(sdt, absaetze, "Normal");
    }

    konditionen(ctx, d) {
      const tbl = this.anker("TBL.KONDITIONEN");
      this.block("KOND.ABRECHNUNG", TEXT.konditionenAbrechnung(ctx), tbl);
      this.block("KOND.RECHNUNG", TEXT.konditionenRechnung(ctx, d), tbl);
      // Die Konditionentabelle ist statisch; ihr tblLook bleibt, wie die
      // Vorlage es definiert.
    }

    schluss(standorte) {
      this.text("OFF.ORT_DATUM", TEXT.ortDatum(standorte[0].ctx));
      this.text("LINE.NACHWEIS", TEXT.nachweis(standorte));
    }

    /** Alle verbliebenen Anker auflösen – ausser dem Inhaltsverzeichnis. */
    loeseAlleAuf() {
      for (const [tag, elemente] of DOCX.ankerKarte(this.koerper)) {
        if (tag === "SYS.TOC" || tag === "Seitenumbruch nicht löschen") continue;
        for (const e of elemente) DOCX.aufloesen(e);
      }
    }
  }

  function render(doc, standorte, gesamt, crm, warn, datenblaetter) {
    const r = new Renderer(doc, crm, warn);
    const erste = standorte[0];

    r.deckblatt(erste.ctx, erste.d);
    const kopien = r.kloneStandorte(standorte.length);
    standorte.forEach((s, i) => {
      r.standort(kopien["SEC.STANDORT"][i], kopien["SEC.SERVICE"][i], kopien["TBL.TOTAL"][i], s.ctx, s.d);
    });
    r.gesamttotal(gesamt, erste.d.variante, standorte.length);

    // Bei unterschiedlichen Laufzeiten nennt der Vertragstext die längste (W310).
    const leit = standorte.reduce((a, b) => (num(b.ctx, "laufzeit") > num(a.ctx, "laufzeit") ? b : a));
    r.hardwareKapitel(datenblaetter);
    r.vertragstext(leit.ctx, erste.d);
    r.konditionen(erste.ctx, erste.d);
    r.schluss(standorte);
    r.loeseAlleAuf();
    return r.gesetzt;
  }

  return { render };
})();
