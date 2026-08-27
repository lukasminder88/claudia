import { useEffect, useState } from 'react'
import type { AppState, TimeEntry } from '../lib/types'
import { runningEntry, startTimer, stopTimer, updateEntry } from '../lib/store'
import {
  durationMs,
  formatDuration,
  formatStopwatch,
  formatClock,
  dayKey,
  formatDayHeading,
} from '../lib/time'
import { PlayIcon, StopIcon, PlusIcon } from './Icons'
import { EntryEditor } from './EntryEditor'

type Props = {
  state: AppState
  onGoToProjects: () => void
}

/** Home-Screen: grosser Start/Stopp-Timer plus Schnellauswahl & Verlauf. */
export function TimerScreen({ state, onGoToProjects }: Props) {
  const running = runningEntry(state)
  const activeProjects = state.projects.filter((p) => !p.archived)

  // Ausgewähltes Projekt / Task für den nächsten Start.
  const [selectedId, setSelectedId] = useState<string>(
    state.lastProjectId ?? activeProjects[0]?.id ?? '',
  )
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [showManual, setShowManual] = useState(false)
  // Notiz zum aktuell laufenden Eintrag (lokal, wird live gespeichert).
  const [noteInput, setNoteInput] = useState('')

  // Sekundengenauer Ticker, nur aktiv, solange ein Timer läuft.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  // Notizfeld auf den jeweils laufenden Eintrag synchronisieren.
  const runningId = running?.id
  useEffect(() => {
    setNoteInput(running?.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningId])

  const projectById = new Map(state.projects.map((p) => [p.id, p]))
  const clientById = new Map(state.clients.map((c) => [c.id, c]))
  const taskById = new Map(state.tasks.map((t) => [t.id, t]))

  // Tasks des aktuell gewählten Projekts (für die Schnellauswahl).
  const selectedTasks = state.tasks.filter(
    (t) => t.projectId === selectedId && !t.archived,
  )

  const runningProject = running ? projectById.get(running.projectId) : undefined
  const runningTask = running?.taskId ? taskById.get(running.taskId) : undefined
  const runningClient = runningProject?.clientId
    ? clientById.get(runningProject.clientId)
    : undefined

  const selectedProject = projectById.get(selectedId)
  const selectedClient = selectedProject?.clientId
    ? clientById.get(selectedProject.clientId)
    : undefined

  function selectProject(id: string) {
    setSelectedId(id)
    setSelectedTaskId('') // Task-Auswahl zurücksetzen
  }

  function handleBig() {
    if (running) {
      stopTimer()
    } else if (selectedId) {
      startTimer(selectedId, selectedTaskId || undefined)
    } else {
      onGoToProjects()
    }
  }

  const recent = [...state.entries]
    .filter((e) => e.end !== null)
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, 12)

  // Verlauf nach Tag gruppieren.
  const groups: { key: string; items: TimeEntry[] }[] = []
  for (const e of recent) {
    const key = dayKey(e.start)
    let g = groups.find((x) => x.key === key)
    if (!g) {
      g = { key, items: [] }
      groups.push(g)
    }
    g.items.push(e)
  }

  return (
    <div className="screen">
      <h1 className="screen-title">Zeitraum</h1>

      {activeProjects.length === 0 ? (
        <div className="card">
          <div className="empty">
            Noch kein Projekt vorhanden.
            <br />
            Lege zuerst einen Kunden und ein Projekt an, dann kannst du die Zeit
            tracken.
          </div>
          <button className="btn btn-primary btn-block" onClick={onGoToProjects}>
            <PlusIcon /> Projekt anlegen
          </button>
        </div>
      ) : (
        <>
          <div className="timer-hero">
            <div className="timer-project">
              {running ? (
                <>
                  {runningClient && (
                    <span className="timer-client">{runningClient.name} · </span>
                  )}
                  {runningProject?.name ?? 'Läuft…'}
                </>
              ) : (
                <>
                  {selectedClient && (
                    <span className="timer-client">{selectedClient.name} · </span>
                  )}
                  {selectedProject?.name ?? 'Projekt wählen'}
                </>
              )}
            </div>
            <div className="timer-task">
              {running
                ? runningTask?.name ?? ''
                : selectedTaskId
                  ? taskById.get(selectedTaskId)?.name ?? ''
                  : ''}
            </div>
            <div className={`timer-clock ${running ? '' : 'idle'}`}>
              {running ? formatStopwatch(durationMs(running)) : '00:00:00'}
            </div>
            <button
              className={`big-btn ${running ? 'stop' : 'start'}`}
              onClick={handleBig}
              aria-label={running ? 'Stoppen' : 'Starten'}
            >
              {running ? <StopIcon /> : <PlayIcon />}
              {running ? 'Stopp' : 'Start'}
            </button>

            {running && (
              <input
                className="input timer-note"
                type="text"
                value={noteInput}
                placeholder="Notiz zu dieser Zeit…"
                onChange={(e) => {
                  setNoteInput(e.target.value)
                  updateEntry(running.id, {
                    note: e.target.value.trim() || undefined,
                  })
                }}
              />
            )}
          </div>

          {!running && (
            <>
              <div className="section-label">Projekt wählen</div>
              <div className="project-chips">
                {activeProjects.map((p) => {
                  const client = p.clientId ? clientById.get(p.clientId) : undefined
                  return (
                    <button
                      key={p.id}
                      className={`chip ${selectedId === p.id ? 'selected' : ''}`}
                      onClick={() => selectProject(p.id)}
                    >
                      <span className="dot" style={{ background: p.color }} />
                      <span className="chip-labels">
                        {client && <span className="chip-client">{client.name}</span>}
                        {p.name}
                      </span>
                    </button>
                  )
                })}
              </div>

              {selectedTasks.length > 0 && (
                <>
                  <div className="section-label">Task wählen</div>
                  <div className="project-chips">
                    <button
                      className={`chip ${selectedTaskId === '' ? 'selected' : ''}`}
                      onClick={() => setSelectedTaskId('')}
                    >
                      Ohne Task
                    </button>
                    {selectedTasks.map((t) => (
                      <button
                        key={t.id}
                        className={`chip ${selectedTaskId === t.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTaskId(t.id)}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Verlauf */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 28,
        }}
      >
        <div className="section-label" style={{ margin: 0 }}>
          Letzte Einträge
        </div>
        {activeProjects.length > 0 && (
          <button
            className="btn btn-sm"
            onClick={() => setShowManual(true)}
            aria-label="Zeit nachtragen"
          >
            <PlusIcon /> Nachtragen
          </button>
        )}
      </div>

      {recent.length === 0 ? (
        <div className="empty">Noch keine Einträge.</div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {groups.map((g) => {
            const total = g.items.reduce((sum, e) => sum + durationMs(e), 0)
            return (
              <div className="day-group" key={g.key}>
                <div className="day-head">
                  <span className="day-title">{formatDayHeading(g.key)}</span>
                  <span className="day-total">{formatDuration(total)}</span>
                </div>
                {g.items.map((e) => {
                  const p = projectById.get(e.projectId)
                  const task = e.taskId ? taskById.get(e.taskId) : undefined
                  const client = p?.clientId ? clientById.get(p.clientId) : undefined
                  return (
                    <button
                      key={e.id}
                      className="entry"
                      onClick={() => setEditEntry(e)}
                      style={{ width: '100%', textAlign: 'left' }}
                    >
                      <span
                        className="dot"
                        style={{ background: p?.color ?? '#666' }}
                      />
                      <div className="entry-body">
                        <div className="entry-name">
                          {p?.name ?? '—'}
                          {task && <span className="entry-task"> · {task.name}</span>}
                        </div>
                        <div className="entry-meta">
                          {client ? `${client.name} · ` : ''}
                          {formatClock(e.start)}–{e.end ? formatClock(e.end) : '…'}
                          {!e.billable && ' · nicht verrechenbar'}
                        </div>
                        {e.note && <div className="entry-note">{e.note}</div>}
                      </div>
                      <span className="entry-dur">
                        {formatDuration(durationMs(e))}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {editEntry && (
        <EntryEditor
          projects={state.projects}
          tasks={state.tasks}
          entry={editEntry}
          onClose={() => setEditEntry(null)}
        />
      )}
      {showManual && (
        <EntryEditor
          projects={activeProjects}
          tasks={state.tasks}
          defaultProjectId={selectedId}
          defaultTaskId={selectedTaskId || undefined}
          onClose={() => setShowManual(false)}
        />
      )}
    </div>
  )
}
