// Monatliche Abrechnung pro Kunde & Projekt – als Brücke zu PayrollPlus.
//
// PayrollPlus bietet (öffentlich) keine API. Dieser Report bereitet die
// verrechenbaren Stunden je Kunde und Projekt für einen Monat so auf, dass sie
// sich bequem als Einsatz im PayrollPlus-Portal erfassen lassen.

import type { AppState } from './types'
import { decimalHours, durationMs } from './time'

export interface PayrollProjectRow {
  name: string
  hours: number
  rate?: number
  amount: number
}

export interface PayrollClientGroup {
  name: string
  projects: PayrollProjectRow[]
  hours: number
  amount: number
}

export interface PayrollReport {
  year: number
  month: number // 0-basiert
  clients: PayrollClientGroup[]
  totalHours: number
  totalAmount: number
}

/** Erstellt den Monatsreport (nur verrechenbare, abgeschlossene Einträge). */
export function monthlyReport(
  state: AppState,
  year: number,
  month: number,
): PayrollReport {
  const start = new Date(year, month, 1).getTime()
  const end = new Date(year, month + 1, 1).getTime()

  const projById = new Map(state.projects.map((p) => [p.id, p]))
  const clientById = new Map(state.clients.map((c) => [c.id, c]))

  // clientKey -> { name, projectId -> { name, ms, rate } }
  const groups = new Map<
    string,
    { name: string; projects: Map<string, { name: string; ms: number; rate?: number }> }
  >()

  for (const e of state.entries) {
    if (e.end === null || !e.billable) continue
    const t = new Date(e.start).getTime()
    if (t < start || t >= end) continue
    const p = projById.get(e.projectId)
    if (!p) continue

    const clientKey = p.clientId ?? '__none__'
    const clientName = p.clientId
      ? clientById.get(p.clientId)?.name ?? 'Kunde'
      : 'Ohne Kunde'

    let g = groups.get(clientKey)
    if (!g) {
      g = { name: clientName, projects: new Map() }
      groups.set(clientKey, g)
    }
    let pr = g.projects.get(p.id)
    if (!pr) {
      pr = { name: p.name, ms: 0, rate: p.hourlyRate }
      g.projects.set(p.id, pr)
    }
    pr.ms += durationMs(e)
  }

  const clients: PayrollClientGroup[] = [...groups.values()]
    .map((g) => {
      const projects = [...g.projects.values()]
        .map((pr) => {
          const hours = decimalHours(pr.ms)
          const amount =
            pr.rate != null ? Math.round(hours * pr.rate * 100) / 100 : 0
          return { name: pr.name, hours, rate: pr.rate, amount }
        })
        .sort((a, b) => b.hours - a.hours)
      const hours = Math.round(projects.reduce((s, p) => s + p.hours, 0) * 100) / 100
      const amount = Math.round(projects.reduce((s, p) => s + p.amount, 0) * 100) / 100
      return { name: g.name, projects, hours, amount }
    })
    .sort((a, b) => b.amount - a.amount || b.hours - a.hours)

  const totalHours = Math.round(clients.reduce((s, c) => s + c.hours, 0) * 100) / 100
  const totalAmount = Math.round(clients.reduce((s, c) => s + c.amount, 0) * 100) / 100

  return { year, month, clients, totalHours, totalAmount }
}

function cell(v: string | number): string {
  const s = String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function num(n: number): string {
  return String(n).replace('.', ',')
}

/** CSV: eine Zeile je Kunde+Projekt für den Monat. */
export function payrollCsv(report: PayrollReport): string {
  const monthLabel = `${String(report.month + 1).padStart(2, '0')}.${report.year}`
  const header = [
    'Monat',
    'Kunde',
    'Projekt',
    'Stunden',
    'Stundensatz',
    'Betrag',
  ]
  const rows: (string | number)[][] = []
  for (const c of report.clients) {
    for (const p of c.projects) {
      rows.push([
        monthLabel,
        c.name,
        p.name,
        num(p.hours),
        p.rate != null ? num(p.rate) : '',
        p.amount ? num(p.amount) : '',
      ])
    }
  }
  return [header, ...rows]
    .map((r) => r.map(cell).join(';'))
    .join('\r\n')
}

export function downloadPayrollCsv(report: PayrollReport) {
  const monthLabel = `${report.year}-${String(report.month + 1).padStart(2, '0')}`
  const csv = payrollCsv(report)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payrollplus-${monthLabel}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
