import { applyUpdate, useNeedRefresh } from '../lib/pwa'

/** Zeigt einen Hinweis, sobald eine neue App-Version bereitsteht. */
export function UpdateBanner() {
  const needRefresh = useNeedRefresh()
  if (!needRefresh) return null
  return (
    <div className="update-banner">
      <span className="update-text">Neue Version verfügbar</span>
      <button className="btn btn-primary btn-sm" onClick={applyUpdate}>
        Aktualisieren
      </button>
    </div>
  )
}
