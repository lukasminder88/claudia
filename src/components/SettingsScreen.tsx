import { useMemo, useRef, useState } from 'react'
import type { AppState } from '../lib/types'
import { downloadCsv } from '../lib/csv'
import { exportState, importState } from '../lib/store'
import {
  importFromMoco,
  mocoStatus,
  pushPending,
  pushableEntries,
  setMocoSettings,
  useMocoSettings,
} from '../lib/moco'

type Props = { state: AppState }

export function SettingsScreen({ state }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const finished = state.entries.filter((e) => e.end !== null).length

  function exportJson() {
    const blob = new Blob([exportState()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const date = new Date().toISOString().slice(0, 10)
    a.download = `zeitraum-backup-${date}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importState(String(reader.result))
        alert('Backup erfolgreich importiert.')
      } catch {
        alert('Import fehlgeschlagen: ungültige Datei.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="screen">
      <h1 className="screen-title">Einstellungen</h1>

      <MocoSection state={state} />

      <div className="section-label">Export</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="hint" style={{ marginTop: 0 }}>
          {finished} abgeschlossene Einträge. Exportiere sie als CSV für deine
          Buchhaltung oder Rechnungsstellung.
        </p>
        <button
          className="btn btn-primary btn-block"
          onClick={() => downloadCsv(state)}
          style={{ marginTop: 6 }}
        >
          Als CSV exportieren
        </button>
      </div>

      <div className="section-label">Datensicherung</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="hint" style={{ marginTop: 0 }}>
          Deine Daten liegen lokal auf diesem Gerät. Erstelle regelmässig ein
          Backup, das du auf einem neuen Gerät wieder einlesen kannst.
        </p>
        <button className="btn btn-block" onClick={exportJson}>
          Backup speichern (JSON)
        </button>
        <button
          className="btn btn-block"
          style={{ marginTop: 8 }}
          onClick={() => fileRef.current?.click()}
        >
          Backup einlesen
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
      </div>

      <p
        className="hint"
        style={{ textAlign: 'center', marginTop: 28, opacity: 0.6 }}
      >
        Zeitraum · v0.2
      </p>
    </div>
  )
}

// ---- Moco-Synchronisation -------------------------------------------------

function MocoSection({ state }: { state: AppState }) {
  const settings = useMocoSettings()
  const [token, setToken] = useState(settings.token)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)

  const pushable = useMemo(() => pushableEntries(state), [state])
  const ready = pushable.filter((p) => p.ok).length
  const blocked = pushable.filter((p) => !p.ok).length

  const configured = token.trim().length > 0

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(label)
    setMsg(null)
    try {
      const text = await fn()
      setMsg({ text })
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : String(err),
        error: true,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="section-label">Moco-Synchronisation</div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="field">
          <label>Sync-Token</label>
          <input
            className="input"
            type="password"
            value={token}
            placeholder="wie in Netlify APP_SYNC_TOKEN"
            autoComplete="off"
            onChange={(e) => setToken(e.target.value)}
            onBlur={() => setMocoSettings({ token: token.trim() })}
          />
          <p className="hint" style={{ marginTop: 6 }}>
            Muss mit der Netlify-Umgebungsvariable <strong>APP_SYNC_TOKEN</strong>{' '}
            übereinstimmen. Dein Moco-API-Schlüssel liegt sicher auf dem Server,
            nicht hier.
          </p>
        </div>

        <button
          className="btn btn-block"
          disabled={!configured || busy !== null}
          onClick={() =>
            run('status', async () => {
              setMocoSettings({ token: token.trim() })
              const r = await mocoStatus()
              return r.ok
                ? 'Verbindung erfolgreich ✓'
                : `Verbindung fehlgeschlagen (Status ${r.status})`
            })
          }
        >
          {busy === 'status' ? 'Prüfe…' : 'Verbindung testen'}
        </button>

        <button
          className="btn btn-block"
          style={{ marginTop: 8 }}
          disabled={!configured || busy !== null}
          onClick={() =>
            run('import', async () => {
              const c = await importFromMoco()
              return `Importiert: ${c.clients} Kunden, ${c.projects} Projekte, ${c.tasks} Tasks.`
            })
          }
        >
          {busy === 'import' ? 'Importiere…' : 'Projekte von Moco importieren'}
        </button>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: 8 }}
          disabled={!configured || busy !== null || ready === 0}
          onClick={() =>
            run('push', async () => {
              const r = await pushPending(state)
              const parts = [`${r.pushed} übertragen`]
              if (r.skipped) parts.push(`${r.skipped} übersprungen`)
              if (r.errors.length) parts.push(`${r.errors.length} Fehler`)
              return parts.join(', ') + '.'
            })
          }
        >
          {busy === 'push'
            ? 'Übertrage…'
            : `Zeiten übertragen${ready > 0 ? ` (${ready})` : ''}`}
        </button>

        <label className="toggle" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            checked={settings.autoSync}
            onChange={(e) => setMocoSettings({ autoSync: e.target.checked })}
          />
          Automatisch übertragen (nach dem Stoppen)
        </label>

        {blocked > 0 && (
          <p className="hint" style={{ marginTop: 10 }}>
            {blocked} Eintrag/Einträge lassen sich noch nicht übertragen – sie
            brauchen ein mit Moco verknüpftes Projekt <em>und</em> einen Task.
            Importiere zuerst deine Moco-Projekte und tracke darauf.
          </p>
        )}

        {settings.lastSyncAt && (
          <p className="hint" style={{ marginTop: 10 }}>
            Zuletzt synchronisiert:{' '}
            {new Date(settings.lastSyncAt).toLocaleString('de-CH')}
          </p>
        )}

        {msg && (
          <p
            className="hint"
            style={{
              marginTop: 10,
              color: msg.error ? 'var(--danger)' : 'var(--success)',
              fontWeight: 600,
            }}
          >
            {msg.text}
          </p>
        )}
      </div>
    </>
  )
}
