/* Offerttool – Oberfläche.
   Kein Framework, kein Build-Schritt. Die Datei spricht ausschliesslich mit
   /api und trifft keine Entscheidung über den Inhalt der Offerte. */

"use strict";

const $ = (id) => document.getElementById(id);

const ablage = $("ablage");
const dateiwahl = $("dateiwahl");
const liste = $("liste");
const ergebnis = $("ergebnis");
const knopfPruefen = $("pruefen");
const knopfErzeugen = $("erzeugen");

const CRM = ["offertnummer", "offertversion", "anrede", "vorname", "nachname",
             "vk_funktion", "vk_email", "vk_telefon"];

/** Gewählte Kalktools; die Reihenfolge ist die Reihenfolge der Standorte. */
let dateien = [];
let letzterAuftrag = null;

// --------------------------------------------------------------- Auswahl

function hinzufuegen(neue) {
  for (const datei of neue) {
    const schonDa = dateien.some(
      (d) => d.name === datei.name && d.size === datei.size
    );
    if (!schonDa) dateien.push(datei);
  }
  zeichneListe();
}

function zeichneListe() {
  liste.innerHTML = "";
  dateien.forEach((datei, i) => {
    const li = document.createElement("li");

    const nr = document.createElement("span");
    nr.className = "nummer";
    nr.textContent = i + 1;

    const name = document.createElement("span");
    name.className = "dateiname";
    name.textContent = datei.name;
    name.title = datei.name;

    const groesse = document.createElement("span");
    groesse.className = "dateigroesse";
    groesse.textContent = (datei.size / 1024).toFixed(0) + " kB";

    li.append(nr, name, groesse,
      mini("↑", "Nach oben", i === 0, () => tausche(i, i - 1)),
      mini("↓", "Nach unten", i === dateien.length - 1, () => tausche(i, i + 1)),
      mini("×", "Entfernen", false, () => { dateien.splice(i, 1); zeichneListe(); }));
    liste.append(li);
  });

  $("reihenfolge-hinweis").classList.toggle("versteckt", dateien.length < 2);
  knopfPruefen.disabled = knopfErzeugen.disabled = dateien.length === 0;
}

function mini(zeichen, titel, deaktiviert, bei) {
  const b = document.createElement("button");
  b.className = "mini";
  b.type = "button";
  b.textContent = zeichen;
  b.title = titel;
  b.setAttribute("aria-label", titel);
  b.disabled = deaktiviert;
  b.onclick = bei;
  return b;
}

function tausche(a, b) {
  [dateien[a], dateien[b]] = [dateien[b], dateien[a]];
  zeichneListe();
}

ablage.onclick = () => dateiwahl.click();
ablage.onkeydown = (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dateiwahl.click(); }
};
dateiwahl.onchange = () => { hinzufuegen(dateiwahl.files); dateiwahl.value = ""; };

["dragenter", "dragover"].forEach((art) =>
  ablage.addEventListener(art, (e) => {
    e.preventDefault();
    ablage.classList.add("aktiv");
  }));
["dragleave", "drop"].forEach((art) =>
  ablage.addEventListener(art, (e) => {
    e.preventDefault();
    ablage.classList.remove("aktiv");
  }));
ablage.addEventListener("drop", (e) => hinzufuegen(e.dataTransfer.files));

// --------------------------------------------------------------- Senden

function formular() {
  const f = new FormData();
  for (const datei of dateien) f.append("dateien", datei, datei.name);
  return f;
}

async function senden(pfad, mitFeldern) {
  const f = formular();
  if (mitFeldern) {
    for (const feld of CRM) f.append(feld, $(feld).value.trim());
    f.append("seitenzahlen", $("seitenzahlen").checked ? "true" : "false");
    f.append("datenblaetter", $("datenblaetter").checked ? "true" : "false");
    f.append("spezifikation", $("spezifikation").checked ? "true" : "false");
  }
  const antwort = await fetch(pfad, { method: "POST", body: f });
  const inhalt = await antwort.json().catch(() => ({}));
  if (!antwort.ok) throw inhalt;
  return inhalt;
}

function laden(knopf, text) {
  knopf.dataset.text = knopf.textContent;
  knopf.innerHTML = `<span class="lader"></span>${text}`;
  knopfPruefen.disabled = knopfErzeugen.disabled = true;
}

function fertig(knopf) {
  knopf.textContent = knopf.dataset.text;
  knopfPruefen.disabled = knopfErzeugen.disabled = dateien.length === 0;
}

knopfPruefen.onclick = async () => {
  laden(knopfPruefen, "Wird gelesen …");
  try {
    zeigeVorschau(await senden("/api/pruefen", false));
  } catch (e) {
    zeigeFehler(e);
  } finally {
    fertig(knopfPruefen);
  }
};

knopfErzeugen.onclick = async () => {
  laden(knopfErzeugen, "Wird erzeugt …");
  try {
    const daten = await senden("/api/erzeugen", true);
    letzterAuftrag = daten.auftrag;
    zeigeOfferte(daten);
  } catch (e) {
    zeigeFehler(e);
  } finally {
    fertig(knopfErzeugen);
  }
};

// --------------------------------------------------------------- Anzeige

const el = (tag, klasse, text) => {
  const n = document.createElement(tag);
  if (klasse) n.className = klasse;
  if (text !== undefined) n.textContent = text;
  return n;
};

function tabelle(paare) {
  const t = el("table", "werte");
  for (const [name, wert] of paare) {
    if (wert === null || wert === undefined || wert === "") continue;
    const tr = el("tr");
    tr.append(el("th", null, name), el("td", null, wert));
    t.append(tr);
  }
  return t;
}

function kopfKachel(kopf) {
  const k = el("div", "kachel");
  const titel = el("h3");
  titel.append(el("span", "marke", kopf.variante), " " + kopf.kunde);
  k.append(titel, tabelle([
    ["Ort", kopf.kundenort],
    ["Verkäufer", kopf.verkaeufer],
    ["Verkaufschance", kopf.verkaufschance],
    ["Laufzeit", kopf.variante === "KAUF" ? null : kopf.laufzeit + " Monate"],
    ["Offertdatum", kopf.datum],
    ["Gültig bis", kopf.gueltig_bis],
    ["Standorte", String(kopf.anzahl_standorte)],
    ["Kalktool", kopf.kalktool_version],
  ]));
  return k;
}

function standortBlock(s) {
  const d = el("details", "standort");
  if (s.index === 1) d.open = true;

  const summary = el("summary");
  summary.append(
    el("span", null, `Standort ${s.index}: ${s.name || "ohne Namen"}`),
    el("span", "dateigroesse", s.monatlich || s.kaufpreis || "")
  );

  const inhalt = el("div", "inhalt");
  inhalt.append(tabelle([
    ["Quelle", s.quelle],
    ["Installationsadresse", s.adresse],
    ["Gerät", s.geraet],
    ["Positionen", s.hardware.join(", ")],
    ["Einmalige Kosten", s.einmalig],
    ["Monatspauschale total", s.monatlich],
    ["Total Kauf", s.kaufpreis],
  ]));

  const schalter = el("div", "schalterliste");
  for (const [name, an] of Object.entries(s.schalter)) {
    schalter.append(el("span", an ? "an" : null, name));
  }
  inhalt.append(schalter);

  d.append(summary, inhalt);
  return d;
}

function warnungsKachel(warnungen) {
  if (!warnungen.length) {
    const k = el("div", "kachel gut");
    k.append(el("h3", null, "Keine Warnungen"));
    return k;
  }
  const k = el("div", "kachel warn");
  k.append(el("h3", null,
    `${warnungen.length} Warnung${warnungen.length === 1 ? "" : "en"}`));
  const t = el("table", "werte");
  for (const w of warnungen) {
    const tr = el("tr");
    const th = el("th");
    th.append(el("code", null, w.code));
    if (w.standort) th.append(" · Standort " + w.standort);
    const td = el("td", null, w.bedeutung + (w.detail ? ` – ${w.detail}` : ""));
    tr.append(th, td);
    t.append(tr);
  }
  k.append(t, el("p", "hinweis",
    "Warnungen stehen auch im Prüfprotokoll – nie im Dokument selbst."));
  return k;
}

function zeigeVorschau(daten) {
  ergebnis.innerHTML = "";
  ergebnis.append(
    el("p", "hinweis", "Gelesene Werte. Es wurde noch kein Dokument erzeugt."),
    kopfKachel(daten.kopf),
    ...daten.standorte.map(standortBlock),
    warnungsKachel(daten.warnungen)
  );
}

function zeigeOfferte(daten) {
  ergebnis.innerHTML = "";

  const fertig = el("div", "kachel gut");
  fertig.append(el("h3", null, "Offerte erzeugt"), el("p", "hinweis",
    "Das Ergebnis liegt 30 Minuten zum Abholen bereit und wird danach vom Server gelöscht."));

  const download = el("div", "download");
  const a = el("a", null, "Offerte herunterladen");
  a.href = `/api/holen/${daten.auftrag}/offerte`;
  const b = el("a", "zweitrangig", "Prüfprotokoll");
  b.href = `/api/holen/${daten.auftrag}/protokoll`;
  download.append(a, b);
  fertig.append(download);

  ergebnis.append(
    fertig,
    kopfKachel(daten.kopf),
    ...daten.standorte.map(standortBlock),
    warnungsKachel(daten.warnungen)
  );
}

function zeigeFehler(e) {
  ergebnis.innerHTML = "";
  const k = el("div", "kachel fehler");

  if (e && e.fehler) {
    k.append(el("h3", null, "Abbruch – es wurde keine Datei erzeugt"));
    const t = el("table", "werte");
    const tr = el("tr");
    const th = el("th");
    th.append(el("code", null, e.fehler.code));
    tr.append(th, el("td", null, e.fehler.bedeutung));
    t.append(tr);
    if (e.fehler.detail) {
      const tr2 = el("tr");
      tr2.append(el("th", null, "Detail"), el("td", null, e.fehler.detail));
      t.append(tr2);
    }
    k.append(t, el("p", "hinweis",
      "Der Generator bricht ab, statt eine halbe Offerte zu schreiben. " +
      "Bitte den genannten Wert im Kalktool prüfen."));
  } else {
    k.append(
      el("h3", null, "Fehlgeschlagen"),
      el("p", null, (e && (e.detail || e.message)) || "Unbekannter Fehler.")
    );
  }
  ergebnis.append(k);
}

// --------------------------------------------------------------- Status

fetch("/api/gesundheit")
  .then((r) => r.json())
  .then((g) => {
    $("status").textContent = "Version " + g.version;
    $("fuss-status").textContent = g.seitenzahlen_moeglich
      ? "Seitenzahlen im Inhaltsverzeichnis werden berechnet."
      : "Ohne LibreOffice auf dem Server: Verzeichnis ohne Seitenzahlen (W321).";

    // Ohne hinterlegte Datenblätter haben die beiden Kästchen keine Wirkung.
    const anzahl = g.datenblaetter || 0;
    $("datenblaetter-hinweis").textContent = anzahl
      ? `${anzahl} Datenblätter hinterlegt, je Gerät rund drei Seiten`
      : "keine Datenblätter auf dem Server hinterlegt";
    if (!anzahl) {
      $("datenblaetter").checked = false;
      $("datenblaetter").disabled = true;
      $("spezifikation").disabled = true;
    }
    const umschalten = () => {
      $("schalter-spezifikation").style.opacity = $("datenblaetter").checked ? "1" : ".45";
      $("spezifikation").disabled = !anzahl || !$("datenblaetter").checked;
    };
    $("datenblaetter").onchange = umschalten;
    umschalten();
    if (!g.seitenzahlen_moeglich) {
      $("seitenzahlen").checked = false;
      $("seitenzahlen").disabled = true;
    }
  })
  .catch(() => { $("status").textContent = "Server nicht erreichbar"; });

zeichneListe();
