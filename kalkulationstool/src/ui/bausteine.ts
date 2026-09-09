/** Kleine Bausteine fuer die Maske. Kein Framework, nur DOM. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  eigenschaften: { klasse?: string; text?: string; attribute?: Record<string, string> } = {},
  kinder: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const knoten = document.createElement(tag);
  if (eigenschaften.klasse) knoten.className = eigenschaften.klasse;
  if (eigenschaften.text !== undefined) knoten.textContent = eigenschaften.text;
  for (const [name, wert] of Object.entries(eigenschaften.attribute ?? {})) {
    knoten.setAttribute(name, wert);
  }
  for (const kind of kinder) knoten.append(kind);
  return knoten;
}

let laufendeNummer = 0;
function naechsteId(): string {
  laufendeNummer += 1;
  return `feld-${laufendeNummer}`;
}

/** Beschriftetes Eingabefeld. Der Rueckruf bekommt den bereits geparsten Wert. */
export function zahlenfeld(
  beschriftung: string,
  wert: number,
  beiAenderung: (wert: number) => void,
  optionen: { schritt?: string; einheit?: string; hinweis?: string } = {},
): HTMLElement {
  const id = naechsteId();
  const feld = el("input", {
    klasse: "zahl",
    attribute: {
      id,
      type: "number",
      step: optionen.schritt ?? "0.01",
      value: String(wert),
      inputmode: "decimal",
    },
  });
  feld.addEventListener("input", () => {
    const zahl = Number.parseFloat(feld.value.replace(",", "."));
    beiAenderung(Number.isFinite(zahl) ? zahl : 0);
  });
  const kinder: (Node | string)[] = [el("label", { text: beschriftung, attribute: { for: id } }), feld];
  if (optionen.einheit) kinder.push(el("span", { klasse: "einheit", text: optionen.einheit }));
  if (optionen.hinweis) kinder.push(el("p", { klasse: "hinweis", text: optionen.hinweis }));
  return el("div", { klasse: "feld" }, kinder);
}

export function textfeld(
  beschriftung: string,
  wert: string,
  beiAenderung: (wert: string) => void,
): HTMLElement {
  const id = naechsteId();
  const feld = el("input", { attribute: { id, type: "text", value: wert } });
  feld.addEventListener("input", () => beiAenderung(feld.value));
  return el("div", { klasse: "feld" }, [
    el("label", { text: beschriftung, attribute: { for: id } }),
    feld,
  ]);
}

export function auswahlfeld(
  beschriftung: string,
  eintraege: { wert: string; text: string }[],
  wert: string,
  beiAenderung: (wert: string) => void,
): HTMLElement {
  const id = naechsteId();
  const feld = el("select", { attribute: { id } });
  for (const eintrag of eintraege) {
    const option = el("option", { text: eintrag.text, attribute: { value: eintrag.wert } });
    if (eintrag.wert === wert) option.setAttribute("selected", "selected");
    feld.append(option);
  }
  feld.addEventListener("change", () => beiAenderung(feld.value));
  return el("div", { klasse: "feld" }, [
    el("label", { text: beschriftung, attribute: { for: id } }),
    feld,
  ]);
}

export function schalter(
  beschriftung: string,
  wert: boolean,
  beiAenderung: (wert: boolean) => void,
  hinweis?: string,
): HTMLElement {
  const id = naechsteId();
  const feld = el("input", { attribute: { id, type: "checkbox" } });
  feld.checked = wert;
  feld.addEventListener("change", () => beiAenderung(feld.checked));
  const kinder: (Node | string)[] = [
    el("label", { klasse: "schalter", attribute: { for: id } }, [feld, beschriftung]),
  ];
  if (hinweis) kinder.push(el("p", { klasse: "hinweis", text: hinweis }));
  return el("div", { klasse: "feld feld-schalter" }, kinder);
}

export function abschnitt(titel: string, kinder: Node[], klasse = ""): HTMLElement {
  return el("section", { klasse: `abschnitt ${klasse}`.trim() }, [
    el("h2", { text: titel }),
    ...kinder,
  ]);
}

export function knopf(beschriftung: string, beiKlick: () => void, klasse = ""): HTMLButtonElement {
  const feld = el("button", { klasse, text: beschriftung, attribute: { type: "button" } });
  feld.addEventListener("click", beiKlick);
  return feld;
}

/**
 * Prozentfeld: angezeigt wird 5, gespeichert 0.05. Das Excel formatiert diese
 * Zellen ebenfalls als Prozent, rechnet aber mit dem Bruchteil.
 */
export function prozentfeld(
  beschriftung: string,
  wert: number,
  beiAenderung: (wert: number) => void,
): HTMLElement {
  const id = naechsteId();
  const feld = el("input", {
    klasse: "zahl",
    attribute: {
      id,
      type: "number",
      step: "0.1",
      inputmode: "decimal",
      value: String(Math.round(wert * 1e8) / 1e6),
    },
  });
  feld.addEventListener("input", () => {
    const zahl = Number.parseFloat(feld.value.replace(",", "."));
    beiAenderung(Number.isFinite(zahl) ? zahl / 100 : 0);
  });
  return el("div", { klasse: "feld" }, [
    el("label", { text: beschriftung, attribute: { for: id } }),
    el("div", { klasse: "mit-einheit" }, [feld, el("span", { klasse: "einheit", text: "%" })]),
  ]);
}
