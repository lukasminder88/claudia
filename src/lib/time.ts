// Zeit-Hilfsfunktionen. Bewusst ohne externe Bibliothek gehalten,
// um die App schlank zu lassen.

import type { TimeEntry } from './types'

/** Dauer eines Eintrags in Millisekunden. Läuft der Eintrag noch, wird
 *  bis `now` gerechnet. */
export function durationMs(entry: TimeEntry, now: number = Date.now()): number {
  const start = new Date(entry.start).getTime()
  const end = entry.end ? new Date(entry.end).getTime() : now
  return Math.max(0, end - start)
}

/** Millisekunden als "1h 05m" formatieren. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

/** Millisekunden als "01:05:09" formatieren (für den laufenden Timer). */
export function formatStopwatch(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

/** Dezimalstunden, gerundet auf 2 Nachkommastellen (für CSV/Rechnung). */
export function decimalHours(ms: number): number {
  return Math.round((ms / 3600000) * 100) / 100
}

/** Uhrzeit "HH:MM" aus ISO-String. */
export function formatClock(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Datum als "YYYY-MM-DD" (lokale Zeitzone) – dient als Tages-Schlüssel. */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

/** Lesbare Tagesüberschrift, z. B. "Heute", "Gestern" oder "Mo, 12. Aug". */
export function formatDayHeading(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86400000)
  if (diffDays === 0) return 'Heute'
  if (diffDays === -1) return 'Gestern'
  return date.toLocaleDateString('de-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Start der aktuellen Woche (Montag, 00:00) als Timestamp. */
export function startOfWeek(now: number = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Montag = 0
  d.setDate(d.getDate() - day)
  return d.getTime()
}

/** Start des heutigen Tages als Timestamp. */
export function startOfToday(now: number = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Wandelt einen Date-Wert in den Wert für <input type="datetime-local"> um. */
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

/** Wandelt den Wert aus <input type="datetime-local"> zurück in ISO. */
export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString()
}
