// Geräte-Synchronisation: speichert den App-Zustand serverseitig (Netlify
// Blobs) und gleicht PC/Laptop ab.
//
// Modell: „letzte Änderung gewinnt" anhand eines Zeitstempels (updatedAt).
// Beim ERSTEN Aktivieren werden lokale und serverseitige Daten
// zusammengeführt (Vereinigung per ID), damit nichts verloren geht.

import { useSyncExternalStore } from 'react'
import type { AppState } from './types'
import { getMocoSettings } from './moco'
import { getStateSnapshot, replaceState, subscribeState } from './store'

const ENDPOINT = '/api/state'
const SETTINGS_KEY = 'zeitraum.sync.v1'
const POLL_MS = 20000

interface SyncSettings {
  enabled: boolean
  /** Wurde der erste Zusammenführungs-Abgleich bereits gemacht? */
  joined: boolean
  /** Version des lokalen Standes (ms). */
  updatedAt: number
  lastSyncAt?: string
}

function loadSettings(): SyncSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { enabled: false, joined: false, updatedAt: 0, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { enabled: false, joined: false, updatedAt: 0 }
}

let settings = loadSettings()

function persistSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

// ---- Reaktiver Status für die UI ------------------------------------------

interface SyncStatus {
  enabled: boolean
  busy: boolean
  error?: string
  lastSyncAt?: string
}

let status: SyncStatus = { enabled: settings.enabled, busy: false }
const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch }
  notify()
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => status,
    () => status,
  )
}

// ---- Netzwerk -------------------------------------------------------------

async function call(method: 'GET' | 'POST', body?: unknown): Promise<any> {
  const token = getMocoSettings().token
  if (!token) throw new Error('Kein Sync-Token gesetzt.')
  const res = await fetch(ENDPOINT, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-app-token': token },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`)
  return data
}

// ---- Zusammenführen -------------------------------------------------------

function mergeById<T>(a: T[], b: T[], key: keyof T): T[] {
  const seen = new Set(a.map((x) => x[key]))
  return [...a, ...b.filter((x) => !seen.has(x[key]))]
}

function mergeStates(local: AppState, remote: AppState): AppState {
  return {
    clients: mergeById(local.clients, remote.clients ?? [], 'id'),
    projects: mergeById(local.projects, remote.projects ?? [], 'id'),
    tasks: mergeById(local.tasks, remote.tasks ?? [], 'id'),
    entries: mergeById(local.entries, remote.entries ?? [], 'id'),
    calendarAssignments: mergeById(
      local.calendarAssignments ?? [],
      remote.calendarAssignments ?? [],
      'eventId',
    ),
    lastProjectId: local.lastProjectId ?? remote.lastProjectId,
    lastTaskId: local.lastTaskId ?? remote.lastTaskId,
  }
}

function hasData(s: AppState): boolean {
  return (
    s.clients.length > 0 ||
    s.projects.length > 0 ||
    s.tasks.length > 0 ||
    s.entries.length > 0
  )
}

// ---- Sync-Ablauf ----------------------------------------------------------

let applyingRemote = false
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let unsubscribe: (() => void) | null = null
let focusHandler: (() => void) | null = null

async function push(state: AppState) {
  await call('POST', { state, updatedAt: settings.updatedAt })
  setStatus({ lastSyncAt: new Date().toISOString() })
  settings.lastSyncAt = status.lastSyncAt
  persistSettings()
}

function adopt(remoteState: AppState, remoteUpdatedAt: number) {
  applyingRemote = true
  replaceState(remoteState)
  applyingRemote = false
  settings.updatedAt = remoteUpdatedAt
  settings.joined = true
  persistSettings()
}

/** Einmaliger Abgleich (Pull/Push/Merge nach Bedarf). */
export async function syncOnce() {
  if (!settings.enabled || !getMocoSettings().token) return
  setStatus({ busy: true, error: undefined })
  try {
    const remote = await call('GET')
    const local = getStateSnapshot()

    if (!remote.state) {
      // Server leer → lokalen Stand hochladen.
      if (settings.updatedAt === 0) settings.updatedAt = Date.now()
      settings.joined = true
      persistSettings()
      await push(local)
    } else if (!settings.joined && hasData(local)) {
      // Erstes Aktivieren mit lokalen Daten → zusammenführen.
      const merged = mergeStates(local, remote.state)
      settings.updatedAt = Date.now()
      applyingRemote = true
      replaceState(merged)
      applyingRemote = false
      settings.joined = true
      persistSettings()
      await push(getStateSnapshot())
    } else if (remote.updatedAt > settings.updatedAt) {
      adopt(remote.state, remote.updatedAt)
    } else if (settings.updatedAt > remote.updatedAt) {
      await push(local)
    } else {
      settings.joined = true
      persistSettings()
    }
    setStatus({ busy: false, lastSyncAt: status.lastSyncAt })
  } catch (err) {
    setStatus({ busy: false, error: err instanceof Error ? err.message : String(err) })
  }
}

function onLocalChange() {
  if (applyingRemote || !settings.enabled) return
  settings.updatedAt = Date.now()
  persistSettings()
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void push(getStateSnapshot()).catch(() => {})
  }, 1200)
}

function start() {
  if (unsubscribe) return // bereits aktiv
  unsubscribe = subscribeState(onLocalChange)
  pollTimer = setInterval(() => void syncOnce(), POLL_MS)
  focusHandler = () => {
    if (document.visibilityState === 'visible') void syncOnce()
  }
  document.addEventListener('visibilitychange', focusHandler)
  window.addEventListener('focus', focusHandler)
  void syncOnce()
}

function stop() {
  unsubscribe?.()
  unsubscribe = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  if (focusHandler) {
    document.removeEventListener('visibilitychange', focusHandler)
    window.removeEventListener('focus', focusHandler)
    focusHandler = null
  }
}

/** Beim App-Start aufrufen. */
export function initSync() {
  if (settings.enabled) start()
}

export function setSyncEnabled(enabled: boolean) {
  settings.enabled = enabled
  persistSettings()
  setStatus({ enabled, error: undefined })
  if (enabled) start()
  else stop()
}

export function isSyncEnabled(): boolean {
  return settings.enabled
}
