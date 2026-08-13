// CSV-Export der Zeiteinträge – als Brücke zur Rechnungsstellung, bis die
// direkte API-Anbindung (Small Invoice / Moco) steht.

import type { AppState } from './types'
import { decimalHours, durationMs } from './time'

function csvCell(value: string | number): string {
  const s = String(value)
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function entriesToCsv(state: AppState): string {
  const projectById = new Map(state.projects.map((p) => [p.id, p]))
  const header = [
    'Datum',
    'Projekt',
    'Kunde',
    'Start',
    'Ende',
    'Dauer (h)',
    'Verrechenbar',
    'Stundensatz',
    'Betrag',
    'Notiz',
  ]

  const rows = state.entries
    .filter((e) => e.end !== null)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => {
      const project = projectById.get(e.projectId)
      const hours = decimalHours(durationMs(e))
      const rate = project?.hourlyRate
      const amount = rate != null ? Math.round(hours * rate * 100) / 100 : ''
      const fmt = (iso: string | null) =>
        iso ? new Date(iso).toLocaleString('de-CH') : ''
      return [
        new Date(e.start).toLocaleDateString('de-CH'),
        project?.name ?? '—',
        project?.client ?? '',
        fmt(e.start),
        fmt(e.end),
        String(hours).replace('.', ','),
        e.billable ? 'ja' : 'nein',
        rate != null ? String(rate) : '',
        amount !== '' ? String(amount).replace('.', ',') : '',
        e.note ?? '',
      ]
    })

  return [header, ...rows]
    .map((row) => row.map(csvCell).join(';'))
    .join('\r\n')
}

/** Löst den Download einer CSV-Datei im Browser aus. */
export function downloadCsv(state: AppState, filename = 'zeitraum-export.csv') {
  const csv = entriesToCsv(state)
  // BOM voranstellen, damit Excel UTF-8 korrekt erkennt.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
