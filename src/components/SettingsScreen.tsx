import { useRef } from 'react'
import type { AppState } from '../lib/types'
import { downloadCsv } from '../lib/csv'
import { exportState, importState } from '../lib/store'

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
          Deine Daten liegen ausschliesslich lokal auf diesem Gerät. Erstelle
          regelmässig ein Backup, das du auf einem neuen Gerät wieder einlesen
          kannst.
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

      <div className="section-label">Synchronisation</div>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>
          <span className="badge">Geplant</span>
        </p>
        <p className="hint">
          Eine direkte Anbindung an <strong>Small Invoice</strong> oder{' '}
          <strong>Moco</strong> über deren API ist vorbereitet: Projekte tragen
          bereits Felder für Kunde, Stundensatz und eine externe ID. Sobald du
          dich für einen Anbieter entscheidest, lässt sich der Abgleich der
          Projekte und der Zeiteinträge ergänzen – ohne Änderung am bestehenden
          Datenmodell.
        </p>
      </div>

      <p
        className="hint"
        style={{ textAlign: 'center', marginTop: 28, opacity: 0.6 }}
      >
        Zeitraum · v0.1
      </p>
    </div>
  )
}
