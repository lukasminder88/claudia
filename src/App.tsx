import { useEffect, useRef, useState } from 'react'
import { runningEntry, useStore } from './lib/store'
import { TimerScreen } from './components/TimerScreen'
import { ProjectsScreen } from './components/ProjectsScreen'
import { ReportsScreen } from './components/ReportsScreen'
import { SettingsScreen } from './components/SettingsScreen'
import { CalendarScreen } from './components/CalendarScreen'
import { MeetingPrompt } from './components/MeetingPrompt'
import { pushPending, pushableEntries, useMocoSettings } from './lib/moco'
import { initMsAuth } from './lib/msgraph'
import type { AppState } from './lib/types'
import {
  TimerIcon,
  ListIcon,
  ChartIcon,
  GearIcon,
  CalendarIcon,
} from './components/Icons'

type Tab = 'timer' | 'projects' | 'calendar' | 'reports' | 'settings'

/** Überträgt abgeschlossene Einträge automatisch nach Moco, sobald Auto-Sync
 *  aktiv ist und gerade kein Timer läuft. */
function useMocoAutoSync(state: AppState) {
  const settings = useMocoSettings()
  const running = runningEntry(state)
  const ready = pushableEntries(state).filter((p) => p.ok).length
  const lastAttempt = useRef(-1)

  useEffect(() => {
    if (!settings.autoSync || !settings.token || running || ready === 0) return
    // Nur einmal pro „Ready-Stand" versuchen (verhindert Schleifen bei Fehlern).
    if (lastAttempt.current === ready) return
    lastAttempt.current = ready
    const id = setTimeout(() => {
      void pushPending(state)
    }, 1500)
    return () => clearTimeout(id)
  }, [settings.autoSync, settings.token, running, ready, state])
}

export default function App() {
  const state = useStore()
  const [tab, setTab] = useState<Tab>('timer')
  useMocoAutoSync(state)

  // Microsoft-Anmeldung beim Start initialisieren (falls konfiguriert).
  useEffect(() => {
    void initMsAuth()
  }, [])

  return (
    <div className="app">
      {tab === 'timer' && (
        <TimerScreen state={state} onGoToProjects={() => setTab('projects')} />
      )}
      {tab === 'projects' && <ProjectsScreen state={state} />}
      {tab === 'calendar' && (
        <CalendarScreen state={state} onGoToSettings={() => setTab('settings')} />
      )}
      {tab === 'reports' && <ReportsScreen state={state} />}
      {tab === 'settings' && <SettingsScreen state={state} />}

      {/* Fragt beim Öffnen nach beendeten Meetings (falls Kalender verbunden). */}
      <MeetingPrompt state={state} />

      <nav className="tabbar">
        <div className="tabbar-inner">
          <TabButton
            active={tab === 'timer'}
            onClick={() => setTab('timer')}
            label="Timer"
            icon={<TimerIcon />}
          />
          <TabButton
            active={tab === 'projects'}
            onClick={() => setTab('projects')}
            label="Projekte"
            icon={<ListIcon />}
          />
          <TabButton
            active={tab === 'calendar'}
            onClick={() => setTab('calendar')}
            label="Kalender"
            icon={<CalendarIcon />}
          />
          <TabButton
            active={tab === 'reports'}
            onClick={() => setTab('reports')}
            label="Auswertung"
            icon={<ChartIcon />}
          />
          <TabButton
            active={tab === 'settings'}
            onClick={() => setTab('settings')}
            label="Mehr"
            icon={<GearIcon />}
          />
        </div>
      </nav>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button className={`tab ${active ? 'active' : ''}`} onClick={onClick}>
      {icon}
      {label}
    </button>
  )
}
