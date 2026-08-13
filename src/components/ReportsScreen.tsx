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

type Props = { state: AppState }

export function ReportsScreen({ state }: Props) {
  const [period, setPeriod] = useState<Period>('week')

  const since = useMemo(() => {
    if (period === 'today') return startOfToday()
    if (period === 'week') return startOfWeek()
    return 0
  }, [period])

  const stats = useMemo(() => {
    const projectById = new Map(state.projects.map((p) => [p.id, p]))
    const perProject = new Map<
      string,
      { ms: number; amount: number; billableMs: number }
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
      const amount =
        e.billable && rate != null ? decimalHours(ms) * rate : 0
      totalAmount += amount

      const cur = perProject.get(e.projectId) ?? {
        ms: 0,
        amount: 0,
        billableMs: 0,
      }
      cur.ms += ms
      cur.amount += amount
      if (e.billable) cur.billableMs += ms
      perProject.set(e.projectId, cur)
    }

    const bars = [...perProject.entries()]
      .map(([projectId, v]) => ({
        project: projectById.get(projectId),
        ...v,
      }))
      .sort((a, b) => b.ms - a.ms)

    return { totalMs, totalAmount, bars }
  }, [state, since])

  const maxMs = Math.max(1, ...stats.bars.map((b) => b.ms))

  return (
    <div className="screen">
      <h1 className="screen-title">Auswertung</h1>

      <div className="project-chips" style={{ marginBottom: 20 }}>
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
          <div className="section-label">Nach Projekt</div>
          {stats.bars.map((b) => (
            <div className="bar-row" key={b.project?.id ?? 'none'}>
              <div className="bar-head">
                <span className="bar-name">{b.project?.name ?? '—'}</span>
                <span className="bar-val">{formatDuration(b.ms)}</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${(b.ms / maxMs) * 100}%`,
                    background: b.project?.color ?? '#666',
                  }}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
