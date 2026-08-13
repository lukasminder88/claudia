import { useState } from 'react'
import type { AppState, Project } from '../lib/types'
import {
  addProject,
  archiveProject,
  deleteProject,
  updateProject,
} from '../lib/store'
import { PlusIcon, PencilIcon } from './Icons'

const COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
]

type Props = { state: AppState }

export function ProjectsScreen({ state }: Props) {
  const [editing, setEditing] = useState<Project | 'new' | null>(null)

  const active = state.projects.filter((p) => !p.archived)
  const archived = state.projects.filter((p) => p.archived)

  return (
    <div className="screen">
      <h1 className="screen-title">Projekte</h1>

      <button
        className="btn btn-primary btn-block"
        onClick={() => setEditing('new')}
        style={{ marginBottom: 20 }}
      >
        <PlusIcon /> Neues Projekt
      </button>

      {active.length === 0 && archived.length === 0 && (
        <div className="empty">
          Noch keine Projekte.
          <br />
          Lege dein erstes Projekt an, um Zeit zu tracken.
        </div>
      )}

      {active.map((p) => (
        <ProjectRow key={p.id} project={p} onEdit={() => setEditing(p)} />
      ))}

      {archived.length > 0 && (
        <>
          <div className="section-label">Archiviert</div>
          {archived.map((p) => (
            <ProjectRow key={p.id} project={p} onEdit={() => setEditing(p)} />
          ))}
        </>
      )}

      {editing && (
        <ProjectEditor
          project={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function ProjectRow({
  project,
  onEdit,
}: {
  project: Project
  onEdit: () => void
}) {
  return (
    <div className="list-item">
      <span
        className="dot"
        style={{
          background: project.color,
          width: 14,
          height: 14,
          borderRadius: '50%',
          flexShrink: 0,
        }}
      />
      <div className="grow">
        <div className="title">{project.name}</div>
        <div className="sub">
          {project.client ? project.client : 'Kein Kunde'}
          {project.hourlyRate != null && ` · CHF ${project.hourlyRate}/h`}
        </div>
      </div>
      <button className="icon-btn" onClick={onEdit} aria-label="Bearbeiten">
        <PencilIcon />
      </button>
    </div>
  )
}

function ProjectEditor({
  project,
  onClose,
}: {
  project?: Project
  onClose: () => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [client, setClient] = useState(project?.client ?? '')
  const [rate, setRate] = useState(
    project?.hourlyRate != null ? String(project.hourlyRate) : '',
  )
  const [color, setColor] = useState(project?.color ?? COLORS[0])
  const [error, setError] = useState('')

  function save() {
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    const hourlyRate = rate.trim() ? Number(rate.replace(',', '.')) : undefined
    if (hourlyRate != null && Number.isNaN(hourlyRate)) {
      setError('Stundensatz muss eine Zahl sein.')
      return
    }
    if (project) {
      updateProject(project.id, {
        name: name.trim(),
        client: client.trim() || undefined,
        hourlyRate,
        color,
      })
    } else {
      addProject({ name, client, hourlyRate, color })
    }
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">
          {project ? 'Projekt bearbeiten' : 'Neues Projekt'}
        </h2>

        <div className="field">
          <label>Projektname</label>
          <input
            className="input"
            type="text"
            value={name}
            placeholder="z. B. Website Relaunch"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Kunde (optional)</label>
          <input
            className="input"
            type="text"
            value={client}
            placeholder="z. B. Muster AG"
            onChange={(e) => setClient(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Stundensatz CHF (optional)</label>
          <input
            className="input"
            type="text"
            inputMode="decimal"
            value={rate}
            placeholder="z. B. 140"
            onChange={(e) => setRate(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Farbe</label>
          <div className="color-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${color === c ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`Farbe ${c}`}
              />
            ))}
          </div>
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

        {project && (
          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-block"
              onClick={() => {
                archiveProject(project.id, !project.archived)
                onClose()
              }}
            >
              {project.archived ? 'Wieder aktivieren' : 'Archivieren'}
            </button>
            <button
              className="btn btn-danger btn-block"
              style={{ marginTop: 8 }}
              onClick={() => {
                if (
                  confirm(
                    'Projekt und alle zugehörigen Zeiteinträge unwiderruflich löschen?',
                  )
                ) {
                  deleteProject(project.id)
                  onClose()
                }
              }}
            >
              Projekt löschen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
