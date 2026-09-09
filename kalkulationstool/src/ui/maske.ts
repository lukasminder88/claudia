/** Eingabemaske - Aufbau nach dem Blatt "Kalkulation" der Vorlage. */

import {
  leereDienstleistungsPosition,
  leereHardwarePosition,
  leereSolutionsPosition,
  leereZusatzPosition,
  VERTRAGSART,
  type DienstleistungsPosition,
  type Eingabe,
  type FaktLeasing,
  type SolutionsPosition,
  type Vertragsart,
} from "../engine";
import { liste, t, type Sprache } from "../i18n";
import { abschnitt, auswahlfeld, el, knopf, prozentfeld, schalter, zahlenfeld } from "./bausteine";

interface Umgebung {
  sprache: Sprache;
  eingabe: Eingabe;
  /** Nur neu rechnen und den Ergebnisbereich auffrischen. Die Felder bleiben stehen. */
  aktualisieren: () => void;
  /** Maske komplett neu aufbauen - nur bei Zeilen, die dazukommen oder wegfallen. */
  neuZeichnen: () => void;
}

function uebersetze(sprache: Sprache, schluessel: string): string {
  return t(sprache, schluessel);
}

/** Tabelle mit beliebig vielen Zeilen und einer Schaltflaeche zum Anhaengen. */
function zeilenTabelle(
  kopf: string[],
  zeilen: HTMLElement[],
  anhaengen: { text: string; beiKlick: () => void },
  leerText: string,
): HTMLElement {
  const koerper = el("tbody", {}, zeilen);
  const tabelle = el("table", { klasse: "positionen" }, [
    el("thead", {}, [el("tr", {}, kopf.map((text) => el("th", { text })))]),
    koerper,
  ]);
  const inhalt: Node[] = zeilen.length > 0 ? [tabelle] : [el("p", { klasse: "leer", text: leerText })];
  return el("div", { klasse: "tabelle" }, [
    ...inhalt,
    knopf(anhaengen.text, anhaengen.beiKlick, "sekundaer"),
  ]);
}

function zelle(inhalt: Node): HTMLElement {
  return el("td", {}, [inhalt]);
}

function zahlZelle(
  wert: number,
  beiAenderung: (wert: number) => void,
  schritt = "0.01",
): HTMLElement {
  const feld = el("input", {
    klasse: "zahl",
    attribute: { type: "number", step: schritt, value: String(wert), inputmode: "decimal" },
  });
  feld.addEventListener("input", () => {
    const zahl = Number.parseFloat(feld.value.replace(",", "."));
    beiAenderung(Number.isFinite(zahl) ? zahl : 0);
  });
  return zelle(feld);
}

function textZelle(wert: string, beiAenderung: (wert: string) => void): HTMLElement {
  const feld = el("input", { attribute: { type: "text", value: wert } });
  feld.addEventListener("input", () => beiAenderung(feld.value));
  return zelle(feld);
}

function auswahlZelle(
  eintraege: { wert: string; text: string }[],
  wert: string,
  beiAenderung: (wert: string) => void,
): HTMLElement {
  const feld = el("select", {});
  for (const eintrag of eintraege) {
    const option = el("option", { text: eintrag.text, attribute: { value: eintrag.wert } });
    if (eintrag.wert === wert) option.setAttribute("selected", "selected");
    feld.append(option);
  }
  feld.addEventListener("change", () => beiAenderung(feld.value));
  return zelle(feld);
}

/**
 * Netto-Preis einer Solutions-Zeile. Leer bedeutet: Formel der Vorlage, also
 * Netto = Listenpreis. Eine Zahl ist eine bewusste Uebersteuerung.
 */
function nettoZelle(position: SolutionsPosition, umgebung: Umgebung): HTMLElement {
  const feld = el("input", {
    klasse: "zahl",
    attribute: {
      type: "number",
      step: "0.01",
      inputmode: "decimal",
      placeholder: uebersetze(umgebung.sprache, "feld.nettoPreisFormel"),
      value: position.nettoPreis === null ? "" : String(position.nettoPreis),
    },
  });
  feld.addEventListener("input", () => {
    const roh = feld.value.trim();
    const zahl = Number.parseFloat(roh.replace(",", "."));
    position.nettoPreis = roh === "" || !Number.isFinite(zahl) ? null : zahl;
    umgebung.aktualisieren();
  });
  return zelle(feld);
}

function entfernenZelle(beiKlick: () => void, text: string): HTMLElement {
  return zelle(knopf(text, beiKlick, "entfernen"));
}

// ------------------------------------------------------------------ Vertrag

function vertragsAbschnitt(umgebung: Umgebung): HTMLElement {
  const { sprache, eingabe, aktualisieren, neuZeichnen } = umgebung;
  const arten = Object.values(VERTRAGSART);

  const auswahl = el("div", { klasse: "vertragsarten" });
  for (const art of arten) {
    const id = `vertragsart-${art}`;
    const feld = el("input", { attribute: { type: "radio", name: "vertragsart", id, value: String(art) } });
    feld.checked = eingabe.vertrag.art === art;
    feld.addEventListener("change", () => {
      eingabe.vertrag.art = art as Vertragsart;
      neuZeichnen();
    });
    auswahl.append(
      el("label", { klasse: "vertragsart", attribute: { for: id } }, [
        feld,
        uebersetze(sprache, `vertragsart.${art}`),
      ]),
    );
  }

  const felder: Node[] = [
    el("div", { klasse: "feld feld-breit" }, [
      el("label", { text: uebersetze(sprache, "feld.vertragsart") }),
      auswahl,
    ]),
    auswahlfeld(
      uebersetze(sprache, "feld.laufzeit"),
      liste(sprache, "lstLaufzeit").map((e) => ({ wert: String(e.wert), text: `${e.text}` })),
      String(eingabe.vertrag.laufzeitMonate),
      (wert) => {
        eingabe.vertrag.laufzeitMonate = Number(wert);
        aktualisieren();
      },
    ),
    schalter(
      uebersetze(sprache, "feld.kam"),
      eingabe.vertrag.kam,
      (wert) => {
        eingabe.vertrag.kam = wert;
        aktualisieren();
      },
      uebersetze(sprache, "feld.kamHinweis"),
    ),
    schalter(uebersetze(sprache, "feld.verlaengerungNew"), eingabe.vertrag.verlaengerungNew, (wert) => {
      eingabe.vertrag.verlaengerungNew = wert;
      aktualisieren();
    }),
  ];

  if (eingabe.vertrag.art === VERTRAGSART.leasing) {
    felder.push(
      auswahlfeld(
        uebersetze(sprache, "feld.faktLeasing"),
        liste(sprache, "lstFaktLeasing").map((e) => ({ wert: String(e.wert), text: e.text })),
        eingabe.vertrag.faktLeasing,
        (wert) => {
          eingabe.vertrag.faktLeasing = wert as FaktLeasing;
          aktualisieren();
        },
      ),
    );
  }
  if (eingabe.vertrag.art === VERTRAGSART.spezialMiete) {
    felder.push(
      zahlenfeld(
        uebersetze(sprache, "feld.faktorSpezialMiete"),
        eingabe.vertrag.faktorSpezialMiete,
        (wert) => {
          eingabe.vertrag.faktorSpezialMiete = wert;
          aktualisieren();
        },
        { schritt: "0.000001" },
      ),
    );
  }
  if (eingabe.vertrag.art === VERTRAGSART.spezialLeasing) {
    felder.push(
      zahlenfeld(
        uebersetze(sprache, "feld.faktorSpezialLeasing"),
        eingabe.vertrag.faktorSpezialLeasing,
        (wert) => {
          eingabe.vertrag.faktorSpezialLeasing = wert;
          aktualisieren();
        },
        { schritt: "0.000001" },
      ),
    );
  }

  return abschnitt(uebersetze(sprache, "abschnitt.vertrag"), [el("div", { klasse: "raster" }, felder)]);
}

// ----------------------------------------------------------------- Hardware

function hardwareAbschnitt(umgebung: Umgebung): HTMLElement {
  const { sprache, eingabe, aktualisieren, neuZeichnen } = umgebung;
  const kalkulationsarten = liste(sprache, "lstKalkHW").map((e) => ({
    wert: String(e.wert),
    text: `${Math.round(Number(e.wert) * 100)} %`,
  }));

  const zeilen = eingabe.hardware.positionen.map((position, index) =>
    el("tr", {}, [
      textZelle(position.bezeichnung, (wert) => {
        position.bezeichnung = wert;
      }),
      zahlZelle(position.listenpreis, (wert) => {
        position.listenpreis = wert;
        aktualisieren();
      }),
      auswahlZelle(kalkulationsarten, String(position.kalkulationsart), (wert) => {
        position.kalkulationsart = Number(wert);
        aktualisieren();
      }),
      entfernenZelle(() => {
        eingabe.hardware.positionen.splice(index, 1);
        neuZeichnen();
      }, uebersetze(sprache, "app.zeileEntfernen")),
    ]),
  );

  return abschnitt(uebersetze(sprache, "abschnitt.hardware"), [
    zeilenTabelle(
      [
        uebersetze(sprache, "feld.bezeichnung"),
        uebersetze(sprache, "feld.listenpreis"),
        uebersetze(sprache, "feld.kalkulationsart"),
        "",
      ],
      zeilen,
      {
        text: uebersetze(sprache, "app.zeileHinzufuegen"),
        beiKlick: () => {
          eingabe.hardware.positionen.push(leereHardwarePosition());
          neuZeichnen();
        },
      },
      uebersetze(sprache, "app.keineZeilen"),
    ),
    el("div", { klasse: "raster" }, [
      prozentfeld(uebersetze(sprache, "feld.rabattsatz"), eingabe.hardware.rabattsatz, (wert) => {
        eingabe.hardware.rabattsatz = wert;
        aktualisieren();
      }),
      prozentfeld(uebersetze(sprache, "feld.supportSatz"), eingabe.hardware.supportSatz, (wert) => {
        eingabe.hardware.supportSatz = wert;
        aktualisieren();
      }),
      zahlenfeld(uebersetze(sprache, "feld.supportPauschale"), eingabe.hardware.supportPauschale, (wert) => {
        eingabe.hardware.supportPauschale = wert;
        aktualisieren();
      }),
    ]),
  ]);
}

// ---------------------------------------------------------------- Solutions

function solutionsTabelle(
  umgebung: Umgebung,
  positionen: SolutionsPosition[],
  titelSchluessel: string,
): HTMLElement {
  const { sprache, aktualisieren, neuZeichnen } = umgebung;
  const kalkulationsarten = liste(sprache, "lstKalkSW").map((e) => ({
    wert: String(e.wert),
    text: `${Math.round(Number(e.wert) * 100)} %`,
  }));

  const zeilen = positionen.map((position, index) =>
    el("tr", {}, [
      zahlZelle(
        position.anzahl,
        (wert) => {
          position.anzahl = wert;
          aktualisieren();
        },
        "1",
      ),
      textZelle(position.artikelNr, (wert) => {
        position.artikelNr = wert;
      }),
      textZelle(position.bezeichnung, (wert) => {
        position.bezeichnung = wert;
      }),
      zahlZelle(position.listenpreisProArtikel, (wert) => {
        position.listenpreisProArtikel = wert;
        aktualisieren();
      }),
      auswahlZelle(kalkulationsarten, String(position.kalkulationsart), (wert) => {
        position.kalkulationsart = Number(wert);
        aktualisieren();
      }),
      nettoZelle(position, umgebung),
      entfernenZelle(() => {
        positionen.splice(index, 1);
        neuZeichnen();
      }, uebersetze(sprache, "app.zeileEntfernen")),
    ]),
  );

  return abschnitt(uebersetze(sprache, titelSchluessel), [
    zeilenTabelle(
      [
        uebersetze(sprache, "feld.anzahl"),
        uebersetze(sprache, "feld.artikelNr"),
        uebersetze(sprache, "feld.bezeichnung"),
        uebersetze(sprache, "feld.listenpreisProArtikel"),
        uebersetze(sprache, "feld.kalkulationsart"),
        uebersetze(sprache, "feld.nettoPreis"),
        "",
      ],
      zeilen,
      {
        text: uebersetze(sprache, "app.zeileHinzufuegen"),
        beiKlick: () => {
          positionen.push(leereSolutionsPosition());
          neuZeichnen();
        },
      },
      uebersetze(sprache, "app.keineZeilen"),
    ),
  ]);
}

function dienstleistungsAbschnitt(umgebung: Umgebung): HTMLElement {
  const { sprache, eingabe, aktualisieren, neuZeichnen } = umgebung;
  const positionen: DienstleistungsPosition[] = eingabe.solutions.dienstleistungen;

  const zeilen = positionen.map((position, index) =>
    el("tr", {}, [
      zahlZelle(
        position.stunden,
        (wert) => {
          position.stunden = wert;
          aktualisieren();
        },
        "0.5",
      ),
      textZelle(position.artikelNr, (wert) => {
        position.artikelNr = wert;
      }),
      textZelle(position.bezeichnung, (wert) => {
        position.bezeichnung = wert;
      }),
      zahlZelle(position.preisProStunde, (wert) => {
        position.preisProStunde = wert;
        aktualisieren();
      }),
      entfernenZelle(() => {
        positionen.splice(index, 1);
        neuZeichnen();
      }, uebersetze(sprache, "app.zeileEntfernen")),
    ]),
  );

  return abschnitt(uebersetze(sprache, "abschnitt.solutionsDienstleistungen"), [
    zeilenTabelle(
      [
        uebersetze(sprache, "feld.stunden"),
        uebersetze(sprache, "feld.artikelNr"),
        uebersetze(sprache, "feld.bezeichnung"),
        uebersetze(sprache, "feld.preisProStunde"),
        "",
      ],
      zeilen,
      {
        text: uebersetze(sprache, "app.zeileHinzufuegen"),
        beiKlick: () => {
          positionen.push(leereDienstleistungsPosition());
          neuZeichnen();
        },
      },
      uebersetze(sprache, "app.keineZeilen"),
    ),
    el("div", { klasse: "raster" }, [
      schalter(
        uebersetze(sprache, "feld.maintenanceInPauschale"),
        eingabe.solutions.maintenanceInServicepauschale,
        (wert) => {
          eingabe.solutions.maintenanceInServicepauschale = wert;
          aktualisieren();
        },
      ),
      zahlenfeld(
        uebersetze(sprache, "feld.dienstleistungVerrechnet"),
        eingabe.solutions.dienstleistungVerrechnet,
        (wert) => {
          eingabe.solutions.dienstleistungVerrechnet = wert;
          aktualisieren();
        },
      ),
    ]),
  ]);
}

// ----------------------------------------------- Alter Vertrag und Zusaetze

function altvertragAbschnitt(umgebung: Umgebung): HTMLElement {
  const { sprache, eingabe, aktualisieren } = umgebung;
  return abschnitt(uebersetze(sprache, "abschnitt.altvertrag"), [
    el("div", { klasse: "raster" }, [
      schalter(
        uebersetze(sprache, "feld.vertragNichtErfuellt"),
        eingabe.altvertrag.vertragNichtErfuellt,
        (wert) => {
          eingabe.altvertrag.vertragNichtErfuellt = wert;
          aktualisieren();
        },
      ),
      zahlenfeld(
        uebersetze(sprache, "feld.offeneMietraten"),
        eingabe.altvertrag.offeneMietraten,
        (wert) => {
          eingabe.altvertrag.offeneMietraten = wert;
          aktualisieren();
        },
        { schritt: "1" },
      ),
      zahlenfeld(uebersetze(sprache, "feld.mieteProMonat"), eingabe.altvertrag.mieteProMonat, (wert) => {
        eingabe.altvertrag.mieteProMonat = wert;
        aktualisieren();
      }),
      zahlenfeld(uebersetze(sprache, "feld.altvertragFaktor"), eingabe.altvertrag.faktor, (wert) => {
        eingabe.altvertrag.faktor = wert;
        aktualisieren();
      }),
      schalter(uebersetze(sprache, "feld.aufrechnung"), eingabe.altvertrag.aufrechnung, (wert) => {
        eingabe.altvertrag.aufrechnung = wert;
        aktualisieren();
      }),
    ]),
  ]);
}

function zusatzAbschnitt(umgebung: Umgebung): HTMLElement {
  const { sprache, eingabe, aktualisieren, neuZeichnen } = umgebung;
  const zeilen = eingabe.zusatzpositionen.map((position, index) =>
    el("tr", {}, [
      textZelle(position.bezeichnung, (wert) => {
        position.bezeichnung = wert;
      }),
      zahlZelle(position.verrechnet, (wert) => {
        position.verrechnet = wert;
        aktualisieren();
      }),
      zahlZelle(position.finanziert, (wert) => {
        position.finanziert = wert;
        aktualisieren();
      }),
      entfernenZelle(() => {
        eingabe.zusatzpositionen.splice(index, 1);
        neuZeichnen();
      }, uebersetze(sprache, "app.zeileEntfernen")),
    ]),
  );

  return abschnitt(uebersetze(sprache, "abschnitt.zusatzpositionen"), [
    zeilenTabelle(
      [
        uebersetze(sprache, "feld.bezeichnung"),
        uebersetze(sprache, "feld.verrechnet"),
        uebersetze(sprache, "feld.finanziert"),
        "",
      ],
      zeilen,
      {
        text: uebersetze(sprache, "app.zeileHinzufuegen"),
        beiKlick: () => {
          // Das Excel kennt neun solche Zeilen (73 bis 93).
          if (eingabe.zusatzpositionen.length >= 9) return;
          eingabe.zusatzpositionen.push(leereZusatzPosition());
          neuZeichnen();
        },
      },
      uebersetze(sprache, "app.keineZeilen"),
    ),
  ]);
}

// --------------------------------------------------- Volumen und Pauschalen

function volumenAbschnitt(umgebung: Umgebung): HTMLElement {
  const { sprache, eingabe, aktualisieren } = umgebung;
  const v = eingabe.volumen;
  const zahl = (schluessel: string, lesen: () => number, schreiben: (wert: number) => void, schritt = "0.001") =>
    zahlenfeld(uebersetze(sprache, schluessel), lesen(), (wert) => {
      schreiben(wert);
      aktualisieren();
    }, { schritt });

  return abschnitt(uebersetze(sprache, "abschnitt.volumen"), [
    el("div", { klasse: "raster" }, [
      zahl("feld.swSeiten", () => v.swSeiten, (w) => (v.swSeiten = w), "1"),
      zahl("feld.swPreis", () => v.swPreis, (w) => (v.swPreis = w)),
      zahl("feld.swMehrseitenpreis", () => v.swMehrseitenpreis, (w) => (v.swMehrseitenpreis = w)),
      zahl("feld.colorSeiten", () => v.colorSeiten, (w) => (v.colorSeiten = w), "1"),
      zahl("feld.colorPreis", () => v.colorPreis, (w) => (v.colorPreis = w)),
      zahl("feld.colorMehrseitenpreis", () => v.colorMehrseitenpreis, (w) => (v.colorMehrseitenpreis = w)),
      zahl("feld.scanSeiten", () => v.scanSeiten, (w) => (v.scanSeiten = w), "1"),
      zahl("feld.scanPreis", () => v.scanPreis, (w) => (v.scanPreis = w)),
      zahl("feld.mehrscanpreis", () => v.mehrscanpreis, (w) => (v.mehrscanpreis = w)),
    ]),
  ]);
}

function pauschalenAbschnitt(umgebung: Umgebung): HTMLElement {
  const { sprache, eingabe, aktualisieren } = umgebung;
  const p = eingabe.pauschalen;
  const zahl = (schluessel: string, lesen: () => number, schreiben: (wert: number) => void) =>
    zahlenfeld(uebersetze(sprache, schluessel), lesen(), (wert) => {
      schreiben(wert);
      aktualisieren();
    });

  const solutionsFelder = p.solutions.map((wert, index) =>
    zahlenfeld(`${uebersetze(sprache, "feld.pauschaleSolutions")} ${index + 1}`, wert, (neu) => {
      p.solutions[index] = neu;
      aktualisieren();
    }),
  );

  return abschnitt(uebersetze(sprache, "abschnitt.pauschalen"), [
    el("div", { klasse: "raster" }, [
      zahl("feld.sla", () => p.sla, (w) => (p.sla = w)),
      zahl("feld.grundpauschale", () => p.grundpauschale, (w) => (p.grundpauschale = w)),
      zahl("feld.wartungController", () => p.wartungController, (w) => (p.wartungController = w)),
      zahl("feld.wartungMuenzer", () => p.wartungMuenzer, (w) => (p.wartungMuenzer = w)),
      zahl("feld.bizhubSecure", () => p.bizhubSecure, (w) => (p.bizhubSecure = w)),
      ...solutionsFelder,
    ]),
  ]);
}

export function maskeZeichnen(umgebung: Umgebung): HTMLElement {
  return el("form", { klasse: "maske", attribute: { autocomplete: "off" } }, [
    vertragsAbschnitt(umgebung),
    hardwareAbschnitt(umgebung),
    solutionsTabelle(umgebung, umgebung.eingabe.solutions.software, "abschnitt.solutionsSoftware"),
    solutionsTabelle(umgebung, umgebung.eingabe.solutions.maintenance, "abschnitt.solutionsMaintenance"),
    dienstleistungsAbschnitt(umgebung),
    zusatzAbschnitt(umgebung),
    altvertragAbschnitt(umgebung),
    volumenAbschnitt(umgebung),
    pauschalenAbschnitt(umgebung),
  ]);
}
