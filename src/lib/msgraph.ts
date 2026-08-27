// Microsoft-365-Kalender-Anbindung (Client-Seite).
//
// Anmeldung über MSAL (Microsoft Authentication Library) mit PKCE. Es wird KEIN
// Client-Secret benötigt und keiner gespeichert – die Tokens liegen nur im
// Browser (localStorage). Kalenderdaten werden direkt von Microsoft Graph
// gelesen (Graph erlaubt CORS für SPA-Registrierungen).

import { useSyncExternalStore } from 'react'
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
} from '@azure/msal-browser'

const SCOPES = ['User.Read', 'Calendars.Read']

// ---- Konfiguration (Client-ID / Tenant-ID) --------------------------------

export interface MsConfig {
  clientId: string
  tenantId: string
}

const CONFIG_KEY = 'zeitraum.ms.v1'

function loadConfig(): MsConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return { clientId: '', tenantId: '', ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { clientId: '', tenantId: '' }
}

let config: MsConfig = loadConfig()

export function getMsConfig(): MsConfig {
  return config
}

export function setMsConfig(patch: Partial<MsConfig>) {
  config = { ...config, ...patch }
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* ignore */
  }
  // Bei geänderter Konfiguration Instanz verwerfen.
  instance = null
  instanceKey = ''
  notify()
}

// ---- Auth-Status (reaktiv) ------------------------------------------------

interface MsAuthState {
  ready: boolean
  email?: string
  busy: boolean
  error?: string
}

let authState: MsAuthState = { ready: false, busy: false }
const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((l) => l())
}
function setAuth(patch: Partial<MsAuthState>) {
  authState = { ...authState, ...patch }
  notify()
}

export function useMsAuth(): MsAuthState & { config: MsConfig } {
  const state = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => authState,
    () => authState,
  )
  return { ...state, config }
}

// ---- MSAL-Instanz ---------------------------------------------------------

let instance: PublicClientApplication | null = null
let instanceKey = ''

async function getInstance(): Promise<PublicClientApplication | null> {
  if (!config.clientId || !config.tenantId) return null
  const key = `${config.clientId}|${config.tenantId}`
  if (instance && instanceKey === key) return instance
  const pca = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: window.location.origin,
    },
    cache: { cacheLocation: 'localStorage' },
  })
  await pca.initialize()
  instance = pca
  instanceKey = key
  return pca
}

function currentAccount(pca: PublicClientApplication): AccountInfo | undefined {
  const active = pca.getActiveAccount()
  if (active) return active
  const all = pca.getAllAccounts()
  if (all.length > 0) {
    pca.setActiveAccount(all[0])
    return all[0]
  }
  return undefined
}

/** Beim App-Start aufrufen: Instanz initialisieren und ggf. bestehende
 *  Anmeldung erkennen. */
export async function initMsAuth() {
  try {
    const pca = await getInstance()
    if (!pca) {
      setAuth({ ready: true, email: undefined })
      return
    }
    await pca.handleRedirectPromise().catch(() => undefined)
    const account = currentAccount(pca)
    setAuth({ ready: true, email: account?.username })
  } catch (err) {
    setAuth({ ready: true, error: String(err) })
  }
}

export async function signIn() {
  setAuth({ busy: true, error: undefined })
  try {
    const pca = await getInstance()
    if (!pca) throw new Error('Bitte zuerst Client-ID und Tenant-ID eintragen.')
    const result = await pca.loginPopup({ scopes: SCOPES, prompt: 'select_account' })
    pca.setActiveAccount(result.account)
    setAuth({ email: result.account?.username, busy: false })
  } catch (err) {
    setAuth({ busy: false, error: friendly(err) })
  }
}

export async function signOut() {
  const pca = await getInstance()
  const account = pca ? currentAccount(pca) : undefined
  try {
    if (pca && account) {
      await pca.logoutPopup({ account }).catch(() => undefined)
    }
  } finally {
    setAuth({ email: undefined })
  }
}

async function getToken(): Promise<string> {
  const pca = await getInstance()
  if (!pca) throw new Error('Microsoft ist nicht konfiguriert.')
  const account = currentAccount(pca)
  if (!account) throw new Error('Nicht angemeldet.')
  try {
    const res = await pca.acquireTokenSilent({ scopes: SCOPES, account })
    return res.accessToken
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const res = await pca.acquireTokenPopup({ scopes: SCOPES, account })
      return res.accessToken
    }
    throw err
  }
}

// ---- Kalender abrufen -----------------------------------------------------

export interface CalendarEvent {
  id: string
  subject: string
  /** ISO-UTC. */
  start: string
  /** ISO-UTC. */
  end: string
  isAllDay: boolean
  isOnline: boolean
  provider?: string
  organizer?: string
}

function toIso(dt?: { dateTime?: string }): string {
  const s = dt?.dateTime
  if (!s) return new Date().toISOString()
  // Graph liefert bei Prefer outlook.timezone="UTC" die Zeit ohne "Z".
  return s.endsWith('Z') ? s : `${s}Z`
}

/** Kalendertermine im Zeitraum [start, end] laden. */
export async function fetchCalendar(
  startDate: Date,
  endDate: Date,
): Promise<CalendarEvent[]> {
  const token = await getToken()
  const params = new URLSearchParams({
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    $select:
      'id,subject,start,end,isAllDay,isOnlineMeeting,onlineMeetingProvider,organizer',
    $orderby: 'start/dateTime',
    $top: '100',
  })
  const headers = {
    Authorization: `Bearer ${token}`,
    Prefer: 'outlook.timezone="UTC"',
  }

  const events: CalendarEvent[] = []
  let url: string | null = `https://graph.microsoft.com/v1.0/me/calendarView?${params}`
  // Bis zu 10 Seiten folgen (deckt sehr volle Kalender ab).
  for (let page = 0; page < 10 && url; page++) {
    const res: Response = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Graph ${res.status}: ${text.slice(0, 200)}`)
    }
    const data = await res.json()
    for (const ev of data.value ?? []) {
      events.push({
        id: ev.id,
        subject: ev.subject || '(ohne Titel)',
        start: toIso(ev.start),
        end: toIso(ev.end),
        isAllDay: !!ev.isAllDay,
        isOnline: !!ev.isOnlineMeeting,
        provider: ev.onlineMeetingProvider ?? undefined,
        organizer: ev.organizer?.emailAddress?.name ?? undefined,
      })
    }
    url = data['@odata.nextLink'] ?? null
  }
  return events
}

function friendly(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/popup_window_error|popup.*block/i.test(msg))
    return 'Popup wurde blockiert. Bitte Popups für diese Seite erlauben.'
  if (/user_cancelled/i.test(msg)) return 'Anmeldung abgebrochen.'
  return msg
}
