import { useMemo, useState } from 'react'
import type { Project, Task, TimeEntry } from '../lib/types'
import { addManualEntry, deleteEntry, updateEntry } from '../lib/store'
import { fromDatetimeLocal, toDatetimeLocal } from '../lib/time'

type Props = {
  projects: Project[]
  tasks: Task[]
  /** Zu bearbeitender Eintrag, oder undefined für einen neuen Eintrag. */
  entry?: TimeEntry
  defaultProjectId?: string
  defaultTaskId?: string
  onClose: () => void
}

/** Modal zum Anlegen bzw. Bearbeiten eines Zeiteintrags. */
export function EntryEditor({
  projects,
  tasks,
  entry,
  defaultProjectId,
  defaultTaskId,
  onClose,
}: Props) {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 3600000)

  const [projectId, setProjectId] = useState(
    entry?.projectId ?? defaultProjectId ?? projects[0]?.id ?? '',
  )
  const [taskId, setTaskId] = useState<string>(
    entry?.taskId ?? defaultTaskId ?? '',
  )
  const [start, setStart] = useState(
    toDatetimeLocal(entry?.start ?? oneHourAgo.toISOString()),
  )
  const [end, setEnd] = useState(toDatetimeLocal(entry?.end ?? now.toISOString()))
  const [note, setNote] = useState(entry?.note ?? '')
  const [billable, setBillable] = useState(entry?.billable ?? true)
  const [error, setError] = useState('')

  // Tasks des gewählten Projekts (aktive + der aktuell zugewiesene).
  const projectTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.projectId === projectId && (!t.archived || t.id === taskId),
      ),
    [tasks, projectId, taskId],
  )

  function changeProject(id: string) {
    setProjectId(id)
    // Task zurücksetzen, wenn er nicht zum neuen Projekt gehört.
    if (!tasks.some((t) => t.id === taskId && t.projectId === id)) {
      setTaskId('')
    }
  }

  function save() {
    if (!projectId) {
      setError('Bitte ein Projekt wählen.')
      return
    }
    const startIso = fromDatetimeLocal(start)
    const endIso = fromDatetimeLocal(end)
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setError('Das Ende muss nach dem Start liegen.')
      return
    }
    const fields = {
      projectId,
      taskId: taskId || undefined,
      start: startIso,
      end: endIso,
      note: note.trim() || undefined,
      billable,
    }
    if (entry) {
      updateEntry(entry.id, fields)
    } else {
      addManualEntry(fields)
    }
    onClose()
  }

  function remove() {
    if (entry && confirm('Diesen Eintrag löschen?')) {
      deleteEntry(entry.id)
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">
          {entry ? 'Eintrag bearbeiten' : 'Zeit nachtragen'}
        </h2>

        <div className="field">
          <label>Projekt</label>
          <select
            className="select"
            value={projectId}
            onChange={(e) => changeProject(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {projectTasks.length > 0 && (
          <div className="field">
            <label>Task</label>
            <select
              className="select"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
            >
              <option value="">— kein Task —</option>
              {projectTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="row">
          <div className="field">
            <label>Start</label>
            <input
              className="input"
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Ende</label>
            <input
              className="input"
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label>Notiz</label>
          <input
            className="input"
            type="text"
            value={note}
            placeholder="Woran hast du gearbeitet?"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="field">
          <label className="toggle">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
            />
            Verrechenbar
          </label>
        </div>

        {error && (
          <p className="hint" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn btn-primary" onClick={save}>
            Speichern
          </button>
        </div>

        {entry && (
          <button
            className="btn btn-danger btn-block"
            style={{ marginTop: 10 }}
            onClick={remove}
          >
            Eintrag löschen
          </button>
        )}
      </div>
    </div>
  )
}
