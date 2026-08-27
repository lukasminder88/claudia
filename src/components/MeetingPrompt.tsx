import { useEffect, useState } from 'react'
import type { AppState } from '../lib/types'
import { fetchCalendar, useMsAuth, type CalendarEvent } from '../lib/msgraph'
import {
  createEntryFromMeeting,
  dismissMeeting,
  setCalendarAssignment,
} from '../lib/store'
import { formatClock, formatDuration } from '../lib/time'
import { ProjectTaskSelect } from './CalendarScreen'

/** Fragt beim Öffnen der App nach bereits beendeten Meetings, die noch keinem
 *  Projekt zugeordnet wurden ("Du hattest Meeting xyz – zuordnen?"). */
export function MeetingPrompt({ state }: { state: AppState }) {
  const { email } = useMsAuth()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [hushed, setHushed] = useState(false)

  useEffect(() => {
    if (!email) return
    let alive = true
    ;(async () => {
      try {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const end = new Date() // bis jetzt → nur bereits vergangene Termine
        const evs = await fetchCalendar(start, end)
        if (alive) setEvents(evs)
      } catch {
        /* still im Hintergrund – kein Aufdrängen bei Fehler */
      }
    })()
    return () => {
      alive = false
    }
  }, [email])

  const now = Date.now()
  const pending = events
    .filter((ev) => !ev.isAllDay && new Date(ev.end).getTime() <= now)
    .filter((ev) => {
      const a = state.calendarAssignments.find((x) => x.eventId === ev.id)
      if (!a) return true
      if (a.dismissed) return false
      if (a.entryId && state.entries.some((e) => e.id === a.entryId)) return false
      return true
    })

  if (hushed || pending.length === 0) return null

  return (
    <div className="modal-backdrop" onClick={() => setHushed(true)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Meetings verbuchen</h2>
        <p className="hint" style={{ marginTop: -8, marginBottom: 16 }}>
          Diese Termine sind vorbei – möchtest du sie einem Projekt zuordnen?
        </p>

        {pending.map((ev) => {
          const assignment = state.calendarAssignments.find(
            (a) => a.eventId === ev.id,
          )
          const ms =
            new Date(ev.end).getTime() - new Date(ev.start).getTime()
          return (
            <div className="card" key={ev.id} style={{ marginBottom: 12, padding: 14 }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="entry-name">{ev.subject}</div>
                  <div className="entry-meta">
                    {formatClock(ev.start)}–{formatClock(ev.end)} · {formatDuration(ms)}
                  </div>
                </div>
                {ev.isOnline && <span className="badge badge-teams">Teams</span>}
              </div>

              <div style={{ marginTop: 10 }}>
                <ProjectTaskSelect
                  state={state}
                  projectId={assignment?.projectId}
                  taskId={assignment?.taskId}
                  onChange={(projectId, taskId) =>
                    setCalendarAssignment(ev.id, { projectId, taskId })
                  }
                />
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => dismissMeeting(ev.id)}
                >
                  Ignorieren
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={!assignment?.projectId}
                  onClick={() =>
                    createEntryFromMeeting(
                      {
                        eventId: ev.id,
                        start: ev.start,
                        end: ev.end,
                        subject: ev.subject,
                      },
                      assignment!.projectId!,
                      assignment?.taskId,
                    )
                  }
                >
                  Buchen
                </button>
              </div>
            </div>
          )
        })}

        <button
          className="btn btn-block"
          style={{ marginTop: 4 }}
          onClick={() => setHushed(true)}
        >
          Später
        </button>
      </div>
    </div>
  )
}
