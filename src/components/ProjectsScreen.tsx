import { useState } from 'react'
import type { AppState, Client, Project } from '../lib/types'
import {
  addClient,
  addProject,
  addTask,
  archiveProject,
  deleteClient,
  deleteProject,
  deleteTask,
  updateClient,
  updateProject,
  updateTask,
} from '../lib/store'
import { PlusIcon, PencilIcon, TrashIcon } from './Icons'

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
  const [editingClient, setEditingClient] = useState<Client | 'new' | null>(null)
  const [projectSheet, setProjectSheet] = useState<
    { project?: Project; clientId?: string } | null
  >(null)

  const clients = state.clients.filter((c) => !c.archived)
  const projectsByClient = (clientId?: string) =>
    state.projects.filter((p) => !p.archived && p.clientId === clientId)
  const unassigned = projectsByClient(undefined)
  const archivedProjects = state.projects.filter((p) => p.archived)

  const isEmpty = state.clients.length === 0 && state.projects.length === 0

  return (
    <div className="screen">
      <h1 className="screen-title">Projekte</h1>

      <div className="row" style={{ marginBottom: 20 }}>
        <button className="btn" onClick={() => setEditingClient('new')}>
          <PlusIcon /> Kunde
        </button>
        <button
          className="btn btn-primary"
          onClick={() => setProjectSheet({})}
        >
          <PlusIcon /> Projekt
        </button>
      </div>

      {isEmpty && (
        <div className="empty">
          Noch nichts angelegt.
          <br />
          Erstelle einen Kunden und darunter Projekte mit Tasks.
        </div>
      )}

      {/* Kunden mit ihren Projekten */}
      {clients.map((client) => (
        <div className="client-block" key={client.id}>
          <div className="client-head">
            <span className="client-name">{client.name}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="icon-btn"
                onClick={() => setProjectSheet({ clientId: client.id })}
                aria-label="Projekt hinzufügen"
              >
                <PlusIcon />
              </button>
              <button
                className="icon-btn"
                onClick={() => setEditingClient(client)}
                aria-label="Kunde bearbeiten"
              >
                <PencilIcon />
              </button>
            </div>
          </div>
          {projectsByClient(client.id).length === 0 ? (
            <div className="client-empty">Noch keine Projekte</div>
          ) : (
            projectsByClient(client.id).map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                taskCount={
                  state.tasks.filter((t) => t.projectId === p.id && !t.archived)
                    .length
                }
                onOpen={() => setProjectSheet({ project: p })}
              />
            ))
          )}
        </div>
      ))}

      {/* Projekte ohne Kunde */}
      {unassigned.length > 0 && (
        <div className="client-block">
          <div className="client-head">
            <span className="client-name" style={{ color: 'var(--text-faint)' }}>
              Ohne Kunde
            </span>
          </div>
          {unassigned.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              taskCount={
                state.tasks.filter((t) => t.projectId === p.id && !t.archived)
                  .length
              }
              onOpen={() => setProjectSheet({ project: p })}
            />
          ))}
        </div>
      )}

      {/* Archiv */}
      {archivedProjects.length > 0 && (
        <>
          <div className="section-label">Archivierte Projekte</div>
          {archivedProjects.map((p) => (
            <ProjectRow
              key={p.id}
              project={p}
              taskCount={0}
              onOpen={() => setProjectSheet({ project: p })}
            />
          ))}
        </>
      )}

      {editingClient && (
        <ClientEditor
          client={editingClient === 'new' ? undefined : editingClient}
          onClose={() => setEditingClient(null)}
        />
      )}
      {projectSheet && (
        <ProjectSheet
          state={state}
          project={projectSheet.project}
          presetClientId={projectSheet.clientId}
          onClose={() => setProjectSheet(null)}
        />
      )}
    </div>
  )
}

function ProjectRow({
  project,
  taskCount,
  onOpen,
}: {
  project: Project
  taskCount: number
  onOpen: () => void
}) {
  return (
    <button className="list-item" onClick={onOpen} style={{ width: '100%', textAlign: 'left' }}>
      <span
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
          {taskCount > 0 ? `${taskCount} Task${taskCount === 1 ? '' : 's'}` : 'Keine Tasks'}
          {project.hourlyRate != null && ` · CHF ${project.hourlyRate}/h`}
        </div>
      </div>
      <PencilIcon className="row-chevron" />
    </button>
  )
}

// ---- Kunde bearbeiten -----------------------------------------------------

function ClientEditor({
  client,
  onClose,
}: {
  client?: Client
  onClose: () => void
}) {
  const [name, setName] = useState(client?.name ?? '')
  const [error, setError] = useState('')

  function save() {
    if (!name.trim()) {
      setError('Bitte einen Namen eingeben.')
      return
    }
    if (client) updateClient(client.id, { name: name.trim() })
    else addClient(name)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{client ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h2>

        <div className="field">
          <label>Name</label>
          <input
            className="input"
            type="text"
            value={name}
            placeholder="z. B. Muster AG"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
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

        {client && (
          <button
            className="btn btn-danger btn-block"
            style={{ marginTop: 10 }}
            onClick={() => {
              if (
                confirm(
                  'Kunde inkl. aller Projekte, Tasks und Zeiteinträge löschen?',
                )
              ) {
                deleteClient(client.id)
                onClose()
              }
            }}
          >
            Kunde löschen
          </button>
        )}
      </div>
    </div>
  )
}

// ---- Projekt-Sheet (Projektdaten + Tasks) ---------------------------------

function ProjectSheet({
  state,
  project,
  presetClientId,
  onClose,
}: {
  state: AppState
  project?: Project
  presetClientId?: string
  onClose: () => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [clientId, setClientId] = useState(project?.clientId ?? presetClientId ?? '')
  const [rate, setRate] = useState(
    project?.hourlyRate != null ? String(project.hourlyRate) : '',
  )
  const [color, setColor] = useState(project?.color ?? COLORS[0])
  const [error, setError] = useState('')
  const [newTask, setNewTask] = useState('')

  const tasks = project
    ? state.tasks.filter((t) => t.projectId === project.id)
    : []

  function save() {
    if (!name.trim()) {
      setError('Bitte einen Projektnamen eingeben.')
      return
    }
    const hourlyRate = rate.trim() ? Number(rate.replace(',', '.')) : undefined
    if (hourlyRate != null && Number.isNaN(hourlyRate)) {
      setError('Stundensatz muss eine Zahl sein.')
      return
    }
    const fields = {
      name: name.trim(),
      clientId: clientId || undefined,
      hourlyRate,
      color,
    }
    if (project) updateProject(project.id, fields)
    else addProject(fields)
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
            autoFocus={!project}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Kunde</label>
          <select
            className="select"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">— kein Kunde —</option>
            {state.clients
              .filter((c) => !c.archived)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
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

        {/* Tasks – nur für bereits gespeicherte Projekte */}
        {project && (
          <div className="field">
            <label>Tasks</label>
            {tasks.filter((t) => !t.archived).length === 0 && (
              <p className="hint" style={{ marginTop: 0 }}>
                Noch keine Tasks. Füge unten welche hinzu (z. B. „Konzept",
                „Design", „Umsetzung").
              </p>
            )}
            {tasks
              .filter((t) => !t.archived)
              .map((t) => (
                <div className="task-row" key={t.id}>
                  <span className="task-name">{t.name}</span>
                  <button
                    className="icon-btn"
                    aria-label="Task umbenennen"
                    onClick={() => {
                      const n = window.prompt('Task umbenennen', t.name)
                      if (n && n.trim()) updateTask(t.id, { name: n.trim() })
                    }}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Task löschen"
                    onClick={() => {
                      if (confirm(`Task „${t.name}" löschen?`)) deleteTask(t.id)
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            <div className="row" style={{ marginTop: 8 }}>
              <input
                className="input"
                type="text"
                value={newTask}
                placeholder="Neuer Task…"
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTask.trim()) {
                    addTask(project.id, newTask)
                    setNewTask('')
                  }
                }}
                style={{ flex: 3 }}
              />
              <button
                className="btn"
                style={{ flex: 1 }}
                onClick={() => {
                  if (newTask.trim()) {
                    addTask(project.id, newTask)
                    setNewTask('')
                  }
                }}
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="hint" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}

        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" onClick={onClose}>
            {project ? 'Fertig' : 'Abbrechen'}
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
                    'Projekt inkl. Tasks und Zeiteinträgen unwiderruflich löschen?',
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
