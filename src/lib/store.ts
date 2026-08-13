// Schlanker, reaktiver Store mit localStorage-Persistenz.
//
// Bewusst ohne State-Management-Bibliothek: ein einfacher Publish/Subscribe-
// Mechanismus reicht und lässt sich über React `useSyncExternalStore` anbinden.

import { useSyncExternalStore } from 'react'
import type { AppState, Project, TimeEntry } from './types'

const STORAGE_KEY = 'zeitraum.state.v1'

const DEFAULT_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
]

function emptyState(): AppState {
  return { projects: [], entries: [] }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as AppState
    return {
      projects: parsed.projects ?? [],
      entries: parsed.entries ?? [],
      lastProjectId: parsed.lastProjectId,
    }
  } catch {
    return emptyState()
  }
}

let state: AppState = loadState()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Speicher voll oder nicht verfügbar – App läuft weiter (nur ohne Persistenz).
  }
}

function setState(updater: (prev: AppState) => AppState) {
  state = updater(state)
  persist()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): AppState {
  return state
}

/** ID-Generator – nutzt crypto.randomUUID falls vorhanden. */
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ---- React-Hook -----------------------------------------------------------

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ---- Aktionen: Projekte ---------------------------------------------------

export function addProject(input: {
  name: string
  client?: string
  hourlyRate?: number
  color?: string
}): Project {
  const color =
    input.color ?? DEFAULT_COLORS[state.projects.length % DEFAULT_COLORS.length]
  const project: Project = {
    id: newId(),
    name: input.name.trim(),
    client: input.client?.trim() || undefined,
    hourlyRate: input.hourlyRate,
    color,
    archived: false,
    createdAt: new Date().toISOString(),
  }
  setState((prev) => ({ ...prev, projects: [...prev.projects, project] }))
  return project
}

export function updateProject(id: string, patch: Partial<Project>) {
  setState((prev) => ({
    ...prev,
    projects: prev.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  }))
}

export function archiveProject(id: string, archived = true) {
  updateProject(id, { archived })
}

export function deleteProject(id: string) {
  // Löscht das Projekt und alle zugehörigen Einträge.
  setState((prev) => ({
    ...prev,
    projects: prev.projects.filter((p) => p.id !== id),
    entries: prev.entries.filter((e) => e.projectId !== id),
    lastProjectId: prev.lastProjectId === id ? undefined : prev.lastProjectId,
  }))
}

// ---- Aktionen: Zeiteinträge ----------------------------------------------

/** Aktuell laufender Eintrag (end === null), falls vorhanden. */
export function runningEntry(s: AppState): TimeEntry | undefined {
  return s.entries.find((e) => e.end === null)
}

/** Startet den Timer für ein Projekt. Ein evtl. laufender Timer wird gestoppt. */
export function startTimer(projectId: string): TimeEntry {
  const now = new Date().toISOString()
  const entry: TimeEntry = {
    id: newId(),
    projectId,
    start: now,
    end: null,
    billable: true,
  }
  setState((prev) => {
    // Laufenden Eintrag zuerst beenden.
    const entries = prev.entries.map((e) =>
      e.end === null ? { ...e, end: now } : e,
    )
    return {
      ...prev,
      entries: [...entries, entry],
      lastProjectId: projectId,
    }
  })
  return entry
}

/** Stoppt den laufenden Timer. */
export function stopTimer() {
  const now = new Date().toISOString()
  setState((prev) => ({
    ...prev,
    entries: prev.entries.map((e) => (e.end === null ? { ...e, end: now } : e)),
  }))
}

export function addManualEntry(input: {
  projectId: string
  start: string
  end: string
  note?: string
  billable?: boolean
}): TimeEntry {
  const entry: TimeEntry = {
    id: newId(),
    projectId: input.projectId,
    start: input.start,
    end: input.end,
    note: input.note?.trim() || undefined,
    billable: input.billable ?? true,
  }
  setState((prev) => ({
    ...prev,
    entries: [...prev.entries, entry],
    lastProjectId: input.projectId,
  }))
  return entry
}

export function updateEntry(id: string, patch: Partial<TimeEntry>) {
  setState((prev) => ({
    ...prev,
    entries: prev.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  }))
}

export function deleteEntry(id: string) {
  setState((prev) => ({
    ...prev,
    entries: prev.entries.filter((e) => e.id !== id),
  }))
}

// ---- Import / Export ------------------------------------------------------

export function exportState(): string {
  return JSON.stringify(state, null, 2)
}

export function importState(json: string) {
  const parsed = JSON.parse(json) as AppState
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.entries)) {
    throw new Error('Ungültiges Format')
  }
  setState(() => ({
    projects: parsed.projects,
    entries: parsed.entries,
    lastProjectId: parsed.lastProjectId,
  }))
}
