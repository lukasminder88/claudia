import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '../lib/types'
import {
  fetchCalendar,
  signIn,
  useMsAuth,
  type CalendarEvent,
} from '../lib/msgraph'
import { createEntryFromMeeting, setCalendarAssignment } from '../lib/store'
import {
  dayKey,
  formatClock,
  formatDayHeading,
  formatDuration,
} from '../lib/time'

type Props = {
  state: AppState
  onGoToSettings: () => void
}

/** Wiederverwendbarer Projekt-/Task-Auswähler. */
export function ProjectTaskSelect({
  state,
  projectId,
  taskId,
  onChange,
}: {
  state: AppState
  projectId?: string
  taskId?: string
  onChange: (projectId: string | undefined, taskId: string | undefined) => void
}) {
  const projects = state.projects.filter((p) => !p.archived)
  const tasks = state.tasks.filter(
    (t) => t.projectId === projectId && !t.archived,
  )
  return (
    <div className="row" style={{ gap: 8 }}>
      <select
        className="select"
        value={projectId ?? ''}
        onChange={(e) => onChange(e.target.value || undefined, undefined)}
      >
        <option value="">— Projekt —</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {tasks.length > 0 && (
        <select
          className="select"
          value={taskId ?? ''}
          onChange={(e) => onChange(projectId, e.target.value || undefined)}
        >
          <option value="">— Task —</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export function CalendarScreen({ state, onGoToSettings }: Props) {
  const { ready, email, busy, config, error } = useMsAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const configured = !!config.clientId && !!config.tenantId

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 7)
      setEvents(await fetchCalendar(start, end))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (email) void load()
  }, [email, load])

  // --- Zustände: nicht konfiguriert / nicht angemeldet ---
  if (!configured) {
    return (
      <div className="screen">
        <h1 className="screen-title">Kalender</h1>
        <div className="card">
          <p className="hint" style={{ marginTop: 0 }}>
            Verbinde deinen Microsoft-365-Kalender, um Meetings direkt einem
            Projekt zuzuweisen und als Zeit zu verbuchen.
          </p>
          <button className="btn btn-primary btn-block" onClick={onGoToSettings}>
            Microsoft-Kalender einrichten
          </button>
        </div>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="screen">
        <h1 className="screen-title">Kalender</h1>
        <div className="card">
          <p className="hint" style={{ marginTop: 0 }}>
            Melde dich mit deinem Microsoft-Konto an, um deine Termine zu sehen.
          </p>
          <button
            className="btn btn-primary btn-block"
            disabled={busy || !ready}
            onClick={() => void signIn()}
          >
            {busy ? 'Anmelden…' : 'Mit Microsoft anmelden'}
          </button>
          {error && (
            <p className="hint" style={{ color: 'var(--danger)', marginTop: 10 }}>
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }

  // --- Angemeldet: Termine anzeigen ---
  const now = Date.now()
  const timed = events.filter((e) => !e.isAllDay)
  const groups: { key: string; items: CalendarEvent[] }[] = []
  for (const e of timed) {
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
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1 className="screen-title" style={{ margin: 0 }}>
          Kalender
        </h1>
        <button className="btn btn-sm" onClick={() => void load()} disabled={loading}>
          {loading ? 'Lädt…' : 'Aktualisieren'}
        </button>
      </div>
      <p className="hint" style={{ marginTop: 4, marginBottom: 16 }}>
        Angemeldet als {email}
      </p>

      {loadError && (
        <p className="hint" style={{ color: 'var(--danger)' }}>
          {loadError}
        </p>
      )}

      {!loading && timed.length === 0 && (
        <div className="empty">Keine Termine in den nächsten 7 Tagen.</div>
      )}

      {groups.map((g) => (
        <div className="day-group" key={g.key}>
          <div className="day-head">
            <span className="day-title">{formatDayHeading(g.key)}</span>
          </div>
          {g.items.map((ev) => (
            <MeetingCard
              key={ev.id}
              state={state}
              event={ev}
              ended={new Date(ev.end).getTime() <= now}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Karte für einen einzelnen Termin inkl. Projekt-Zuweisung und Buchung. */
export function MeetingCard({
  state,
  event,
  ended,
}: {
  state: AppState
  event: CalendarEvent
  ended: boolean
}) {
  const assignment = state.calendarAssignments.find(
    (a) => a.eventId === event.id,
  )
  const bookedEntry = assignment?.entryId
    ? state.entries.find((e) => e.id === assignment.entryId)
    : undefined

  const ms = new Date(event.end).getTime() - new Date(event.start).getTime()

  return (
    <div className="card" style={{ marginBottom: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div className="entry-name">{event.subject}</div>
          <div className="entry-meta">
            {formatClock(event.start)}–{formatClock(event.end)} ·{' '}
            {formatDuration(ms)}
            {event.organizer ? ` · ${event.organizer}` : ''}
          </div>
        </div>
        {event.isOnline && <span className="badge badge-teams">Teams</span>}
      </div>

      {bookedEntry ? (
        <div className="booked-note">✓ Als Zeit gebucht</div>
      ) : (
        <>
          <div style={{ marginTop: 10 }}>
            <ProjectTaskSelect
              state={state}
              projectId={assignment?.projectId}
              taskId={assignment?.taskId}
              onChange={(projectId, taskId) =>
                setCalendarAssignment(event.id, { projectId, taskId })
              }
            />
          </div>
          <div style={{ marginTop: 10 }}>
            {ended ? (
              <button
                className="btn btn-primary btn-block btn-sm"
                disabled={!assignment?.projectId}
                onClick={() =>
                  createEntryFromMeeting(
                    {
                      eventId: event.id,
                      start: event.start,
                      end: event.end,
                      subject: event.subject,
                    },
                    assignment!.projectId!,
                    assignment?.taskId,
                  )
                }
              >
                {assignment?.projectId ? 'Als Zeit buchen' : 'Projekt wählen zum Buchen'}
              </button>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                {assignment?.projectId
                  ? 'Vorgemerkt – wird nach dem Meeting buchbar.'
                  : 'Projekt vorab zuweisen (optional).'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
