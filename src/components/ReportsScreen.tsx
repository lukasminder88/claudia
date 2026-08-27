import { useMemo, useState } from 'react'
import type { AppState } from '../lib/types'
import {
  decimalHours,
  durationMs,
  formatDuration,
  startOfToday,
  startOfWeek,
} from '../lib/time'

type Period = 'today' | 'week' | 'all'
type GroupBy = 'project' | 'task'

type Props = { state: AppState }

export function ReportsScreen({ state }: Props) {
  const [period, setPeriod] = useState<Period>('week')
  const [groupBy, setGroupBy] = useState<GroupBy>('project')

  const since = useMemo(() => {
    if (period === 'today') return startOfToday()
    if (period === 'week') return startOfWeek()
    return 0
  }, [period])

  const stats = useMemo(() => {
    const projectById = new Map(state.projects.map((p) => [p.id, p]))
    const clientById = new Map(state.clients.map((c) => [c.id, c]))
    const taskById = new Map(state.tasks.map((t) => [t.id, t]))

    const groups = new Map<
      string,
      { label: string; sub: string; color: string; ms: number }
    >()
    let totalMs = 0
    let totalAmount = 0

    for (const e of state.entries) {
      if (e.end === null) continue
      if (new Date(e.start).getTime() < since) continue
      const ms = durationMs(e)
      totalMs += ms
      const project = projectById.get(e.projectId)
      const rate = project?.hourlyRate
      if (e.billable && rate != null) totalAmount += decimalHours(ms) * rate

      const client = project?.clientId ? clientById.get(project.clientId) : undefined

      let key: string
      let label: string
      let sub: string
      if (groupBy === 'task') {
        const task = e.taskId ? taskById.get(e.taskId) : undefined
        key = e.taskId ?? `notask:${e.projectId}`
        label = task?.name ?? '(ohne Task)'
        sub = project?.name ?? '—'
      } else {
        key = e.projectId
        label = project?.name ?? '—'
        sub = client?.name ?? 'Ohne Kunde'
      }

      const cur = groups.get(key) ?? {
        label,
        sub,
        color: project?.color ?? '#666',
        ms: 0,
      }
      cur.ms += ms
      groups.set(key, cur)
    }

    const bars = [...groups.values()].sort((a, b) => b.ms - a.ms)
    return { totalMs, totalAmount, bars }
  }, [state, since, groupBy])

  const maxMs = Math.max(1, ...stats.bars.map((b) => b.ms))

  return (
    <div className="screen">
      <h1 className="screen-title">Auswertung</h1>

      <div className="project-chips" style={{ marginBottom: 14 }}>
        {(
          [
            ['today', 'Heute'],
            ['week', 'Diese Woche'],
            ['all', 'Gesamt'],
          ] as [Period, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={`chip ${period === key ? 'selected' : ''}`}
            onClick={() => setPeriod(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="value">{formatDuration(stats.totalMs)}</div>
          <div className="label">Erfasste Zeit</div>
        </div>
        <div className="stat">
          <div className="value">
            {stats.totalAmount > 0
              ? `CHF ${Math.round(stats.totalAmount).toLocaleString('de-CH')}`
              : '–'}
          </div>
          <div className="label">Verrechenbar</div>
        </div>
      </div>

      {stats.bars.length === 0 ? (
        <div className="empty">Keine Einträge in diesem Zeitraum.</div>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div className="section-label" style={{ margin: '8px 0' }}>
              Aufschlüsselung
            </div>
            <div className="segmented">
              <button
                className={groupBy === 'project' ? 'active' : ''}
                onClick={() => setGroupBy('project')}
              >
                Projekt
              </button>
              <button
                className={groupBy === 'task' ? 'active' : ''}
                onClick={() => setGroupBy('task')}
              >
                Task
              </button>
            </div>
          </div>

          {stats.bars.map((b, i) => (
            <div className="bar-row" key={i}>
              <div className="bar-head">
                <span className="bar-name">
                  {b.label}
                  <span className="bar-sub"> · {b.sub}</span>
                </span>
                <span className="bar-val">{formatDuration(b.ms)}</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${(b.ms / maxMs) * 100}%`, background: b.color }}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
