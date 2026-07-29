import { useState } from 'react'
import Home from './screens/Home'
import History from './screens/History'
import SettingsScreen from './screens/Settings'
import CaptureFlow from './components/CaptureFlow'

type Tab = 'today' | 'history' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '🏠' },
  { id: 'history', label: 'History', icon: '📅' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [capturing, setCapturing] = useState(false)

  return (
    <>
      {tab === 'today' && <Home />}
      {tab === 'history' && <History />}
      {tab === 'settings' && <SettingsScreen />}

      <button type="button" className="fab" aria-label="Add meal" onClick={() => setCapturing(true)}>
        ＋
      </button>

      <nav className="bottom-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="ico">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {capturing && <CaptureFlow onClose={() => setCapturing(false)} />}
    </>
  )
}
