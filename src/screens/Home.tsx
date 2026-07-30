import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr, getSettings } from '../lib/db'
import type { Meal } from '../types'
import MealCard from '../components/MealCard'

function KcalRing({ kcal, goal }: { kcal: number; goal: number }) {
  const r = 50
  const circ = 2 * Math.PI * r
  const frac = Math.min(1, goal > 0 ? kcal / goal : 0)
  const over = goal > 0 && kcal > goal
  return (
    <div className="kcal-ring">
      <svg width="116" height="116" viewBox="0 0 116 116">
        <circle cx="58" cy="58" r={r} fill="none" stroke="var(--surface2)" strokeWidth="10" />
        <circle
          cx="58"
          cy="58"
          r={r}
          fill="none"
          stroke={over ? 'var(--fat)' : 'var(--accent)'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circ * frac} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      </svg>
      <div className="center">
        <span className="num">{Math.round(kcal)}</span>
        <span className="lbl">of {goal} kcal</span>
      </div>
    </div>
  )
}

function MacroBar({ name, value, goal, color }: { name: string; value: number; goal: number; color: string }) {
  const frac = Math.min(1, goal > 0 ? value / goal : 0)
  return (
    <div className="macro-row">
      <div className="top">
        <span className="name">{name}</span>
        <span>
          {Math.round(value)} / {Math.round(goal)} g
        </span>
      </div>
      <div className="macro-bar">
        <div style={{ width: `${frac * 100}%`, background: color }} />
      </div>
    </div>
  )
}

interface Props {
  onEditMeal: (meal: Meal) => void
  onCopyMeal: (meal: Meal) => void
}

export default function Home({ onEditMeal, onCopyMeal }: Props) {
  const today = todayStr()
  const meals = useLiveQuery(() => db.meals.where('date').equals(today).reverse().sortBy('createdAt'), [today])
  const activities = useLiveQuery(() => db.activities.where('date').equals(today).reverse().sortBy('createdAt'), [today])
  const settings = useLiveQuery(() => getSettings(), [])

  const kcalGoal = settings?.kcalGoal ?? 2000
  const proteinGoal = settings?.proteinGoal ?? 100
  // Prefer stored macro goals (auto mode); fall back to derived splits
  const carbsGoal = settings?.carbsGoal ?? (kcalGoal * 0.5) / 4
  const fatGoal = settings?.fatGoal ?? (kcalGoal * 0.3) / 9

  const exerciseKcal = (activities ?? []).reduce((s, a) => s + a.kcal, 0)
  const effectiveGoal = kcalGoal + exerciseKcal

  const t = (meals ?? []).reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )

  return (
    <div className="screen">
      <h1 className="screen-title">Today</h1>
      <p className="screen-sub">
        {new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      <div className="card today-hero">
        <KcalRing kcal={t.kcal} goal={effectiveGoal} />
        <div className="macros">
          <MacroBar name="Protein" value={t.protein} goal={proteinGoal} color="var(--protein)" />
          <MacroBar name="Carbs" value={t.carbs} goal={carbsGoal} color="var(--carbs)" />
          <MacroBar name="Fat" value={t.fat} goal={fatGoal} color="var(--fat)" />
        </div>
      </div>
      {exerciseKcal > 0 && (
        <p className="hint" style={{ margin: '-6px 4px 12px' }}>
          🏃 Exercise earned <b>+{exerciseKcal} kcal</b> today ({kcalGoal} base + {exerciseKcal})
        </p>
      )}

      {(activities ?? []).map((a) => (
        <div className="card meal-card" key={`a${a.id}`}>
          <div className="meal-thumb">🏃</div>
          <div className="meal-info">
            <div className="meal-name">{a.label}</div>
            <div className="meal-meta">
              {a.minutes} min · {a.source === 'simple-workout' ? 'Simple Workout' : 'logged manually'}
            </div>
          </div>
          <div className="meal-kcal" style={{ color: 'var(--accent)' }}>
            +{a.kcal}
          </div>
          <div className="meal-actions">
            <button
              type="button"
              className="icon-btn danger"
              aria-label="Delete activity"
              onClick={() => {
                if (confirm('Delete this activity?')) db.activities.delete(a.id!)
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      {meals === undefined ? null : meals.length === 0 ? (
        <div className="empty">
          <div className="big">🍽️</div>
          Nothing logged yet today.
          <br />
          Tap <b>＋</b> to snap your first meal.
        </div>
      ) : (
        meals.map((m) => <MealCard key={m.id} meal={m} onEdit={onEditMeal} onCopy={onCopyMeal} />)
      )}
    </div>
  )
}
