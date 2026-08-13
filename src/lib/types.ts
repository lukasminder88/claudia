// Datenmodell für Zeitraum.
//
// Die Felder `externalId` / `syncedAt` sind bereits vorgesehen, damit später
// eine Synchronisation mit Small Invoice oder Moco (via API) angedockt werden
// kann, ohne das Modell zu ändern.

export interface Project {
  id: string
  name: string
  /** Optionaler Kundenname – nützlich für die spätere Rechnungsstellung. */
  client?: string
  /** Farbe (Hex), zur schnellen visuellen Unterscheidung. */
  color: string
  /** Stundensatz in CHF, optional. Basis für spätere Rechnungen. */
  hourlyRate?: number
  archived: boolean
  createdAt: string
  /** ID des Projekts im externen System (Small Invoice / Moco). */
  externalId?: string
}

export interface TimeEntry {
  id: string
  projectId: string
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
  projects: Project[]
  entries: TimeEntry[]
  /** Zuletzt gewähltes Projekt, damit der Timer schnell startbereit ist. */
  lastProjectId?: string
}
