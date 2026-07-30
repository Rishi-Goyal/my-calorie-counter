import { useState } from 'react'
import Home from './screens/Home'
import History from './screens/History'
import SettingsScreen from './screens/Settings'
import CaptureFlow from './components/CaptureFlow'
import type { DraftMeal, Meal } from './types'

type Tab = 'today' | 'history' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '🏠' },
  { id: 'history', label: 'History', icon: '📅' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

function mealToDraft(meal: Meal, mode: 'edit' | 'copy'): DraftMeal {
  return {
    items: meal.items.map((it) => ({ ...it })),
    source: meal.source,
    thumbnail: meal.thumbnail,
    description: meal.description,
    kcalMin: meal.kcalMin,
    kcalMax: meal.kcalMax,
    editId: mode === 'edit' ? meal.id : undefined,
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  // null = closed, {} = fresh capture, {draft} = editor opened on an existing/copied meal
  const [flow, setFlow] = useState<{ draft?: DraftMeal } | null>(null)

  const onEditMeal = (meal: Meal) => setFlow({ draft: mealToDraft(meal, 'edit') })
  const onCopyMeal = (meal: Meal) => setFlow({ draft: mealToDraft(meal, 'copy') })

  return (
    <>
      {tab === 'today' && <Home onEditMeal={onEditMeal} onCopyMeal={onCopyMeal} />}
      {tab === 'history' && <History onEditMeal={onEditMeal} onCopyMeal={onCopyMeal} />}
      {tab === 'settings' && <SettingsScreen />}

      <button type="button" className="fab" aria-label="Add meal" onClick={() => setFlow({})}>
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

      {flow && <CaptureFlow initial={flow.draft} onClose={() => setFlow(null)} />}
    </>
  )
}
