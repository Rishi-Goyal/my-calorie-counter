import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr, getSettings } from '../lib/db'
import type { Meal } from '../types'

const SOURCE_ICON: Record<string, string> = { photo: '📷', barcode: '𝄃𝄃𝄂', manual: '🔍' }

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

function MealCard({ meal }: { meal: Meal }) {
  const time = new Date(meal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="card meal-card">
      {meal.thumbnail ? (
        <img className="meal-thumb" src={meal.thumbnail} alt="" />
      ) : (
        <div className="meal-thumb">{SOURCE_ICON[meal.source] ?? '🍽️'}</div>
      )}
      <div className="meal-info">
        <div className="meal-name">{meal.description || meal.items.map((i) => i.name).join(', ')}</div>
        <div className="meal-meta">
          {time} · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
        </div>
      </div>
      <div className="meal-kcal">
        {meal.kcal}
        {meal.kcalMin && meal.kcalMax ? <span className="range">{meal.kcalMin}–{meal.kcalMax}</span> : null}
      </div>
      <button
        type="button"
        className="remove-btn"
        aria-label="Delete meal"
        onClick={() => {
          if (confirm('Delete this meal?')) db.meals.delete(meal.id!)
        }}
      >
        ✕
      </button>
    </div>
  )
}

export default function Home() {
  const today = todayStr()
  const meals = useLiveQuery(() => db.meals.where('date').equals(today).reverse().sortBy('createdAt'), [today])
  const settings = useLiveQuery(() => getSettings(), [])

  const kcalGoal = settings?.kcalGoal ?? 2000
  const proteinGoal = settings?.proteinGoal ?? 100
  // Derive carb/fat targets from the calorie goal (50% / 30% of energy)
  const carbsGoal = (kcalGoal * 0.5) / 4
  const fatGoal = (kcalGoal * 0.3) / 9

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
        <KcalRing kcal={t.kcal} goal={kcalGoal} />
        <div className="macros">
          <MacroBar name="Protein" value={t.protein} goal={proteinGoal} color="var(--protein)" />
          <MacroBar name="Carbs" value={t.carbs} goal={carbsGoal} color="var(--carbs)" />
          <MacroBar name="Fat" value={t.fat} goal={fatGoal} color="var(--fat)" />
        </div>
      </div>

      {meals === undefined ? null : meals.length === 0 ? (
        <div className="empty">
          <div className="big">🍽️</div>
          Nothing logged yet today.
          <br />
          Tap <b>＋</b> to snap your first meal.
        </div>
      ) : (
        meals.map((m) => <MealCard key={m.id} meal={m} />)
      )}
    </div>
  )
}
