/* Validierung (Abschnitt 13) und die Pipeline (Abschnitt 1). */

const PIPELINE = (() => {
  "use strict";

  const num = DERIVE.num, txt = DERIVE.text;
  const TOLERANZ = 0.01;
  const RE_PLATZHALTER = /%%[^%\s]+%%|\{[a-z][\w.|]*\}/;
  const RE_ZAHL = /-?\d[\d’]*(?:\.\d+)?/g;

  /** Abbruchregeln je Standort (Abschnitt 13.1). */
  function pruefeEingabe(ctx, d) {
    for (const [name, spez] of Object.entries(MAPPING.fields)) {
      if (spez.req !== "M") continue;
      if (spez.only && !spez.only.includes(d.variante)) continue;
      const wert = ctx.values[name];
      if (wert === null || wert === undefined || (typeof wert === "string" && !wert.trim())) {
        throw new OfferteError("E211", `${ctx.quelle}: Pflichtfeld ${name} (${spez.cell}) ist leer`);
      }
    }

    if (d.variante === "MIETE" || d.variante === "LEASING") {
      if (num(ctx, "laufzeit") <= 0) throw new OfferteError("E411", ctx.quelle);
      if (num(ctx, "pauschale_ohne_service") === 0) throw new OfferteError("E413", ctx.quelle);
    }
    if (d.variante === "KAUF" && num(ctx, "vertragswert") === 0) {
      throw new OfferteError("E414", ctx.quelle);
    }
    if (!(ctx.listen.hardware || []).some((p) => p.bezeichnung)) {
      throw new OfferteError("E412", ctx.quelle);
    }

    // Doppelzählungssperre (Abschnitt 5.4): L95 = L92 + L93 + L94.
    if (d.variante === "MIETE" || d.variante === "LEASING") {
      const total = num(ctx, "monatspauschale_total");
      const teile = num(ctx, "pauschale_ohne_service") + num(ctx, "service.solution") + num(ctx, "service.geraet");
      if (Math.abs(total - teile) > TOLERANZ) {
        throw new OfferteError("E402", `${ctx.quelle}: L95=${total} != L92+L93+L94=${teile}`);
      }
    }
  }

  /** Regeln über Standorte hinweg (Abschnitt 11). */
  function pruefeUeberStandorte(standorte, warn) {
    if (standorte.length < 2) return;
    const varianten = new Set(standorte.map((s) => s.d.variante));
    if (varianten.size > 1) throw new OfferteError("E403", [...varianten].sort().join(", "));

    const kunden = new Set(standorte.map((s) => txt(s.ctx, "kunde.firma")));
    if (kunden.size > 1) throw new OfferteError("E404", [...kunden].sort().join(", "));

    const laufzeiten = new Set(standorte.map((s) => Math.trunc(num(s.ctx, "laufzeit"))));
    if (laufzeiten.size > 1) warn.add("W310", [...laufzeiten].sort().join(", "));

    const versionen = new Set(standorte.map((s) => txt(s.ctx, "kalktool.version")));
    if (versionen.size > 1) warn.add("W311", [...versionen].sort().join(", "));
  }

  /** Formatierte Ausprägungen aller gesperrten Zellwerte (Abschnitt 13.2). */
  function gesperrteZeichenketten(standorte) {
    const out = new Set();
    for (const { ctx } of standorte) {
      for (const wert of ctx.gesperrt || []) {
        // Kleine Zahlen wie 1, 60 oder 0.6 kommen als Stückzahl, Laufzeit oder
        // Kalkulationsfaktor legitim vor und sind nicht unterscheidbar.
        if (Math.abs(wert) < 100) continue;
        for (const t of [FMT.chf(wert), FMT.rate(wert), FMT.intCh(wert)]) {
          out.add(t.replace("CHF ", "").trim());
        }
      }
    }
    return out;
  }

  /**
   * Sperrliste und Restplatzhalter im gerenderten Dokument.
   * Verglichen wird auf ganzen Zahltoken und nur gegen Werte, die der
   * Renderer nicht selbst gesetzt hat: 300 aus der gesperrten Zelle KM!M74
   * fände sonst einen Treffer im völlig legitimen CHF 300.00.
   */
  function pruefeAusgabe(text, gesperrt, gesetzt) {
    const imDokument = new Set(text.match(RE_ZAHL) || []);
    const treffer = [...gesperrt].filter((w) => !gesetzt.has(w) && imDokument.has(w)).sort();
    if (treffer.length) throw new OfferteError("E601", treffer.slice(0, 5).join(", "));
    const rest = RE_PLATZHALTER.exec(text);
    if (rest) throw new OfferteError("E602", rest[0]);
  }

  // --- Pipeline ---------------------------------------------------------

  function base64ZuBytes(b64) {
    const roh = atob(b64);
    const bytes = new Uint8Array(roh.length);
    for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
    return bytes;
  }

  /** Gelesene Werte, ohne ein Dokument zu erzeugen. */
  async function pruefen(dateien) {
    const warn = new Warnungen();
    const standorte = [];
    for (let i = 0; i < dateien.length; i++) {
      warn.standort = i + 1;
      const wb = await XLSX.oeffnen(await dateien[i].arrayBuffer());
      const ctx = EXTRACT.extract(wb, dateien[i].name, warn);
      ctx.index = i + 1;
      standorte.push({ ctx, d: DERIVE.derive(ctx, warn) });
    }
    warn.standort = null;
    for (const s of standorte) { warn.standort = s.ctx.index; pruefeEingabe(s.ctx, s.d); }
    warn.standort = null;
    pruefeUeberStandorte(standorte, warn);
    return { standorte, warn };
  }

  /** Vollständige Generierung; liefert Blob, Dateiname und Prüfprotokoll. */
  async function erzeugen(dateien, crmFelder) {
    const { standorte, warn } = await pruefen(dateien);
    const gesamt = DERIVE.gesamttotal(standorte);
    const crm = CRM.neu(crmFelder);

    // Vorlage öffnen und Ankerkatalog prüfen.
    const vorlage = await ZIP.lesen(base64ZuBytes(VORLAGE_BASE64).buffer);
    const doc = DOCX.parser.parseFromString(ZIP.text(vorlage, "word/document.xml"), "application/xml");
    if (doc.getElementsByTagName("parsererror").length) {
      throw new OfferteError("E101", "Vorlage nicht lesbar");
    }

    const gesetzt = RENDER.render(doc, standorte, gesamt, crm, warn);

    // Nachbearbeitung: TIME-Felder einfrieren (Abschnitt 12.2).
    const koerper = DOCX.alle(doc, "body")[0];
    DOCX.friereFelder(koerper, FMT.dateDe(standorte[0].ctx.values.datum));

    // Inhaltsverzeichnis neu aufbauen; ohne diesen Schritt bliebe der
    // zwischengespeicherte Stand der Vorlage stehen (Abschnitt 12.1).
    TOC.neuAufbauen(koerper);
    setzeUpdateFields(vorlage);
    warn.add("W321", "Word berechnet sie beim Öffnen");

    // Ausgabeprüfung, bevor eine Datei entsteht.
    const text = DOCX.alle(koerper, "p").map((p) => DOCX.knotenText(p)).join("\n");
    pruefeAusgabe(text, gesperrteZeichenketten(standorte), gesetzt);

    vorlage.set("word/document.xml", DOCX.serializer.serializeToString(doc));
    const blob = await ZIP.schreiben(vorlage, vorlage.reihenfolge);

    return {
      blob,
      dateiname: dateiname(standorte),
      standorte,
      warn,
      protokoll: protokoll(standorte, warn),
    };
  }

  function setzeUpdateFields(dateien) {
    const name = "word/settings.xml";
    if (!dateien.has(name)) return;
    let xml = ZIP.text(dateien, name);
    if (/<w:updateFields[^>]*\/>/.test(xml)) {
      xml = xml.replace(/<w:updateFields[^>]*\/>/, '<w:updateFields w:val="true"/>');
    } else {
      xml = xml.replace(/<\/w:settings>/, '<w:updateFields w:val="true"/></w:settings>');
    }
    dateien.set(name, xml);
  }

  function saeubern(text) {
    return String(text || "").replace(/[^\wÀ-ÿ.\-_ ]/g, "_").trim().replace(/\s+/g, "_");
  }

  function dateiname(standorte) {
    const ctx = standorte[0].ctx;
    const teile = ["Offerte", saeubern(txt(ctx, "kunde.firma")) || "Offerte"];
    const chance = saeubern(txt(ctx, "verkaufschance"));
    if (chance) teile.push(chance);
    return teile.join("_").slice(0, 150) + ".docx";
  }

  /** Begleitdatei mit allen Warnungen (Abschnitt 13.3). */
  function protokoll(standorte, warn) {
    const erste = standorte[0];
    const z = [
      `# Prüfprotokoll – ${dateiname(standorte)}`, "",
      "## Eingaben", "",
      `- Mapping: \`${MAPPING.version}\``,
      `- Standorte: ${standorte.length}`,
      ...standorte.map((s) => `  - ${s.ctx.index}. \`${s.ctx.quelle}\``),
      "", "## Abgeleitete Werte", "", "| Grösse | Wert |", "|---|---|",
      `| variante | \`${erste.d.variante}\` |`,
      `| laufzeit | ${FMT.intCh(num(erste.ctx, "laufzeit"))} Monate |`,
      `| kunde.firma | ${txt(erste.ctx, "kunde.firma")} |`,
      `| datum | ${FMT.dateDe(erste.ctx.values.datum)} |`,
      `| gueltig_bis | ${FMT.dateDe(erste.d.gueltigBis)} |`,
    ];
    for (const { ctx, d } of standorte) {
      z.push(`| Standort ${ctx.index} – einmalige Kosten | ${FMT.chf(d.dienstleistungTotal)} |`);
      z.push(d.variante === "KAUF"
        ? `| Standort ${ctx.index} – Vertragswert | ${FMT.chf(num(ctx, "vertragswert"))} |`
        : `| Standort ${ctx.index} – Monatspauschale total | ${FMT.chf(num(ctx, "monatspauschale_total"))} |`);
    }

    z.push("", "## Schalter", "", "| Schalter | Standort | Wert |", "|---|---|---|");
    for (const { ctx, d } of standorte) {
      for (const name of Object.keys(d.show).sort()) {
        z.push(`| show.${name} | ${ctx.index} | ${d.show[name] ? "wahr" : "falsch"} |`);
      }
    }

    z.push("", "## Warnungen", "");
    if (warn.items.length) {
      z.push("| Code | Standort | Bedeutung | Detail |", "|---|---|---|---|");
      for (const w of warn.items) {
        z.push(`| \`${w.code}\` | ${w.standort || "–"} | ${w.bedeutung} | ${w.detail || "–"} |`);
      }
    } else {
      z.push("Keine Warnungen.");
    }

    z.push("", "## Prüfungen", "",
      "- Sperrliste (E601): keine Treffer im gerenderten Dokument.",
      "- Restplatzhalter (E602): keine gefunden.",
      `- Doppelzählungssperre (E402): geprüft für alle ${standorte.length} Standorte.`, "");
    return z.join("\n");
  }

  return { pruefen, erzeugen, pruefeAusgabe, gesperrteZeichenketten };
})();
