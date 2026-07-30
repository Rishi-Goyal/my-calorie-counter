import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import Home from './screens/Home'
import History from './screens/History'
import SettingsScreen from './screens/Settings'
import CaptureFlow from './components/CaptureFlow'
import GoalsWizard from './components/GoalsWizard'
import { getSettings } from './lib/db'
import { importBridgeWorkouts } from './lib/bridge'
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
  const [wizardOpen, setWizardOpen] = useState(false)
  const settings = useLiveQuery(() => getSettings(), [])

  // First run after this update: no profile and no explicit goal mode yet → offer the wizard
  const showWizard = wizardOpen || (settings !== undefined && !settings.profile && settings.goalsMode === undefined)

  // Pull workouts finished in the simple-workout PWA (same-origin bridge)
  useEffect(() => {
    const sync = async () => {
      const s = await getSettings()
      await importBridgeWorkouts(s.profile?.weightKg ?? 70)
    }
    sync()
    const onVisible = () => document.visibilityState === 'visible' && sync()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const onEditMeal = (meal: Meal) => setFlow({ draft: mealToDraft(meal, 'edit') })
  const onCopyMeal = (meal: Meal) => setFlow({ draft: mealToDraft(meal, 'copy') })

  return (
    <>
      {tab === 'today' && <Home onEditMeal={onEditMeal} onCopyMeal={onCopyMeal} />}
      {tab === 'history' && <History onEditMeal={onEditMeal} onCopyMeal={onCopyMeal} />}
      {tab === 'settings' && <SettingsScreen onOpenWizard={() => setWizardOpen(true)} />}

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
      {showWizard && <GoalsWizard onDone={() => setWizardOpen(false)} />}
    </>
  )
}
