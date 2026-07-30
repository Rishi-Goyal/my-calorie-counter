import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayStr, getSettings } from '../lib/db'
import type { Meal } from '../types'
import MealCard from '../components/MealCard'

interface DaySummary {
  date: string
  kcal: number
  meals: number
}

function summarize(meals: Meal[]): DaySummary[] {
  const byDate = new Map<string, DaySummary>()
  for (const m of meals) {
    const d = byDate.get(m.date) ?? { date: m.date, kcal: 0, meals: 0 }
    d.kcal += m.kcal
    d.meals += 1
    byDate.set(m.date, d)
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
}

function lastNDates(n: number): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d)
    dd.setDate(d.getDate() - i)
    out.push(todayStr(dd))
  }
  return out
}

function fmtDay(date: string): string {
  if (date === todayStr()) return 'Today'
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

interface Props {
  onEditMeal: (meal: Meal) => void
  onCopyMeal: (meal: Meal) => void
}

export default function History({ onEditMeal, onCopyMeal }: Props) {
  const meals = useLiveQuery(() => db.meals.orderBy('date').reverse().toArray(), [])
  const allActivities = useLiveQuery(() => db.activities.toArray(), [])
  const settings = useLiveQuery(() => getSettings(), [])
  const [expanded, setExpanded] = useState<string | null>(null)
  if (!meals) return <div className="screen" />

  const exerciseByDate = new Map<string, number>()
  for (const a of allActivities ?? []) {
    exerciseByDate.set(a.date, (exerciseByDate.get(a.date) ?? 0) + a.kcal)
  }

  // Days with only workouts (no meals) still deserve a row
  const mealDates = new Set(meals.map((m) => m.date))
  const exerciseOnlyDays = [...exerciseByDate.keys()]
    .filter((d) => !mealDates.has(d))
    .map((date) => ({ date, kcal: 0, meals: 0 }))

  const days = [...summarize(meals), ...exerciseOnlyDays].sort((a, b) => (a.date < b.date ? 1 : -1))
  const byDate = new Map(days.map((d) => [d.date, d]))
  const week = lastNDates(7)
  const maxKcal = Math.max(settings?.kcalGoal ?? 2000, ...week.map((d) => byDate.get(d)?.kcal ?? 0))

  return (
    <div className="screen">
      <h1 className="screen-title">History</h1>
      <p className="screen-sub">Last 7 days</p>

      <div className="card">
        <div className="trend">
          {week.map((d) => {
            const kcal = byDate.get(d)?.kcal ?? 0
            const h = maxKcal > 0 ? (kcal / maxKcal) * 100 : 0
            return (
              <div className="bar-wrap" key={d}>
                <div className="bar" style={{ height: `${h}%`, opacity: kcal ? 0.85 : 0.25 }} />
                <span className="lbl">{new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'narrow' })}</span>
              </div>
            )
          })}
        </div>
        {settings?.kcalGoal ? <p className="hint" style={{ marginTop: 8 }}>Goal: {settings.kcalGoal} kcal/day</p> : null}
      </div>

      {days.length === 0 ? (
        <div className="empty">
          <div className="big">📅</div>
          Your logged days will appear here.
        </div>
      ) : (
        days.map((d) => {
          const open = expanded === d.date
          return (
            <div key={d.date}>
              <div
                className={`card day-row expandable${open ? ' open' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setExpanded(open ? null : d.date)}
                onKeyDown={(e) => e.key === 'Enter' && setExpanded(open ? null : d.date)}
              >
                <div>
                  <div className="d">{fmtDay(d.date)}</div>
                  <div className="meals-n">
                    {d.meals === 0
                      ? 'workout only'
                      : `${d.meals} meal${d.meals > 1 ? 's' : ''} · tap to ${open ? 'collapse' : 'view'}`}
                  </div>
                </div>
                <div className="k">
                  {Math.round(d.kcal)} kcal
                  {exerciseByDate.get(d.date) ? (
                    <span className="exercise-chip"> +{exerciseByDate.get(d.date)}🏃</span>
                  ) : null}{' '}
                  <span className="chevron">{open ? '▾' : '▸'}</span>
                </div>
              </div>
              {open && (
                <div className="day-meals">
                  {meals
                    .filter((m) => m.date === d.date)
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((m) => (
                      <MealCard key={m.id} meal={m} onEdit={onEditMeal} onCopy={onCopyMeal} />
                    ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
