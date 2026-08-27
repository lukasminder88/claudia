// Moco-Anbindung (Client-Seite).
//
// Alle Aufrufe gehen an die eigene Netlify-Function `/api/moco`, die als
// sicherer Proxy zur Moco-API dient. Der Moco-API-Schlüssel liegt serverseitig;
// hier wird nur das frei gewählte Sync-Token mitgeschickt.

import { useSyncExternalStore } from 'react'
import type { AppState, Project, Task, TimeEntry } from './types'
import { applyMocoImport, markEntrySynced, type MocoTree } from './store'
import { dayKey, durationMs } from './time'

const ENDPOINT = '/api/moco'

// ---- Lokale Einstellungen (nur auf diesem Gerät) --------------------------

export interface MocoSettings {
  /** Sync-Token, identisch zur Netlify-Variable APP_SYNC_TOKEN. */
  token: string
  /** Zeiten nach dem Stoppen automatisch übertragen. */
  autoSync: boolean
  /** Zeitpunkt der letzten erfolgreichen Übertragung. */
  lastSyncAt?: string
}

const SETTINGS_KEY = 'zeitraum.moco.v1'

function loadSettings(): MocoSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { token: '', autoSync: false, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { token: '', autoSync: false }
}

let settings: MocoSettings = loadSettings()
const settingsListeners = new Set<() => void>()

export function getMocoSettings(): MocoSettings {
  return settings
}

export function setMocoSettings(patch: Partial<MocoSettings>) {
  settings = { ...settings, ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
  settingsListeners.forEach((l) => l())
}

export function useMocoSettings(): MocoSettings {
  return useSyncExternalStore(
    (l) => {
      settingsListeners.add(l)
      return () => settingsListeners.delete(l)
    },
    () => settings,
    () => settings,
  )
}

// ---- API-Aufrufe ----------------------------------------------------------

async function call(
  method: 'GET' | 'POST',
  query = '',
  body?: unknown,
): Promise<any> {
  const res = await fetch(`${ENDPOINT}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-app-token': settings.token,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Fehler ${res.status}`)
  }
  return data
}

/** Verbindungstest. */
export async function mocoStatus(): Promise<{ ok: boolean; status: number }> {
  return call('GET', '?action=status')
}

/** Projektbaum aus Moco holen und lokal abgleichen. */
export async function importFromMoco(): Promise<{
  clients: number
  projects: number
  tasks: number
}> {
  const tree = (await call('GET', '?action=projects')) as MocoTree
  const counts = applyMocoImport(tree)
  setMocoSettings({ lastSyncAt: new Date().toISOString() })
  return counts
}

// ---- Übertragung der Zeiten -----------------------------------------------

export interface PushableEntry {
  entry: TimeEntry
  project?: Project
  task?: Task
  /** Kann übertragen werden (Projekt + Task sind mit Moco verknüpft). */
  ok: boolean
  reason?: string
}

/** Ermittelt abgeschlossene, noch nicht übertragene Einträge. */
export function pushableEntries(state: AppState): PushableEntry[] {
  const projById = new Map(state.projects.map((p) => [p.id, p]))
  const taskById = new Map(state.tasks.map((t) => [t.id, t]))
  return state.entries
    .filter((e) => e.end !== null && !e.externalId)
    .map((e) => {
      const project = projById.get(e.projectId)
      const task = e.taskId ? taskById.get(e.taskId) : undefined
      let reason: string | undefined
      if (!project?.externalId) reason = 'Projekt nicht mit Moco verknüpft'
      else if (!task) reason = 'Kein Task gewählt'
      else if (!task.externalId) reason = 'Task nicht mit Moco verknüpft'
      return { entry: e, project, task, ok: !reason, reason }
    })
}

let pushInFlight = false

/** Überträgt alle übertragbaren Einträge nach Moco. Idempotent: bereits
 *  übertragene Einträge (mit externalId) werden übersprungen. */
export async function pushPending(state: AppState): Promise<{
  pushed: number
  skipped: number
  errors: string[]
}> {
  if (pushInFlight) return { pushed: 0, skipped: 0, errors: [] }
  pushInFlight = true
  const errors: string[] = []
  let pushed = 0
  let skipped = 0
  try {
    const candidates = pushableEntries(state)
    for (const c of candidates) {
      if (!c.ok || !c.project || !c.task) {
        skipped++
        continue
      }
      try {
        const result = await call('POST', '', {
          action: 'create_activity',
          date: dayKey(c.entry.start),
          project_id: c.project.externalId,
          task_id: c.task.externalId,
          seconds: Math.round(durationMs(c.entry) / 1000),
          description: c.entry.note || c.task.name,
          billable: c.entry.billable,
        })
        markEntrySynced(c.entry.id, result.id)
        pushed++
      } catch (err) {
        errors.push(
          `${c.project.name}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
    if (pushed > 0) setMocoSettings({ lastSyncAt: new Date().toISOString() })
  } finally {
    pushInFlight = false
  }
  return { pushed, skipped, errors }
}
