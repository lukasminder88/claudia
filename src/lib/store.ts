// Schlanker, reaktiver Store mit localStorage-Persistenz.
//
// Bewusst ohne State-Management-Bibliothek: ein einfacher Publish/Subscribe-
// Mechanismus reicht und lässt sich über React `useSyncExternalStore` anbinden.

import { useSyncExternalStore } from 'react'
import type { AppState, Client, Project, Task, TimeEntry } from './types'

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
  return { clients: [], projects: [], tasks: [], entries: [] }
}

/** ID-Generator – nutzt crypto.randomUUID falls vorhanden. */
function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Alte Projektform (vor Einführung der Kunden-Hierarchie).
type LegacyProject = Project & { client?: string }

/** Migriert einen ggf. alten Zustand auf das aktuelle Modell (Kunde → Projekt
 *  → Task). Idempotent: bereits migrierte Daten bleiben unverändert. */
function migrate(parsed: Partial<AppState> | null): AppState {
  if (!parsed || !Array.isArray(parsed.projects)) return emptyState()

  const projects = (parsed.projects as LegacyProject[]) ?? []
  const entries = (parsed.entries as TimeEntry[]) ?? []

  // Bereits neues Format?
  if (Array.isArray(parsed.clients) && Array.isArray(parsed.tasks)) {
    return {
      clients: parsed.clients,
      projects: parsed.projects,
      tasks: parsed.tasks,
      entries,
      lastProjectId: parsed.lastProjectId,
      lastTaskId: parsed.lastTaskId,
    }
  }

  // Alt → neu: Kunden aus den bisherigen Freitext-Kundennamen erzeugen.
  const clientByName = new Map<string, Client>()
  const migratedProjects: Project[] = projects.map((p) => {
    let clientId: string | undefined
    const name = p.client?.trim()
    if (name) {
      let client = clientByName.get(name.toLowerCase())
      if (!client) {
        client = {
          id: newId(),
          name,
          archived: false,
          createdAt: new Date().toISOString(),
        }
        clientByName.set(name.toLowerCase(), client)
      }
      clientId = client.id
    }
    // `client`-Freitextfeld entfernen, `clientId` setzen.
    const { client: _drop, ...rest } = p
    void _drop
    return { ...rest, clientId }
  })

  return {
    clients: [...clientByName.values()],
    projects: migratedProjects,
    tasks: [],
    entries,
    lastProjectId: parsed.lastProjectId,
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    return migrate(JSON.parse(raw))
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

// ---- React-Hook -----------------------------------------------------------

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

// ---- Aktionen: Kunden -----------------------------------------------------

export function addClient(name: string): Client {
  const client: Client = {
    id: newId(),
    name: name.trim(),
    archived: false,
    createdAt: new Date().toISOString(),
  }
  setState((prev) => ({ ...prev, clients: [...prev.clients, client] }))
  return client
}

export function updateClient(id: string, patch: Partial<Client>) {
  setState((prev) => ({
    ...prev,
    clients: prev.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  }))
}

export function deleteClient(id: string) {
  // Löscht Kunde inkl. Projekte, deren Tasks und Zeiteinträge.
  setState((prev) => {
    const projectIds = new Set(
      prev.projects.filter((p) => p.clientId === id).map((p) => p.id),
    )
    return {
      ...prev,
      clients: prev.clients.filter((c) => c.id !== id),
      projects: prev.projects.filter((p) => p.clientId !== id),
      tasks: prev.tasks.filter((t) => !projectIds.has(t.projectId)),
      entries: prev.entries.filter((e) => !projectIds.has(e.projectId)),
    }
  })
}

// ---- Aktionen: Projekte ---------------------------------------------------

export function addProject(input: {
  name: string
  clientId?: string
  hourlyRate?: number
  color?: string
}): Project {
  const color =
    input.color ?? DEFAULT_COLORS[state.projects.length % DEFAULT_COLORS.length]
  const project: Project = {
    id: newId(),
    name: input.name.trim(),
    clientId: input.clientId,
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
  // Löscht das Projekt inkl. Tasks und aller zugehörigen Einträge.
  setState((prev) => ({
    ...prev,
    projects: prev.projects.filter((p) => p.id !== id),
    tasks: prev.tasks.filter((t) => t.projectId !== id),
    entries: prev.entries.filter((e) => e.projectId !== id),
    lastProjectId: prev.lastProjectId === id ? undefined : prev.lastProjectId,
  }))
}

// ---- Aktionen: Tasks ------------------------------------------------------

export function addTask(projectId: string, name: string): Task {
  const task: Task = {
    id: newId(),
    projectId,
    name: name.trim(),
    archived: false,
    createdAt: new Date().toISOString(),
  }
  setState((prev) => ({ ...prev, tasks: [...prev.tasks, task] }))
  return task
}

export function updateTask(id: string, patch: Partial<Task>) {
  setState((prev) => ({
    ...prev,
    tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  }))
}

export function deleteTask(id: string) {
  // Task löschen; zugehörige Einträge bleiben erhalten, verlieren aber den Task.
  setState((prev) => ({
    ...prev,
    tasks: prev.tasks.filter((t) => t.id !== id),
    entries: prev.entries.map((e) =>
      e.taskId === id ? { ...e, taskId: undefined } : e,
    ),
    lastTaskId: prev.lastTaskId === id ? undefined : prev.lastTaskId,
  }))
}

// ---- Moco-Import (Kunden/Projekte/Tasks abgleichen) -----------------------

export interface MocoTree {
  clients: { externalId: string; name: string }[]
  projects: {
    externalId: string
    name: string
    clientExternalId?: string
    hourlyRate?: number
    billable?: boolean
  }[]
  tasks: {
    externalId: string
    name: string
    projectExternalId: string
    billable?: boolean
  }[]
}

/** Gleicht Kunden, Projekte und Tasks aus Moco mit dem lokalen Bestand ab.
 *  Zuordnung erfolgt über die externe Moco-ID (`externalId`); vorhandene
 *  Einträge werden aktualisiert, neue angelegt. Lokale Zusatzdaten (z. B.
 *  Farbe) bleiben erhalten. */
export function applyMocoImport(tree: MocoTree): {
  clients: number
  projects: number
  tasks: number
} {
  let counts = { clients: 0, projects: 0, tasks: 0 }
  setState((prev) => {
    const now = new Date().toISOString()

    // --- Kunden ---
    const clientIdByExt = new Map<string, string>()
    prev.clients.forEach((c) => c.externalId && clientIdByExt.set(c.externalId, c.id))
    let clients = [...prev.clients]
    for (const c of tree.clients) {
      const localId = clientIdByExt.get(c.externalId)
      if (localId) {
        clients = clients.map((x) => (x.id === localId ? { ...x, name: c.name } : x))
      } else {
        const nc: Client = {
          id: newId(),
          name: c.name,
          archived: false,
          createdAt: now,
          externalId: c.externalId,
        }
        clients.push(nc)
        clientIdByExt.set(c.externalId, nc.id)
      }
    }

    // --- Projekte ---
    const projIdByExt = new Map<string, string>()
    prev.projects.forEach((p) => p.externalId && projIdByExt.set(p.externalId, p.id))
    let projects = [...prev.projects]
    let colorIdx = projects.length
    for (const p of tree.projects) {
      const clientId = p.clientExternalId
        ? clientIdByExt.get(p.clientExternalId)
        : undefined
      const localId = projIdByExt.get(p.externalId)
      if (localId) {
        projects = projects.map((x) =>
          x.id === localId
            ? { ...x, name: p.name, clientId, hourlyRate: p.hourlyRate ?? x.hourlyRate }
            : x,
        )
      } else {
        const np: Project = {
          id: newId(),
          name: p.name,
          clientId,
          color: DEFAULT_COLORS[colorIdx++ % DEFAULT_COLORS.length],
          hourlyRate: p.hourlyRate,
          archived: false,
          createdAt: now,
          externalId: p.externalId,
        }
        projects.push(np)
        projIdByExt.set(p.externalId, np.id)
      }
    }

    // --- Tasks ---
    const taskIdByExt = new Map<string, string>()
    prev.tasks.forEach((t) => t.externalId && taskIdByExt.set(t.externalId, t.id))
    let tasks = [...prev.tasks]
    for (const t of tree.tasks) {
      const projectId = projIdByExt.get(t.projectExternalId)
      if (!projectId) continue
      const localId = taskIdByExt.get(t.externalId)
      if (localId) {
        tasks = tasks.map((x) =>
          x.id === localId ? { ...x, name: t.name, projectId } : x,
        )
      } else {
        tasks.push({
          id: newId(),
          projectId,
          name: t.name,
          archived: false,
          createdAt: now,
          externalId: t.externalId,
        })
        taskIdByExt.set(t.externalId, 'new')
      }
    }

    counts = {
      clients: tree.clients.length,
      projects: tree.projects.length,
      tasks: tree.tasks.length,
    }
    return { ...prev, clients, projects, tasks }
  })
  return counts
}

/** Markiert einen Eintrag als zu Moco übertragen. */
export function markEntrySynced(entryId: string, mocoActivityId: string | number) {
  updateEntry(entryId, {
    externalId: String(mocoActivityId),
    syncedAt: new Date().toISOString(),
  })
}

// ---- Aktionen: Zeiteinträge ----------------------------------------------

/** Aktuell laufender Eintrag (end === null), falls vorhanden. */
export function runningEntry(s: AppState): TimeEntry | undefined {
  return s.entries.find((e) => e.end === null)
}

/** Startet den Timer für ein Projekt (optional Task). Ein evtl. laufender
 *  Timer wird gestoppt. */
export function startTimer(projectId: string, taskId?: string): TimeEntry {
  const now = new Date().toISOString()
  const entry: TimeEntry = {
    id: newId(),
    projectId,
    taskId,
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
      lastTaskId: taskId,
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
  taskId?: string
  start: string
  end: string
  note?: string
  billable?: boolean
}): TimeEntry {
  const entry: TimeEntry = {
    id: newId(),
    projectId: input.projectId,
    taskId: input.taskId,
    start: input.start,
    end: input.end,
    note: input.note?.trim() || undefined,
    billable: input.billable ?? true,
  }
  setState((prev) => ({
    ...prev,
    entries: [...prev.entries, entry],
    lastProjectId: input.projectId,
    lastTaskId: input.taskId,
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
  const parsed = JSON.parse(json) as Partial<AppState>
  if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.entries)) {
    throw new Error('Ungültiges Format')
  }
  setState(() => migrate(parsed))
}
