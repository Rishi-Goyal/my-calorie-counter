import Dexie, { type EntityTable } from 'dexie'
import type { Meal, Settings } from '../types'

export const db = new Dexie('calorie-counter') as Dexie & {
  meals: EntityTable<Meal, 'id'>
  settings: EntityTable<Settings, 'id'>
}

db.version(1).stores({
  meals: '++id, date, createdAt',
  settings: 'id',
})

export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get(1)) ?? { id: 1, model: 'gemini-2.5-flash', kcalGoal: 2000, proteinGoal: 100 }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ ...current, ...patch, id: 1 })
}
