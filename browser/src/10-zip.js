/* ZIP lesen und schreiben – ohne Fremdbibliothek.

   Ein .xlsx und ein .docx sind ZIP-Archive. Der Browser bringt mit
   DecompressionStream und CompressionStream alles mit, was dafür nötig ist;
   die Rahmenstruktur des Archivs schreiben wir selbst. */

const ZIP = (() => {
  "use strict";

  // --- CRC32 -------------------------------------------------------------
  const TABELLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      c = TABELLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // --- Hilfen ------------------------------------------------------------
  const enc = new TextEncoder();
  const dec = new TextDecoder("utf-8");

  async function inflate(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  async function deflate(bytes) {
    const s = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }

  // --- Lesen -------------------------------------------------------------

  /** Liest ein ZIP und liefert eine Map: Name -> Uint8Array. */
  async function lesen(puffer) {
    const bytes = new Uint8Array(puffer);
    const sicht = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Ende des zentralen Verzeichnisses rückwärts suchen.
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 65536; i--) {
      if (sicht.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Kein ZIP-Archiv: Verzeichnisende nicht gefunden.");

    const anzahl = sicht.getUint16(eocd + 10, true);
    let zeiger = sicht.getUint32(eocd + 16, true);

    const eintraege = new Map();
    const reihenfolge = [];
    for (let n = 0; n < anzahl; n++) {
      if (sicht.getUint32(zeiger, true) !== 0x02014b50) break;
      const methode = sicht.getUint16(zeiger + 10, true);
      const gepackt = sicht.getUint32(zeiger + 20, true);
      const nameLaenge = sicht.getUint16(zeiger + 28, true);
      const extraLaenge = sicht.getUint16(zeiger + 30, true);
      const kommentar = sicht.getUint16(zeiger + 32, true);
      const lokal = sicht.getUint32(zeiger + 42, true);
      const name = dec.decode(bytes.subarray(zeiger + 46, zeiger + 46 + nameLaenge));

      // Lokaler Kopf: die Längenfelder dort sind massgeblich.
      const lokalNameLaenge = sicht.getUint16(lokal + 26, true);
      const lokalExtraLaenge = sicht.getUint16(lokal + 28, true);
      const start = lokal + 30 + lokalNameLaenge + lokalExtraLaenge;
      const roh = bytes.subarray(start, start + gepackt);

      eintraege.set(name, { methode, roh });
      reihenfolge.push(name);
      zeiger += 46 + nameLaenge + extraLaenge + kommentar;
    }

    const dateien = new Map();
    for (const name of reihenfolge) {
      const e = eintraege.get(name);
      dateien.set(name, e.methode === 0 ? e.roh.slice() : await inflate(e.roh));
    }
    dateien.reihenfolge = reihenfolge;
    return dateien;
  }

  /** Eine Datei aus dem Archiv als Text. */
  function text(dateien, name) {
    const b = dateien.get(name);
    if (!b) throw new Error(`Im Archiv fehlt: ${name}`);
    return dec.decode(b);
  }

  // --- Schreiben ---------------------------------------------------------

  /** Schreibt eine Map (Name -> Uint8Array | string) als ZIP-Blob. */
  async function schreiben(dateien, reihenfolge) {
    const namen = reihenfolge || [...dateien.keys()];
    const teile = [];
    const verzeichnis = [];
    let versatz = 0;

    for (const name of namen) {
      let inhalt = dateien.get(name);
      if (inhalt === undefined) continue;
      if (typeof inhalt === "string") inhalt = enc.encode(inhalt);

      const roh = crc32(inhalt);
      const gepackt = await deflate(inhalt);
      // Nur komprimiert ablegen, wenn es wirklich kleiner wird.
      const komprimiert = gepackt.length < inhalt.length;
      const daten = komprimiert ? gepackt : inhalt;
      const methode = komprimiert ? 8 : 0;
      const nameBytes = enc.encode(name);

      const kopf = new Uint8Array(30 + nameBytes.length);
      const kv = new DataView(kopf.buffer);
      kv.setUint32(0, 0x04034b50, true);
      kv.setUint16(4, 20, true);          // Version
      kv.setUint16(6, 0x0800, true);      // UTF-8-Namen
      kv.setUint16(8, methode, true);
      kv.setUint16(10, 0, true);          // Zeit
      kv.setUint16(12, 0x21, true);       // Datum: 2000-01-01
      kv.setUint32(14, roh, true);
      kv.setUint32(18, daten.length, true);
      kv.setUint32(22, inhalt.length, true);
      kv.setUint16(26, nameBytes.length, true);
      kv.setUint16(28, 0, true);
      kopf.set(nameBytes, 30);

      teile.push(kopf, daten);
      verzeichnis.push({ name: nameBytes, methode, roh, gepackt: daten.length,
                         roheGroesse: inhalt.length, versatz });
      versatz += kopf.length + daten.length;
    }

    const zentralStart = versatz;
    for (const e of verzeichnis) {
      const z = new Uint8Array(46 + e.name.length);
      const zv = new DataView(z.buffer);
      zv.setUint32(0, 0x02014b50, true);
      zv.setUint16(4, 20, true);
      zv.setUint16(6, 20, true);
      zv.setUint16(8, 0x0800, true);
      zv.setUint16(10, e.methode, true);
      zv.setUint16(12, 0, true);
      zv.setUint16(14, 0x21, true);
      zv.setUint32(16, e.roh, true);
      zv.setUint32(20, e.gepackt, true);
      zv.setUint32(24, e.roheGroesse, true);
      zv.setUint16(28, e.name.length, true);
      zv.setUint32(42, e.versatz, true);
      z.set(e.name, 46);
      teile.push(z);
      versatz += z.length;
    }

    const ende = new Uint8Array(22);
    const ev = new DataView(ende.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, verzeichnis.length, true);
    ev.setUint16(10, verzeichnis.length, true);
    ev.setUint32(12, versatz - zentralStart, true);
    ev.setUint32(16, zentralStart, true);
    teile.push(ende);

    return new Blob(teile, { type: "application/zip" });
  }

  return { lesen, schreiben, text, crc32 };
})();
