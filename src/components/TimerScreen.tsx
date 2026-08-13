import { useEffect, useState } from 'react'
import type { AppState, TimeEntry } from '../lib/types'
import { runningEntry, startTimer, stopTimer } from '../lib/store'
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

  // Ausgewähltes Projekt für den nächsten Start.
  const [selectedId, setSelectedId] = useState<string>(
    state.lastProjectId ?? activeProjects[0]?.id ?? '',
  )
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [showManual, setShowManual] = useState(false)

  // Sekundengenauer Ticker, nur aktiv, solange ein Timer läuft.
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  const runningProject = running
    ? state.projects.find((p) => p.id === running.projectId)
    : undefined

  function handleBig() {
    if (running) {
      stopTimer()
    } else if (selectedId) {
      startTimer(selectedId)
    } else {
      onGoToProjects()
    }
  }

  const projectById = new Map(state.projects.map((p) => [p.id, p]))
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
            Lege zuerst ein Projekt an, dann kannst du die Zeit tracken.
          </div>
          <button className="btn btn-primary btn-block" onClick={onGoToProjects}>
            <PlusIcon /> Projekt anlegen
          </button>
        </div>
      ) : (
        <>
          <div className="timer-hero">
            <div className="timer-project">
              {running
                ? runningProject?.name ?? 'Läuft…'
                : projectById.get(selectedId)?.name ?? 'Projekt wählen'}
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
          </div>

          {!running && (
            <>
              <div className="section-label">Projekt wählen</div>
              <div className="project-chips">
                {activeProjects.map((p) => (
                  <button
                    key={p.id}
                    className={`chip ${selectedId === p.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="dot" style={{ background: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
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
                        <div className="entry-name">{p?.name ?? '—'}</div>
                        <div className="entry-meta">
                          {formatClock(e.start)}–
                          {e.end ? formatClock(e.end) : '…'}
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
          entry={editEntry}
          onClose={() => setEditEntry(null)}
        />
      )}
      {showManual && (
        <EntryEditor
          projects={activeProjects}
          defaultProjectId={selectedId}
          onClose={() => setShowManual(false)}
        />
      )}
    </div>
  )
}
