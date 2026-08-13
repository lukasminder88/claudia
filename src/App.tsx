import { useState } from 'react'
import { useStore } from './lib/store'
import { TimerScreen } from './components/TimerScreen'
import { ProjectsScreen } from './components/ProjectsScreen'
import { ReportsScreen } from './components/ReportsScreen'
import { SettingsScreen } from './components/SettingsScreen'
import {
  TimerIcon,
  ListIcon,
  ChartIcon,
  GearIcon,
} from './components/Icons'

type Tab = 'timer' | 'projects' | 'reports' | 'settings'

export default function App() {
  const state = useStore()
  const [tab, setTab] = useState<Tab>('timer')

  return (
    <div className="app">
      {tab === 'timer' && (
        <TimerScreen state={state} onGoToProjects={() => setTab('projects')} />
      )}
      {tab === 'projects' && <ProjectsScreen state={state} />}
      {tab === 'reports' && <ReportsScreen state={state} />}
      {tab === 'settings' && <SettingsScreen state={state} />}

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
