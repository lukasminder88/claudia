/**
 * Rechenkern des Kalkulationstools.
 *
 * Reine Funktion: keine I/O, kein DOM, keine Datenbank. Jeder Block traegt
 * die Excel-Zellen, die er nachbildet. Wahrheit ist spec/calc-spec.md.
 */

import { REGELWERK, type Faktortabelle } from "./regelwerk";
import { aufFuenfRappen, einsMinusQuotient, summe, teile } from "./rechnen";
import { VERTRAGSART, type Betrag, type Eingabe, type Ergebnis, type Hinweis } from "./typen";

/** Faktorstufe: hoechste Stufe, deren Untergrenze der Vertragswert erreicht. */
function stufenIndex(tabelle: Faktortabelle, vertragswert: number): number {
  let index = 0;
  for (let i = 0; i < tabelle.stufen.length; i += 1) {
    if (vertragswert >= (tabelle.stufen[i] as number)) index = i;
  }
  return index;
}

function faktorAus(tabelle: Faktortabelle, stufe: number, laufzeitMonate: number): Betrag {
  const spalte = tabelle.laufzeiten.indexOf(laufzeitMonate);
  if (spalte === -1) return null;
  const zeile = tabelle.faktoren[stufe];
  if (zeile === undefined) return null;
  return zeile[spalte] ?? null;
}

/**
 * Miete Graphax, Zeile 15 des Blatts: Faktor nach Vertragswert und Laufzeit.
 * Eine leere Zelle in der Vorlage - alle 12-Monats-Faktoren - liefert im
 * Excel 0. Genau das gibt diese Funktion zurueck.
 */
function mietfaktorNachVertragswert(vertragswert: number, laufzeitMonate: number): number {
  const stufe = stufenIndex(REGELWERK.mieteGraphax, vertragswert);
  return faktorAus(REGELWERK.mieteGraphax, stufe, laufzeitMonate) ?? 0;
}

export function berechnen(eingabe: Eingabe): Ergebnis {
  const hinweise: Hinweis[] = [];
  const melden = (code: string, schluessel: string, schwere: Hinweis["schwere"] = "warnung"): void => {
    hinweise.push({ code, schluessel, schwere });
  };

  const { art, laufzeitMonate } = eingabe.vertrag;
  const istKauf = art === VERTRAGSART.kauf;
  /**
   * Das Excel schreibt an rund zwanzig Stellen IF($I$16=2, x, IF($I$16=5, x, 0)):
   * amortisiert und verzinst wird nur bei Miete und Spezial Miete.
   */
  const istMiete = art === VERTRAGSART.miete || art === VERTRAGSART.spezialMiete;

  // ---------------------------------------------------------------- Hardware
  // Kalkulation C27:E52. Zeile 47 ist die Supportzeile und liegt zwischen den
  // beiden Bloecken der Hardware-Zeilen.
  const cifJeZeile = (position: { listenpreis: number; kalkulationsart: number }): number =>
    position.listenpreis * position.kalkulationsart;

  const cifBasis = summe(eingabe.hardware.positionen.map(cifJeZeile)); // SUM(E27:E46)
  const supportZaehler = cifBasis * eingabe.hardware.supportSatz + eingabe.hardware.supportPauschale;
  let supportListenpreis = 0; // C47
  if (supportZaehler !== 0) {
    if (eingabe.hardware.supportKalkulationsart === 0) {
      // Im Excel steht hier #DIV/0!. Bewusste Korrektur: kein Abzug, dafuer ein Hinweis.
      melden("W312", "hinweis.supportOhneKalkulationsart", "fehler");
    } else {
      supportListenpreis = -supportZaehler / eingabe.hardware.supportKalkulationsart;
    }
  }
  const supportCif = supportListenpreis * eingabe.hardware.supportKalkulationsart; // E47

  // C53 = SUM(C47:C52, C27:C46) - Reihenfolge wie im Excel-Bereich.
  const hwTotalListenpreis = summe([
    supportListenpreis,
    ...eingabe.hardware.positionenNachSupport.map((p) => p.listenpreis),
    ...eingabe.hardware.positionen.map((p) => p.listenpreis),
  ]);
  // E53 = SUM(E27:E52)
  const hwTotalCif = summe([
    ...eingabe.hardware.positionen.map(cifJeZeile),
    supportCif,
    ...eingabe.hardware.positionenNachSupport.map(cifJeZeile),
  ]);
  const hwNettoVerkaufspreis = hwTotalListenpreis - hwTotalListenpreis * eingabe.hardware.rabattsatz; // E54
  const hwMarge = hwNettoVerkaufspreis - hwTotalCif; // C54
  const hwMargeAlt = hwNettoVerkaufspreis - hwTotalCif * REGELWERK.margeAltFaktor; // C55

  // ------------------------------------------------- Solutions - Software/HW
  // 'Detail Solutions' 21-38, zusammengefasst in Kalkulation I27:L31.
  const zeileListenpreis = (p: { anzahl: number; listenpreisProArtikel: number }): number =>
    p.listenpreisProArtikel * p.anzahl;
  const detailSoftwareLp = summe(eingabe.solutions.software.map(zeileListenpreis)); // E39
  const detailSoftwareCif = summe(
    eingabe.solutions.software.map((p) => zeileListenpreis(p) * p.kalkulationsart),
  ); // G39
  const detailSoftwareNetto = summe(
    eingabe.solutions.software.map((p) => p.nettoPreis ?? zeileListenpreis(p)),
  ); // H39

  const swTotalListenpreis = summe([
    detailSoftwareLp,
    ...eingabe.solutions.softwareZusatz.map((z) => z.listenpreis),
  ]); // I31
  const swTotalCif = summe([
    detailSoftwareCif,
    ...eingabe.solutions.softwareZusatz.map((z) => z.listenpreis * z.kalkulationsart),
  ]); // K31
  const swNettoVerkaufspreis = summe([
    detailSoftwareNetto,
    ...eingabe.solutions.softwareZusatz.map((z) => z.nettoVerkaufspreis ?? z.listenpreis),
  ]); // L32
  const swMarge = swNettoVerkaufspreis - swTotalCif; // I32

  // ------------------------------------------------ Solutions - Maintenance
  // 'Detail Solutions' 43-56, zusammengefasst in Kalkulation I36:L39.
  const detailMaintenanceLp = summe(eingabe.solutions.maintenance.map(zeileListenpreis)); // E57
  const detailMaintenanceCif = summe(
    eingabe.solutions.maintenance.map((p) => zeileListenpreis(p) * p.kalkulationsart),
  ); // G57
  const detailMaintenanceNetto = summe(
    eingabe.solutions.maintenance.map((p) => p.nettoPreis ?? zeileListenpreis(p)),
  ); // H57

  const mtTotalListenpreis = summe([
    detailMaintenanceLp,
    ...eingabe.solutions.maintenanceZusatz.map((z) => z.listenpreis),
  ]); // I38
  // K38 = K37 + K36 - im Excel steht die Zusatzzeile zuerst.
  const mtTotalCif = summe([
    ...eingabe.solutions.maintenanceZusatz.map((z) => z.listenpreis * z.kalkulationsart),
    detailMaintenanceCif,
  ]);
  const mtNettoVerkaufspreis = summe([
    detailMaintenanceNetto,
    ...eingabe.solutions.maintenanceZusatz.map((z) => z.nettoVerkaufspreis ?? z.listenpreis),
  ]); // L39
  const mtMarge = mtNettoVerkaufspreis - mtTotalCif; // I39
  // J41 / L41 - Maintenance geht entweder in den Vertragswert oder in die Pauschale.
  const mtInVerkaufMiete = eingabe.solutions.maintenanceInServicepauschale ? 0 : mtNettoVerkaufspreis;
  const mtInMonatspauschale = eingabe.solutions.maintenanceInServicepauschale ? mtNettoVerkaufspreis : 0;

  // -------------------------------------------- Solutions - Dienstleistungen
  const detailDlStunden = summe(eingabe.solutions.dienstleistungen.map((p) => p.stunden)); // A71
  const detailDlTotal = summe(
    eingabe.solutions.dienstleistungen.map((p) => p.preisProStunde * p.stunden),
  ); // H71

  // L49 = SUM(L45:L48); I45 zaehlt nur die Stunden aus dem Beiblatt.
  const dlNettoVerkaufspreis = summe([
    detailDlTotal,
    ...eingabe.solutions.dienstleistungenZusatz.map((z) => z.stunden * z.preisProStunde),
  ]);
  const dlMarge = dlNettoVerkaufspreis; // I49 - K46:K48 sind in der Vorlage leer
  const dlFinanziert = dlNettoVerkaufspreis - eingabe.solutions.dienstleistungVerrechnet; // L51
  // K52 - wird nichts direkt verrechnet, nimmt das Excel den Betrag aus dem CIF heraus.
  const dlKorrekturCif = eingabe.solutions.dienstleistungVerrechnet === 0 ? dlFinanziert * -1 : 0;

  const amortBasis = (betrag: number): number =>
    aufFuenfRappen(istMiete ? betrag / laufzeitMonate : 0);
  const swAmortisationBasis = amortBasis(swNettoVerkaufspreis); // M31
  const mtAmortisationBasis = amortBasis(mtNettoVerkaufspreis); // M39
  const dlAmortisationBasis = amortBasis(dlFinanziert); // M51

  // ------------------------------------------------------------- Vertragswert
  const totalCif = hwTotalCif + swTotalCif + mtTotalCif + dlKorrekturCif; // C57
  const totalMarge = hwMarge + swMarge + mtMarge + dlMarge; // C58
  const totalNettoVerkaufspreis = totalMarge + totalCif; // C59

  const restwertAltvertrag = eingabe.altvertrag.vertragNichtErfuellt // M21
    ? eingabe.altvertrag.offeneMietraten * eingabe.altvertrag.mieteProMonat * eingabe.altvertrag.faktor
    : 0;
  const restwertImVertrag = eingabe.altvertrag.aufrechnung ? restwertAltvertrag : 0; // C60
  const eingerechneteDienstleistungen = // C61
    summe(eingabe.zusatzpositionen.map((z) => z.finanziert)) + dlFinanziert;
  const vertragswert = totalNettoVerkaufspreis + restwertImVertrag + eingerechneteDienstleistungen; // C62

  // ------------------------------------------------------------ Finanzierung
  // H14 - Amortisationsdauer weicht bei 12 und 24 Monaten von der Laufzeit ab.
  let amortisationsdauer: number;
  if (laufzeitMonate === 12) amortisationsdauer = REGELWERK.amortisationsdauerBei12;
  else if (laufzeitMonate === 24)
    amortisationsdauer = REGELWERK.amortisationsdauerBei12 / REGELWERK.amortisationsteilerBei24;
  else amortisationsdauer = laufzeitMonate;

  // L83 - Mietfaktor.
  let faktorMiete: Betrag;
  if (art === VERTRAGSART.spezialMiete) {
    faktorMiete = eingabe.vertrag.faktorSpezialMiete;
  } else if (eingabe.vertrag.kam) {
    // Haken "KAM": feste Stufe "ab 250'000", unabhaengig vom Vertragswert.
    const letzteStufe = REGELWERK.mieteGraphax.stufen.length - 1;
    faktorMiete = faktorAus(REGELWERK.mieteGraphax, letzteStufe, laufzeitMonate) ?? 0;
  } else if (art === VERTRAGSART.miete) {
    faktorMiete = mietfaktorNachVertragswert(vertragswert, laufzeitMonate);
  } else {
    faktorMiete = null;
  }

  // I84 / J84 - Leasingfaktor, nur bei Vertragsart Leasing und ab 2'000.
  const leasingTabelle =
    eingabe.vertrag.faktLeasing === "Quartalsweise"
      ? REGELWERK.leasingQuartalsweise
      : REGELWERK.leasingMonatlich;
  let faktorLeasing: Betrag = null;
  if (art === VERTRAGSART.spezialLeasing) {
    faktorLeasing = eingabe.vertrag.faktorSpezialLeasing;
  } else if (art === VERTRAGSART.leasing) {
    const untergrenze = leasingTabelle.stufen[0] as number;
    if (vertragswert >= untergrenze && leasingTabelle.laufzeiten.includes(laufzeitMonate)) {
      faktorLeasing = faktorAus(leasingTabelle, stufenIndex(leasingTabelle, vertragswert), laufzeitMonate);
    }
  }

  // H83 - angezeigter Finanzierungsfaktor.
  let faktor: Betrag;
  if (istKauf) faktor = REGELWERK.kaufFaktor;
  else if (art === VERTRAGSART.miete) faktor = faktorMiete;
  else if (art === VERTRAGSART.leasing) faktor = faktorLeasing;
  else if (art === VERTRAGSART.spezialLeasing) faktor = eingabe.vertrag.faktorSpezialLeasing;
  else faktor = eingabe.vertrag.faktorSpezialMiete;

  // L89 - Zinsfaktor. Beim Kauf zieht das Excel den Mietfaktor nach Vertragswert heran.
  let zinsfaktor: Betrag;
  if (istKauf) zinsfaktor = mietfaktorNachVertragswert(vertragswert, laufzeitMonate);
  else if (art === VERTRAGSART.miete || art === VERTRAGSART.spezialMiete) zinsfaktor = faktorMiete;
  else zinsfaktor = faktorLeasing;

  const provisionSofortFakturiert = // G15
    istKauf || art === VERTRAGSART.leasing || art === VERTRAGSART.spezialLeasing ? 1 : 0;

  // --------------------------------------------------------- Monatspauschalen
  const pauschaleSw = eingabe.volumen.swSeiten * eingabe.volumen.swPreis; // H58
  const pauschaleColor = eingabe.volumen.colorSeiten * eingabe.volumen.colorPreis; // H63
  const pauschaleScan = eingabe.volumen.scanSeiten * eingabe.volumen.scanPreis; // H68
  const pauschalenGeraet = // SUM(M58:M62)
    eingabe.pauschalen.sla +
    eingabe.pauschalen.grundpauschale +
    eingabe.pauschalen.wartungController +
    eingabe.pauschalen.wartungMuenzer +
    eingabe.pauschalen.bizhubSecure;
  const pauschalenSolutions = summe(eingabe.pauschalen.solutions); // SUM(M64:M69)
  const totalMonatspauschalen = pauschalenGeraet + pauschalenSolutions; // M70

  // ------------------------------------------------------ Rate und Pauschalen
  const finanzierungsbasis = vertragswert - mtInMonatspauschale; // C62 - L41

  let grundpauschale: Betrag; // L92
  if (istKauf) {
    grundpauschale = finanzierungsbasis;
  } else {
    const spezialfaktor =
      art === VERTRAGSART.spezialLeasing
        ? eingabe.vertrag.faktorSpezialLeasing
        : eingabe.vertrag.faktorSpezialMiete;
    const laufender =
      art === VERTRAGSART.miete
        ? faktorMiete
        : art === VERTRAGSART.leasing
          ? faktorLeasing
          : spezialfaktor;

    if (laufender === null) {
      grundpauschale = null;
      melden("W401", "hinweis.keinFinanzierungsfaktor", "fehler");
    } else if (eingabe.vertrag.verlaengerungNew && laufzeitMonate === 12 && art === VERTRAGSART.miete) {
      // Sonderfall: bei Verlaengerung ueber 12 Monate wird die Hardware zum
      // 12-Monats-Faktor gerechnet, der Rest zum normalen Mietfaktor.
      const faktor12 = mietfaktorNachVertragswert(vertragswert, 12);
      grundpauschale = aufFuenfRappen(
        (finanzierungsbasis - hwNettoVerkaufspreis) * laufender + hwNettoVerkaufspreis * faktor12,
      );
    } else {
      grundpauschale = aufFuenfRappen(finanzierungsbasis * laufender);
    }
  }

  // L93 - Servicepauschale fuer Solutions inklusive Maintenance.
  const servicepauschaleSolution: Betrag =
    zinsfaktor === null
      ? null
      : aufFuenfRappen(pauschalenSolutions + mtInMonatspauschale * zinsfaktor);
  // L94 - Servicepauschale des Geraets.
  const servicepauschaleGeraet = pauschalenGeraet + pauschaleSw + pauschaleColor + pauschaleScan;
  // L95 - beim Kauf gibt es keine Monatspauschale Total.
  const monatspauschaleTotal: Betrag =
    istKauf || grundpauschale === null || servicepauschaleSolution === null
      ? null
      : grundpauschale + servicepauschaleSolution + servicepauschaleGeraet;

  // ----------------------------------------------------- Amortisation, Zinsen
  const zusatzAmortisationen = eingabe.zusatzpositionen.map((z) =>
    aufFuenfRappen(istMiete ? z.finanziert / laufzeitMonate : 0),
  ); // D73:D93
  const amortAltvertrag = aufFuenfRappen(istMiete ? restwertImVertrag / laufzeitMonate : 0); // H86
  const amortDiverses = aufFuenfRappen(istMiete ? summe(zusatzAmortisationen) : 0); // I86
  const amortHardware = aufFuenfRappen(istMiete ? hwNettoVerkaufspreis / amortisationsdauer : 0); // J86
  const amortSolutionSoftware = aufFuenfRappen(istMiete ? swNettoVerkaufspreis / laufzeitMonate : 0); // H88
  // I88 und I90 sind im Excel nicht auf Miete eingeschraenkt - beim Kauf zaehlt
  // der Anteil in der Monatspauschale, sonst der gesamte Maintenance-Betrag.
  const maintenanceBasis = istKauf ? mtInMonatspauschale : mtNettoVerkaufspreis;
  const amortSolutionMaintenance = aufFuenfRappen(maintenanceBasis / laufzeitMonate); // I88
  const amortSolutionDl = aufFuenfRappen(istMiete ? dlFinanziert / laufzeitMonate : 0); // J88

  const zinsen = (betrag: number): number =>
    aufFuenfRappen(istMiete && zinsfaktor !== null ? betrag * zinsfaktor - betrag / laufzeitMonate : 0);
  const zinsenSolutionSoftware = zinsen(swNettoVerkaufspreis); // H90
  const zinsenSolutionMaintenance: Betrag = // I90
    zinsfaktor === null
      ? null
      : aufFuenfRappen(maintenanceBasis * zinsfaktor - maintenanceBasis / laufzeitMonate);
  const zinsenSolutionDl = zinsen(dlFinanziert); // J90
  const zinsenSolutionTotal: Betrag = // L88
    zinsenSolutionMaintenance === null
      ? null
      : zinsenSolutionSoftware + zinsenSolutionMaintenance + zinsenSolutionDl;
  const amortSolutionTotal: Betrag = // M88
    zinsenSolutionTotal === null
      ? null
      : amortSolutionSoftware + amortSolutionMaintenance + amortSolutionDl + zinsenSolutionTotal;

  // L86 - was von der Rate nach allen Amortisationen uebrig bleibt, sind die Zinsen der Hardware.
  let zinsenHardware = 0;
  if (istMiete) {
    if (grundpauschale === null || servicepauschaleSolution === null || zinsenSolutionMaintenance === null) {
      melden("W402", "hinweis.zinsenNichtBerechenbar", "fehler");
    } else {
      zinsenHardware = aufFuenfRappen(
        grundpauschale +
          servicepauschaleSolution -
          pauschalenSolutions -
          (amortAltvertrag +
            amortDiverses +
            amortHardware +
            amortSolutionSoftware +
            amortSolutionMaintenance +
            amortSolutionDl +
            zinsenSolutionSoftware +
            zinsenSolutionMaintenance +
            zinsenSolutionDl),
      );
    }
  }

  // ---------------------------------------------------------------- Provision
  const umsatzSolutionBasis = pauschalenSolutions * laufzeitMonate;
  const umsatzSolutionFakturiert = eingabe.vertrag.verlaengerungNew // M72
    ? 0
    : provisionSofortFakturiert === 1
      ? dlNettoVerkaufspreis + swNettoVerkaufspreis + mtNettoVerkaufspreis + umsatzSolutionBasis
      : eingabe.solutions.dienstleistungVerrechnet + umsatzSolutionBasis;
  const umsatzDienstleistungFakturiert = summe(eingabe.zusatzpositionen.map((z) => z.verrechnet)); // M74
  const umsatzSolution = eingabe.vertrag.verlaengerungNew // J78
    ? 0
    : eingabe.solutions.dienstleistungVerrechnet +
      swNettoVerkaufspreis +
      mtNettoVerkaufspreis +
      umsatzSolutionBasis;
  const umsatzTotal = eingabe.vertrag.verlaengerungNew ? 0 : vertragswert + umsatzSolutionBasis; // M78

  // ------------------------------------------------------------------ Hinweise
  if (!istKauf && laufzeitMonate === 12 && art === VERTRAGSART.miete) {
    melden("W101", "hinweis.mietfaktor12MonateFehlt", "fehler");
  }
  if (art === VERTRAGSART.leasing && faktorLeasing === null) {
    melden("W102", "hinweis.leasingfaktorFehlt", "fehler");
  }
  if (eingabe.vertrag.kam && art === VERTRAGSART.miete) {
    melden("W201", "hinweis.kamFaktorstufe");
  }
  if (eingabe.altvertrag.vertragNichtErfuellt && !eingabe.altvertrag.aufrechnung) {
    melden("W202", "hinweis.restwertNichtAufgerechnet");
  }

  return {
    regelwerkVersion: REGELWERK.version,
    hardware: {
      totalListenpreis: hwTotalListenpreis,
      totalCif: hwTotalCif,
      nettoVerkaufspreis: hwNettoVerkaufspreis,
      marge: hwMarge,
      margeProzent: teile(hwMarge, hwMarge + hwTotalCif),
      margeAlt: hwMargeAlt,
      margeAltProzent: teile(hwMargeAlt, hwMargeAlt + hwTotalCif),
      supportListenpreis,
    },
    solutions: {
      software: {
        totalListenpreis: swTotalListenpreis,
        totalCif: swTotalCif,
        nettoVerkaufspreis: swNettoVerkaufspreis,
        marge: swMarge,
        amortisationBasis: swAmortisationBasis,
      },
      maintenance: {
        totalListenpreis: mtTotalListenpreis,
        totalCif: mtTotalCif,
        nettoVerkaufspreis: mtNettoVerkaufspreis,
        marge: mtMarge,
        inVerkaufMiete: mtInVerkaufMiete,
        inMonatspauschale: mtInMonatspauschale,
        amortisationBasis: mtAmortisationBasis,
      },
      dienstleistungen: {
        totalStunden: detailDlStunden,
        nettoVerkaufspreis: dlNettoVerkaufspreis,
        marge: dlMarge,
        finanziert: dlFinanziert,
        korrekturCif: dlKorrekturCif,
        amortisationBasis: dlAmortisationBasis,
      },
    },
    detail: {
      software: {
        totalListenpreis: detailSoftwareLp,
        totalCif: detailSoftwareCif,
        nettoPreis: detailSoftwareNetto,
      },
      maintenance: {
        totalListenpreis: detailMaintenanceLp,
        totalCif: detailMaintenanceCif,
        nettoPreis: detailMaintenanceNetto,
      },
      dienstleistungen: { totalStunden: detailDlStunden, total: detailDlTotal },
    },
    altvertrag: { restwert: restwertAltvertrag },
    total: {
      cif: totalCif,
      marge: totalMarge,
      margeProzent: einsMinusQuotient(totalCif, totalNettoVerkaufspreis),
      nettoVerkaufspreis: totalNettoVerkaufspreis,
      restwertAltvertrag: restwertImVertrag,
      eingerechneteDienstleistungen,
      vertragswert,
      margeVonUnten: teile(totalMarge, totalCif),
      rabattLpHardware: einsMinusQuotient(hwNettoVerkaufspreis, hwTotalListenpreis),
      rabattLpSoftware: einsMinusQuotient(
        swNettoVerkaufspreis + mtNettoVerkaufspreis,
        swTotalListenpreis + mtTotalListenpreis,
      ),
    },
    finanzierung: {
      faktor,
      faktorMiete,
      faktorLeasing,
      zinsfaktor,
      amortisationsdauer,
      provisionSofortFakturiert,
    },
    amortisation: {
      altvertrag: amortAltvertrag,
      diverses: amortDiverses,
      hardware: amortHardware,
      solutionSoftware: amortSolutionSoftware,
      solutionMaintenance: amortSolutionMaintenance,
      solutionDienstleistungen: amortSolutionDl,
      solutionTotal: amortSolutionTotal,
    },
    zinsen: {
      hardware: zinsenHardware,
      solutionSoftware: zinsenSolutionSoftware,
      solutionMaintenance: zinsenSolutionMaintenance,
      solutionDienstleistungen: zinsenSolutionDl,
      solutionTotal: zinsenSolutionTotal,
    },
    pauschalen: {
      sw: pauschaleSw,
      color: pauschaleColor,
      scan: pauschaleScan,
      totalMonatspauschalen,
    },
    ergebnis: {
      grundpauschaleSchluessel: istKauf
        ? "pauschale.totalVerkaufspreis"
        : istMiete
          ? "pauschale.miete"
          : "pauschale.leasing",
      grundpauschale,
      servicepauschaleSolution,
      servicepauschaleGeraet,
      monatspauschaleTotal,
    },
    provision: {
      umsatzSolutionFakturiert,
      umsatzDienstleistungFakturiert,
      umsatzSolution,
      margeTotal: totalMarge,
      umsatzTotal,
    },
    hinweise,
  };
}
