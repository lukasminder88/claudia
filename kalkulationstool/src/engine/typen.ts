/**
 * Typen des Rechenkerns.
 *
 * Jede Eingabe traegt die Excel-Zelle, aus der sie stammt. Wahrheit ist
 * spec/calc-spec.md, bei Zweifel spec/excel/Kalkulationstool_Vorlage_Q42025_rev1_D.xlsx.
 */

/** Vertragsart - im Excel die Optionsgruppe mit verknuepfter Zelle I16. */
export const VERTRAGSART = {
  kauf: 1,
  miete: 2,
  leasing: 3,
  spezialLeasing: 4,
  spezialMiete: 5,
} as const;

export type Vertragsart = (typeof VERTRAGSART)[keyof typeof VERTRAGSART];

/** Fakturierungsrhythmus des Leasingfaktors - I15, Liste lstFaktLeasing. */
export type FaktLeasing = "Monatlich" | "Quartalsweise";

/** Hardware-Zeile: Kalkulation C/D 27-46 bzw. 48-52. */
export interface HardwarePosition {
  bezeichnung: string;
  /** Listenpreis - Spalte C. */
  listenpreis: number;
  /** Kalkulationsart (CIF-Faktor) - Spalte D, Liste lstKalkHW. */
  kalkulationsart: number;
}

/** Solutions-Zeile: 'Detail Solutions' 21-38 (Software) bzw. 43-56 (Maintenance). */
export interface SolutionsPosition {
  /** Anzahl - Spalte A. */
  anzahl: number;
  artikelNr: string;
  bezeichnung: string;
  /** Listenpreis pro Artikel - Spalte D. */
  listenpreisProArtikel: number;
  /** Kalkulationsart - Spalte F, Liste lstKalkSW. */
  kalkulationsart: number;
  /**
   * Netto-Preis - Spalte H. In der Vorlage eine Formel (= Total Listenpreis).
   * null bedeutet: Formel rechnen. Eine Zahl ist eine bewusste Uebersteuerung
   * und damit ein Rabatt auf der Zeile.
   */
  nettoPreis: number | null;
  functionCode: string;
}

/** Dienstleistungszeile: 'Detail Solutions' 61-70. */
export interface DienstleistungsPosition {
  /** Anzahl Stunden - Spalte A. */
  stunden: number;
  artikelNr: string;
  bezeichnung: string;
  /** Ansatz pro Stunde - Spalte G. */
  preisProStunde: number;
}

/** Solutions-Zeile direkt auf dem Blatt Kalkulation (I/J/L 28-30 bzw. 37). */
export interface SolutionsZusatzZeile {
  bezeichnung: string;
  /** Listenpreis - Spalte I. */
  listenpreis: number;
  /** Kalkulationsart - Spalte J. */
  kalkulationsart: number;
  /** Netto-VP - Spalte L. null = Formel (entspricht dem Listenpreis). */
  nettoVerkaufspreis: number | null;
}

/** Dienstleistungszeile direkt auf dem Blatt Kalkulation (I/J 46-48). */
export interface DienstleistungsZusatzZeile {
  bezeichnung: string;
  /** Anzahl Stunden - Spalte I. */
  stunden: number;
  /** Ansatz pro Stunde - Spalte J. */
  preisProStunde: number;
}

/** Transport, Integration und weitere Positionen: Zeilen 73-93, Spalten A und B. */
export interface ZusatzPosition {
  bezeichnung: string;
  /** Verrechnet - Spalte A. */
  verrechnet: number;
  /** Finanziert - Spalte B. Fliesst in den Vertragswert. */
  finanziert: number;
}

export interface Eingabe {
  vertrag: {
    /** I16 - Optionsgruppe Kauf / Miete / Leasing / Spezial Leasing / Spezial Miete. */
    art: Vertragsart;
    /** J16 - Liste lstLaufzeit. */
    laufzeitMonate: number;
    /** B17 - Haken "KAM". Setzt die Mietfaktorstufe fest auf "ab 250'000". */
    kam: boolean;
    /** C14 - Haken "Verlaengerung/New". */
    verlaengerungNew: boolean;
    /** I15 - Fakturierung des Leasingfaktors. */
    faktLeasing: FaktLeasing;
    /** G16 - frei gesetzter Faktor fuer "Spezial Miete". */
    faktorSpezialMiete: number;
    /** H16 - frei gesetzter Faktor fuer "Spezial Leasing". */
    faktorSpezialLeasing: number;
  };
  hardware: {
    /** Zeilen 27-46: gehen in die Bemessungsgrundlage des Supportabzugs ein. */
    positionen: HardwarePosition[];
    /** Zeilen 48-52: unterhalb der Supportzeile, ausserhalb der Bemessungsgrundlage. */
    positionenNachSupport: HardwarePosition[];
    /** E21 - Rabattsatz auf den Hardware-Listenpreis. */
    rabattsatz: number;
    /** B66 - Supportsatz auf die CIF-Summe der Zeilen 27-46. */
    supportSatz: number;
    /** B67 - fixer Supportbetrag. */
    supportPauschale: number;
    /** D47 (= D27) - Kalkulationsart der Supportzeile. */
    supportKalkulationsart: number;
  };
  solutions: {
    software: SolutionsPosition[];
    maintenance: SolutionsPosition[];
    dienstleistungen: DienstleistungsPosition[];
    /** Kalkulation I28:L30. */
    softwareZusatz: SolutionsZusatzZeile[];
    /** Kalkulation I37:L37. */
    maintenanceZusatz: SolutionsZusatzZeile[];
    /** Kalkulation I46:J48. */
    dienstleistungenZusatz: DienstleistungsZusatzZeile[];
    /** I40 - "Maintenance in Servicepauschale": true = Ja. */
    maintenanceInServicepauschale: boolean;
    /** J51 - direkt verrechneter Anteil der Dienstleistungen. */
    dienstleistungVerrechnet: number;
  };
  altvertrag: {
    /** D21 - Haken "Vertrag nicht erfuellt". */
    vertragNichtErfuellt: boolean;
    /** J19 - Anzahl offener Mietraten. */
    offeneMietraten: number;
    /** J21 - Miete pro Monat des alten Vertrags, ohne Service. */
    mieteProMonat: number;
    /** M19 - Faktor auf den Restwert. */
    faktor: number;
    /** L23 - Haken "Aufrechnung des alten Mietwertes". */
    aufrechnung: boolean;
  };
  /** Zeilen 73, 75, 77, 79, 81, 84, 87, 90, 93. */
  zusatzpositionen: ZusatzPosition[];
  volumen: {
    /** H56 / H57 / H59. */
    swSeiten: number;
    swPreis: number;
    swMehrseitenpreis: number;
    /** H61 / H62 / H64. */
    colorSeiten: number;
    colorPreis: number;
    colorMehrseitenpreis: number;
    /** H66 / H67 / H69. */
    scanSeiten: number;
    scanPreis: number;
    mehrscanpreis: number;
  };
  pauschalen: {
    /** M58 - SLA. */
    sla: number;
    /** M59 - Grundpauschale inkl. CSRC. */
    grundpauschale: number;
    /** M60 - Wartung Controller. */
    wartungController: number;
    /** M61 - Wartung Muenzer / Kartensystem. */
    wartungMuenzer: number;
    /** M62 - bizhub SECURE. */
    bizhubSecure: number;
    /** M64-M69 - Solutions-Pauschalen, genau sechs Zeilen. */
    solutions: number[];
  };
}

/**
 * Ein nicht berechenbarer Wert ist null. Im Excel steht an dieser Stelle
 * entweder "" (IFERROR) oder ein Fehler wie #VALUE!, weil kein Faktor
 * hinterlegt ist. Die Engine gibt statt eines Fehlers null zurueck und meldet
 * den Grund ueber Ergebnis.hinweise.
 */
export type Betrag = number | null;

export interface Hinweis {
  code: string;
  /** Schluessel im Woerterbuch packages i18n - kein fertiger Text. */
  schluessel: string;
  schwere: "warnung" | "fehler";
}

export interface Ergebnis {
  regelwerkVersion: string;
  hardware: {
    totalListenpreis: number;
    totalCif: number;
    nettoVerkaufspreis: number;
    marge: number;
    margeProzent: Betrag;
    margeAlt: number;
    margeAltProzent: Betrag;
    supportListenpreis: number;
  };
  solutions: {
    software: {
      totalListenpreis: number;
      totalCif: number;
      nettoVerkaufspreis: number;
      marge: number;
      amortisationBasis: number;
    };
    maintenance: {
      totalListenpreis: number;
      totalCif: number;
      nettoVerkaufspreis: number;
      marge: number;
      inVerkaufMiete: number;
      inMonatspauschale: number;
      amortisationBasis: number;
    };
    dienstleistungen: {
      totalStunden: number;
      nettoVerkaufspreis: number;
      marge: number;
      finanziert: number;
      korrekturCif: number;
      amortisationBasis: number;
    };
  };
  detail: {
    software: { totalListenpreis: number; totalCif: number; nettoPreis: number };
    maintenance: { totalListenpreis: number; totalCif: number; nettoPreis: number };
    dienstleistungen: { totalStunden: number; total: number };
  };
  altvertrag: { restwert: number };
  total: {
    cif: number;
    marge: number;
    margeProzent: Betrag;
    nettoVerkaufspreis: number;
    restwertAltvertrag: number;
    eingerechneteDienstleistungen: number;
    vertragswert: number;
    margeVonUnten: Betrag;
    rabattLpHardware: Betrag;
    rabattLpSoftware: Betrag;
  };
  finanzierung: {
    faktor: Betrag;
    faktorMiete: Betrag;
    faktorLeasing: Betrag;
    zinsfaktor: Betrag;
    amortisationsdauer: number;
    provisionSofortFakturiert: number;
  };
  amortisation: {
    altvertrag: number;
    diverses: number;
    hardware: number;
    solutionSoftware: number;
    solutionMaintenance: Betrag;
    solutionDienstleistungen: number;
    solutionTotal: Betrag;
  };
  zinsen: {
    hardware: number;
    solutionSoftware: number;
    solutionMaintenance: Betrag;
    solutionDienstleistungen: number;
    solutionTotal: Betrag;
  };
  pauschalen: { sw: number; color: number; scan: number; totalMonatspauschalen: number };
  ergebnis: {
    /** Bezeichnung der Hauptzeile - i18n-Schluessel, kein fertiger Text. */
    grundpauschaleSchluessel: string;
    grundpauschale: Betrag;
    servicepauschaleSolution: Betrag;
    servicepauschaleGeraet: number;
    monatspauschaleTotal: Betrag;
  };
  provision: {
    umsatzSolutionFakturiert: number;
    umsatzDienstleistungFakturiert: number;
    umsatzSolution: number;
    margeTotal: number;
    umsatzTotal: number;
  };
  hinweise: Hinweis[];
}
