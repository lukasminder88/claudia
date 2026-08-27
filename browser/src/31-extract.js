/* Warnungen, Fehler und Extraktion (Abschnitte 4, 6, 13). */

const ERROR_TEXTS = {
  E101: "Anker aus Abschnitt 3.2 fehlt in der Vorlage",
  E201: "Kalktool nicht lesbar oder Blattanzahl < 2",
  E202: "Kalktool-Version unbekannt und Layout passt zu keinem Mapping",
  E211: "Zelle aus dem Feldkatalog ausserhalb des Blattbereichs",
  E212: "Pflichtfeld im Kalktool ist leer",
  E401: "finanzierungsart leer oder nicht in 1-5",
  E402: "L95 != L92 + L93 + L94 (Toleranz 0.01)",
  E403: "Gemischte Finanzierungsarten über mehrere Standorte",
  E404: "Unterschiedliche Kunden über mehrere Standorte",
  E411: "laufzeit leer oder <= 0 bei MIETE/LEASING",
  E412: "Kein Hardwareartikel mit Bezeichnung",
  E413: "MIETE/LEASING und L92 = 0",
  E414: "KAUF und C62 = 0",
  E601: "Wert aus der Sperrliste im gerenderten Dokument",
  E602: "Unaufgelöster Platzhalter im gerenderten Dokument",
};

const WARNING_TEXTS = {
  W301: "PLZ/Ort nicht trennbar",
  W302: "Mail oder Telefon in J5 nicht gefunden",
  W303: "Name in J5 mehrdeutig",
  W304: "Vertragsbeginn in A100 nicht parsbar",
  W305: "Offertnummer aus CRM fehlt, Verkaufschance eingesetzt",
  W306: "Offertversion fehlt, 1.0 eingesetzt",
  W307: "C53 != Summe der Listenpreise, Stückzahl nicht belegbar",
  W308: "M9 liefert TODAY() statt eines eingefrorenen Datums",
  W309: "standort.name leer",
  W310: "Unterschiedliche Laufzeiten über mehrere Standorte",
  W311: "Unterschiedliche Kalktool-Versionen",
  W312: "#DIV/0! in H32 oder H39 (rein intern, ohne Wirkung auf die Offerte)",
  W313: "Kalktool-Version unbekannt; Layout stimmt mit einem bekannten Mapping überein",
  W314: "Beschriftung im Kalktool weicht vom erwarteten Layout ab",
  W315: "Installationsadresse fehlt, Zeile entfällt",
  W316: "Weder Offertnummer noch Verkaufschance vorhanden, Strich eingesetzt",
  W317: "Standortname verweist auf den Kunden, Kundenname eingesetzt",
  W320: "Blattname weicht vom erwarteten Namen ab",
  W321: "Seitenzahlen im Inhaltsverzeichnis werden von Word beim Öffnen berechnet",
};

class OfferteError extends Error {
  constructor(code, detail = "") {
    super(`${code}: ${ERROR_TEXTS[code] || "Unbekannter Fehler"}${detail ? " – " + detail : ""}`);
    this.code = code;
    this.detail = detail;
    this.bedeutung = ERROR_TEXTS[code] || "Unbekannter Fehler";
  }
}

class Warnungen {
  constructor() { this.items = []; this.standort = null; }
  add(code, detail = "") {
    const w = { code, detail, standort: this.standort, bedeutung: WARNING_TEXTS[code] || "" };
    if (!this.items.some((x) => x.code === w.code && x.detail === w.detail && x.standort === w.standort)) {
      this.items.push(w);
    }
  }
  codes() { return [...new Set(this.items.map((w) => w.code))]; }
}

const EXTRACT = (() => {
  "use strict";

  const SHEET_INDEX = { KM: 0, SOL: 1 };

  function ref(adresse) {
    const [blatt, a1] = adresse.split("!");
    return { blatt, a1, index: SHEET_INDEX[blatt] ?? 0 };
  }

  const istFehler = (v) => typeof v === "string" && v.trim().startsWith("#");

  function zahl(v) {
    return istFehler(v) ? 0 : FMT.zahl(v);
  }

  /** Spaltenbuchstabe -> Nummer */
  function spalte(b) {
    let n = 0;
    for (const z of b) n = n * 26 + (z.charCodeAt(0) - 64);
    return n;
  }

  function bereich(text) {
    const [blatt, spanne] = text.split("!");
    const [von, bis] = spanne.split(":");
    const a = XLSX.adresse(von), b = XLSX.adresse(bis);
    return { blatt, index: SHEET_INDEX[blatt] ?? 0,
             z1: a.zeile, s1: a.spalte, z2: b.zeile, s2: b.spalte };
  }

  // Punkte und Leerzeichen sind hier bedeutungslos: "s. o." und "s.o." meinen
  // dasselbe.
  const DITO = new Set(["dito", "ditto", "dto", "idem", "so", "sieheoben", "wieoben", "gleich"]);

  /** „dito“ als Standortname durch den Kundennamen ersetzen. */
  function standortDito(ctx, warn) {
    const name = FMT.trim(ctx.values["standort.name"]);
    if (!DITO.has(name.replace(/[.\s]+/g, "").toLowerCase())) return;
    const kunde = FMT.trim(ctx.values["kunde.firma"]);
    if (!kunde) return;
    ctx.values["standort.name"] = kunde;
    warn.add("W317", `"${name}" -> "${kunde}"`);
  }

  /** Beschriftungen vergleichbar machen: Leerraum und Gross-/Kleinschreibung. */
  function vergleichbar(text) {
    return String(text ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  /** Layoutmarken prüfen: passt das Kalktool überhaupt zu diesem Mapping?

     Bei bekannter Version fällt ein umgebautes Kalktool als W314 auf, statt
     still falsche Zellen zu liefern. Bei unbekannter Version entscheidet
     allein das Layout: stimmt es, wird mit W313 weitergearbeitet, sonst
     bricht E202 ab, bevor irgendetwas gerendert wird. */
  function pruefeLayout(lies, warn) {
    const marken = MAPPING.layout_marken || {};
    const abweichungen = [];
    for (const [adresse, erwartet] of Object.entries(marken)) {
      let ist = null;
      try { ist = lies(adresse); } catch (e) { ist = null; }
      if (vergleichbar(ist) !== vergleichbar(erwartet)) {
        abweichungen.push(`${adresse}: erwartet "${erwartet}", gefunden "${ist ?? ""}"`);
      }
    }

    const versionText = String(lies(MAPPING.fields["kalktool.version"].cell) ?? "").trim();
    const bekannt = MAPPING.version && versionText.includes(MAPPING.version);
    if (bekannt) {
      if (abweichungen.length) warn.add("W314", abweichungen.slice(0, 3).join("; "));
      return;
    }
    if (abweichungen.length) {
      throw new OfferteError(
        "E202",
        `${versionText || "ohne Versionsangabe"}: das Layout stimmt mit keinem ` +
          `bekannten Mapping überein – ${abweichungen.slice(0, 3).join("; ")}`,
      );
    }
    warn.add("W313", `${versionText || "ohne Angabe"} → Mapping ${MAPPING.version}`);
  }

  /** Alle Felder und Positionslisten eines Kalktools lesen. */
  function extract(wb, quelle, warn) {
    // Blattnamen nur als Warnung prüfen (Abschnitt 2.2).
    for (const [schluessel, spez] of Object.entries(MAPPING.sheets)) {
      const name = wb.blattName(spez.index);
      if (spez.expect_name && name !== spez.expect_name) {
        warn.add("W320", `${schluessel}: erwartet "${spez.expect_name}", gefunden "${name}"`);
      }
    }
    if (wb.blaetter.length < 2) throw new OfferteError("E201", quelle);

    const ctx = { quelle, index: 1, values: {}, listen: {}, probes: {} };
    const lies = (adresse) => { const r = ref(adresse); return wb.zelle(r.index, r.a1); };

    pruefeLayout(lies, warn);

    for (const [name, spez] of Object.entries(MAPPING.fields)) {
      ctx.values[name] = lies(spez.cell);
    }

    ctx.values["kunde.plz_ort"] = PARSE.plzOrt(ctx.values["kunde.plz_ort_roh"], warn, "kunde");
    ctx.values["standort.plz_ort"] = PARSE.plzOrt(ctx.values["standort.plz_ort_roh"], warn, "standort");
    ctx.values["kunde.kontakt"] = PARSE.kontakt(ctx.values["kunde.kontakt_roh"], warn);
    standortDito(ctx, warn);
    ctx.values["vertragsbeginn"] = PARSE.vertragsbeginn(ctx.values["vertragsbeginn_roh"], warn);

    // Ob M9 eine TODAY()-Formel trägt, ist aus den Werten allein nicht
    // erkennbar; die Formel steht im Blatt-XML und wird dort geprüft.
    if (wb.hatFormel && wb.hatFormel(ref(MAPPING.fields.datum.cell).index,
                                     ref(MAPPING.fields.datum.cell).a1, "TODAY")) {
      warn.add("W308", "KM!M9 enthält =TODAY()");
    }

    for (const [name, adresse] of Object.entries(MAPPING.probes || {})) {
      ctx.probes[name] = lies(adresse);
    }
    if (istFehler(ctx.probes["divzero.hw"]) || istFehler(ctx.probes["divzero.sw"])) {
      warn.add("W312", "Rabattsatz ohne Listenpreis");
    }

    for (const [name, spez] of Object.entries(MAPPING.lists)) {
      ctx.listen[name] = spez.layout === "paired"
        ? paare(wb, spez)
        : zeilen(wb, spez);
    }

    stueckPruefen(ctx, wb, warn);
    ctx.gesperrt = gesperrteWerte(wb);
    return ctx;
  }

  function zellenWert(wb, b, zeile, spaltenBuchstabe) {
    return wb.zelle(b.index, spaltenBuchstabe + zeile);
  }

  function zeilen(wb, spez) {
    const b = bereich(spez.range);
    const out = [];
    for (let z = b.z1; z <= b.z2; z++) {
      const bez = FMT.trim(zellenWert(wb, b, z, spez.cols.bezeichnung));
      if (!bez || bez === "Support :") continue;

      const betragsSpalte = spez.cols.netto || spez.cols.total || spez.cols.listenpreis;
      const betrag = zahl(zellenWert(wb, b, z, betragsSpalte));
      const filtert = (spez.skip_if || []).some((r) => r.includes("<= 0"));
      if (filtert && betrag <= 0) continue;

      const anzahlSpalte = spez.cols.anzahl || spez.cols.stunden;
      const anzahl = anzahlSpalte ? zellenWert(wb, b, z, anzahlSpalte) : null;
      const artnr = FMT.trim(spez.cols.artnr ? zellenWert(wb, b, z, spez.cols.artnr) : "") || "–";
      const stueck = (anzahl !== null && anzahl !== "" && anzahl !== 0)
        ? FMT.trim(anzahl)
        : (spez.stueck_fix ? String(spez.stueck_fix) : "");

      const extra = {};
      if (spez.cols.listenpreis) extra.listenpreis = zahl(zellenWert(wb, b, z, spez.cols.listenpreis));
      out.push({ bezeichnung: bez, artnr, stueck, betrag, extra });
    }
    return out;
  }

  /** Blockstruktur "dienstleistung": Zeile n = Label, Zeile n+1 = Beträge. */
  function paare(wb, spez) {
    const b = bereich(spez.range);
    const nutz = spez.cols[spez.use_col || "verrechnet"];
    const overrides = spez.label_override || {};
    const out = [];
    let z = b.z1;
    while (z < b.z2) {
      const roh = zellenWert(wb, b, z, nutz);
      const label = FMT.trim(roh);
      if (!label || typeof roh === "number") { z += 1; continue; }

      const betrag = zahl(zellenWert(wb, b, z + 1, nutz));
      if (betrag > 0) {
        let sauber = overrides[label];
        if (sauber === undefined) {
          sauber = spez.label_fmt === "label_clean" ? FMT.labelClean(roh) : label;
        }
        out.push({ bezeichnung: sauber, artnr: "–", stueck: "", betrag, extra: {} });
      }
      z += 2;
    }
    return out;
  }

  /** KM!C53 == sum(KM!C27:C52) plausibilisieren (Abschnitt 5.5). */
  function stueckPruefen(ctx, wb, warn) {
    const spez = MAPPING.lists.hardware;
    if (!spez || !spez.stueck_check) return;
    const total = zahl(ctx.probes.stueck_summe);
    const summe = (ctx.listen.hardware || []).reduce((s, p) => s + (p.extra.listenpreis || 0), 0);
    ctx.probes.stueck_belegbar = Math.abs(total - summe) <= 0.01;
    if (!ctx.probes.stueck_belegbar) warn.add("W307", "Stückzahl nicht belegbar");
  }

  /** Werte der Sperrliste – Grundlage der Ausgabeprüfung E601. */
  function gesperrteWerte(wb) {
    const out = [];
    for (const eintrag of MAPPING.blocked || []) {
      if (eintrag.includes(":")) {
        const b = bereich(eintrag);
        for (let z = b.z1; z <= b.z2; z++) {
          for (let s = b.s1; s <= b.s2; s++) {
            const v = wb.zelle(b.index, XLSX.spaltenName(s) + z);
            if (typeof v === "number") out.push(v);
          }
        }
      } else {
        const r = ref(eintrag);
        const v = wb.zelle(r.index, r.a1);
        if (typeof v === "number") out.push(v);
      }
    }
    return out;
  }

  return { extract, ref, zahl, bereich, spalte, standortDito, pruefeLayout };
})();
