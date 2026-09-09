/** Ergebnisbereich - was im Excel rechts und unten auf dem Blatt steht. */

import { VERTRAGSART, type Betrag, type Ergebnis } from "../engine";
import { formatBetrag, formatProzent, t, type Sprache } from "../i18n";
import { el } from "./bausteine";

interface Zeile {
  schluessel: string;
  wert: Betrag;
  art?: "betrag" | "prozent" | "zahl";
  hervorgehoben?: boolean;
}

function wertText(zeile: Zeile, sprache: Sprache): string {
  if (zeile.wert === null) return t(sprache, "ergebnis.nichtBerechenbar");
  if (zeile.art === "prozent") return formatProzent(zeile.wert, sprache);
  if (zeile.art === "zahl") return formatBetrag(zeile.wert, sprache, 2);
  return formatBetrag(zeile.wert, sprache, 2);
}

function block(titel: string, zeilen: Zeile[], sprache: Sprache, uebersetzen = true): HTMLElement {
  const eintraege = zeilen.map((zeile) =>
    el("div", { klasse: `wertzeile${zeile.hervorgehoben ? " hervorgehoben" : ""}` }, [
      el("span", { klasse: "bezeichnung", text: uebersetzen ? t(sprache, zeile.schluessel) : zeile.schluessel }),
      el("span", {
        klasse: `wert${zeile.wert === null ? " fehlt" : ""}`,
        text: wertText(zeile, sprache),
      }),
    ]),
  );
  return el("div", { klasse: "ergebnisblock" }, [el("h3", { text: titel }), ...eintraege]);
}

export function ergebnisZeichnen(ergebnis: Ergebnis, sprache: Sprache, vertragsart: number): HTMLElement {
  const istKauf = vertragsart === VERTRAGSART.kauf;

  const hauptzeilen: Zeile[] = [
    { schluessel: "ergebnis.vertragswert", wert: ergebnis.total.vertragswert, hervorgehoben: true },
    { schluessel: ergebnis.ergebnis.grundpauschaleSchluessel, wert: ergebnis.ergebnis.grundpauschale, hervorgehoben: true },
  ];
  if (!istKauf) {
    hauptzeilen.push(
      { schluessel: "ergebnis.servicepauschaleSolution", wert: ergebnis.ergebnis.servicepauschaleSolution },
      { schluessel: "ergebnis.servicepauschaleGeraet", wert: ergebnis.ergebnis.servicepauschaleGeraet },
      {
        schluessel: "ergebnis.monatspauschaleTotal",
        wert: ergebnis.ergebnis.monatspauschaleTotal,
        hervorgehoben: true,
      },
    );
  }

  const hinweise = ergebnis.hinweise.map((hinweis) =>
    el("li", { klasse: `hinweis-${hinweis.schwere}` }, [
      el("span", { klasse: "code", text: hinweis.code }),
      t(sprache, hinweis.schluessel),
    ]),
  );

  const bereiche: Node[] = [
    block(t(sprache, "abschnitt.ergebnis"), hauptzeilen, sprache),
    block(
      t(sprache, "abschnitt.kalkulation"),
      [
        { schluessel: "ergebnis.totalCif", wert: ergebnis.total.cif },
        { schluessel: "ergebnis.nettoVerkaufspreis", wert: ergebnis.total.nettoVerkaufspreis },
        { schluessel: "ergebnis.marge", wert: ergebnis.total.marge },
        { schluessel: "ergebnis.margeProzent", wert: ergebnis.total.margeProzent, art: "prozent" },
        { schluessel: "ergebnis.margeEffektiv", wert: ergebnis.hardware.margeProzent, art: "prozent" },
        { schluessel: "ergebnis.margeAlt", wert: ergebnis.hardware.margeAltProzent, art: "prozent" },
        { schluessel: "ergebnis.rabattLpHardware", wert: ergebnis.total.rabattLpHardware, art: "prozent" },
        { schluessel: "ergebnis.rabattLpSoftware", wert: ergebnis.total.rabattLpSoftware, art: "prozent" },
        { schluessel: "ergebnis.restwertAltvertrag", wert: ergebnis.total.restwertAltvertrag },
        {
          schluessel: "ergebnis.eingerechneteDienstleistungen",
          wert: ergebnis.total.eingerechneteDienstleistungen,
        },
      ],
      sprache,
    ),
    block(
      t(sprache, "abschnitt.finanzierung"),
      [
        { schluessel: "ergebnis.faktor", wert: ergebnis.finanzierung.faktor, art: "prozent" },
        { schluessel: "ergebnis.zinsfaktor", wert: ergebnis.finanzierung.zinsfaktor, art: "prozent" },
        {
          schluessel: "ergebnis.amortisationsdauer",
          wert: ergebnis.finanzierung.amortisationsdauer,
          art: "zahl",
        },
        { schluessel: "ergebnis.amortisationHardware", wert: ergebnis.amortisation.hardware },
        { schluessel: "ergebnis.amortisationSolutions", wert: ergebnis.amortisation.solutionTotal },
        { schluessel: "ergebnis.amortisationAltvertrag", wert: ergebnis.amortisation.altvertrag },
        { schluessel: "ergebnis.amortisationDiverses", wert: ergebnis.amortisation.diverses },
        { schluessel: "ergebnis.zinsenHardware", wert: ergebnis.zinsen.hardware },
        { schluessel: "ergebnis.zinsenSolutions", wert: ergebnis.zinsen.solutionTotal },
        {
          schluessel: "ergebnis.totalMonatspauschalen",
          wert: ergebnis.pauschalen.totalMonatspauschalen,
        },
      ],
      sprache,
    ),
    block(
      t(sprache, "abschnitt.provision"),
      [
        { schluessel: "ergebnis.umsatzTotal", wert: ergebnis.provision.umsatzTotal },
        { schluessel: "ergebnis.umsatzSolution", wert: ergebnis.provision.umsatzSolution },
        {
          schluessel: "ergebnis.umsatzSolutionFakturiert",
          wert: ergebnis.provision.umsatzSolutionFakturiert,
        },
        {
          schluessel: "ergebnis.umsatzDienstleistungFakturiert",
          wert: ergebnis.provision.umsatzDienstleistungFakturiert,
        },
        { schluessel: "ergebnis.margeTotal", wert: ergebnis.provision.margeTotal },
      ],
      sprache,
    ),
  ];

  if (hinweise.length > 0) {
    bereiche.push(el("ul", { klasse: "hinweise" }, hinweise));
  }

  return el("aside", { klasse: "ergebnis" }, bereiche);
}
