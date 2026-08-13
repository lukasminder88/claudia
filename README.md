# Zeitraum – einfaches Time-Tracking

Eine **mobile-first Progressive Web App (PWA)** zum unkomplizierten Erfassen von
Arbeitszeit auf Projekten. Optimiert fürs Handy: grosser Start/Stopp-Timer,
Projektauswahl mit einem Tap, Auswertung und CSV-Export.

Die App läuft komplett im Browser – **ohne Login und ohne Server**. Alle Daten
liegen lokal auf deinem Gerät (localStorage). Du kannst sie auf dem Handy zum
Homescreen hinzufügen und sie verhält sich wie eine native App (auch offline).

## Funktionen

- ⏱️ **Timer** – Projekt wählen, Start/Stopp mit einem grossen Knopf. Ein
  laufender Timer bleibt auch nach dem Neuladen bestehen.
- 📁 **Projekte** – Name, Kunde, Farbe und (optional) Stundensatz in CHF.
  Projekte lassen sich archivieren oder löschen.
- ✍️ **Zeit nachtragen / bearbeiten** – Einträge manuell erfassen oder
  korrigieren (Start, Ende, Notiz, verrechenbar ja/nein).
- 📊 **Auswertung** – erfasste Zeit und verrechenbarer Betrag für Heute,
  diese Woche oder gesamt, aufgeschlüsselt nach Projekt.
- 📤 **CSV-Export** – für Buchhaltung / Rechnungsstellung.
- 💾 **Backup** – Daten als JSON exportieren und auf einem anderen Gerät wieder
  einlesen.

## Entwicklung

Voraussetzung: Node.js 20+.

```bash
npm install      # Abhängigkeiten installieren
npm run dev      # Entwicklungsserver (http://localhost:5173)
npm run build    # Produktions-Build nach dist/
npm run preview  # Produktions-Build lokal testen
```

## Technik

- [Vite](https://vite.dev/) + [React](https://react.dev/) + TypeScript
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) für Manifest, Service
  Worker und Offline-Fähigkeit
- Persistenz über `localStorage` (kein Backend)
- Keine UI-Bibliothek – schlankes, handgeschriebenes CSS

## Deployment

Der Build erzeugt eine statische Seite in `dist/`. Diese kann auf jedem
Static-Hosting laufen (Netlify, Vercel, GitHub Pages, eigener Webserver …).
Der `base`-Pfad ist relativ (`./`), damit die App auch aus einem Unterordner
funktioniert.

## Ausblick: Synchronisation mit Small Invoice / Moco

Das Datenmodell ist bereits auf eine spätere API-Anbindung vorbereitet:

- `Project` enthält Felder für **Kunde**, **Stundensatz** und eine **externe
  ID** (`externalId`), über die ein Projekt einem Projekt im Fremdsystem
  zugeordnet wird.
- `TimeEntry` enthält `externalId` und `syncedAt`, um erfasste Zeiten nach dem
  Übertragen zu markieren.

Damit lässt sich ein Abgleich mit
[Small Invoice](https://www.smallinvoice.com/) oder
[Moco](https://www.mocoapp.com/) über deren REST-API ergänzen, ohne das
bestehende Modell zu ändern. Für die MVP-Phase dient der CSV-Export als Brücke
zur Rechnungsstellung.
