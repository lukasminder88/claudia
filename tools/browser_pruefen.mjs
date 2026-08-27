/* Führt den Golden Record der Browser-Fassung in einem echten Browser aus.
   Rückgabe 0 = bestanden, 1 = fehlgeschlagen, 2 = Browser nicht verfügbar. */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const WURZEL = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SEITE = path.join(WURZEL, "dist", "pruefung.html");
const KALKTOOL = path.join(WURZEL, "examples", "Kalktool_Birsfelden_C3351i.xlsx");

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("playwright ist nicht installiert (npm i -D playwright).");
  process.exit(2);
}

const kandidaten = [
  process.env.CHROMIUM_PFAD,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium/chrome-linux/chrome",
].filter(Boolean);

let browser = null;
for (const pfad of [...kandidaten, null]) {
  try {
    browser = await chromium.launch(pfad ? { executablePath: pfad } : {});
    break;
  } catch { /* nächster Kandidat */ }
}
if (!browser) {
  console.error("Kein Chromium gefunden (CHROMIUM_PFAD setzen oder npx playwright install).");
  process.exit(2);
}

const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push("pageerror: " + e.message));
seite.on("console", (m) => { if (m.type() === "error") fehler.push(m.text()); });

// Bewusst über file:// – genau so, wie der Anwender die Datei öffnet.
await seite.goto("file://" + SEITE);
await seite.setInputFiles("#datei", KALKTOOL);
await seite.waitForFunction(
  () => /bestanden|fehlgeschlagen/.test(document.getElementById("ausgabe").textContent),
  { timeout: 120000 }
);

const text = await seite.textContent("#ausgabe");
const zeilen = text.split("\n");
console.log(zeilen.filter((z) => z.startsWith("FEHL") || /^\s+(ist|soll):/.test(z)).join("\n"));
console.log(zeilen[zeilen.length - 1].trim());
if (fehler.length) console.log("Konsolenfehler:", fehler.join(" | "));

await browser.close();
process.exit(text.includes("fehlgeschlagen") || fehler.length ? 1 : 0);
