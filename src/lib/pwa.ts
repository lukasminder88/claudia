// PWA-Update-Handling: registriert den Service Worker und meldet, wenn eine
// neue Version bereitsteht, damit die App einen "Aktualisieren"-Hinweis zeigen
// kann (statt still im Hintergrund zu wechseln).

import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

let needRefresh = false
let updateSW: (reload?: boolean) => Promise<void> = async () => {}
const listeners = new Set<() => void>()

function notify() {
  needRefresh = true
  listeners.forEach((l) => l())
}

/** Einmalig beim App-Start aufrufen. */
export function initPwa() {
  if (typeof window === 'undefined') return
  updateSW = registerSW({
    onNeedRefresh() {
      notify()
    },
  })
}

/** True, sobald eine neue Version installiert und aktivierbar ist. */
export function useNeedRefresh(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => needRefresh,
    () => needRefresh,
  )
}

/** Neue Version aktivieren und App neu laden. */
export function applyUpdate() {
  void updateSW(true)
}
