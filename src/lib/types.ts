// Datenmodell für Zeitraum.
//
// Hierarchie: Kunde → Projekt → Task. Zeiteinträge hängen an einem Projekt und
// optional zusätzlich an einem Task.
//
// Die Felder `externalId` / `syncedAt` sind bereits vorgesehen, damit später
// eine Synchronisation mit Small Invoice oder Moco (via API) angedockt werden
// kann, ohne das Modell zu ändern.

export interface Client {
  id: string
  name: string
  archived: boolean
  createdAt: string
  /** ID des Kunden im externen System (Small Invoice / Moco). */
  externalId?: string
}

export interface Project {
  id: string
  name: string
  /** Zugehöriger Kunde. Optional – ein Projekt kann auch ohne Kunde bestehen. */
  clientId?: string
  /** Farbe (Hex), zur schnellen visuellen Unterscheidung. */
  color: string
  /** Stundensatz in CHF, optional. Basis für spätere Rechnungen. */
  hourlyRate?: number
  archived: boolean
  createdAt: string
  /** ID des Projekts im externen System (Small Invoice / Moco). */
  externalId?: string
}

export interface Task {
  id: string
  projectId: string
  name: string
  archived: boolean
  createdAt: string
  /** ID des Tasks im externen System (Small Invoice / Moco). */
  externalId?: string
}

export interface TimeEntry {
  id: string
  projectId: string
  /** Zugehöriger Task. Optional – Zeit kann auch ohne Task erfasst werden. */
  taskId?: string
  /** Startzeitpunkt als ISO-String. */
  start: string
  /** Endzeitpunkt als ISO-String. `null`, solange der Eintrag läuft. */
  end: string | null
  note?: string
  /** Ob die Zeit verrechenbar ist (Standard: true). */
  billable: boolean
  /** ID des Eintrags im externen System, sobald synchronisiert. */
  externalId?: string
  /** Zeitpunkt der letzten Synchronisation. */
  syncedAt?: string
}

export interface AppState {
  clients: Client[]
  projects: Project[]
  tasks: Task[]
  entries: TimeEntry[]
  /** Zuletzt gewähltes Projekt, damit der Timer schnell startbereit ist. */
  lastProjectId?: string
  /** Zuletzt gewählter Task (zum jeweiligen Projekt). */
  lastTaskId?: string
}
