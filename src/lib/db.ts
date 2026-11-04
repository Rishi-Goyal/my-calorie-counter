import Dexie, { type EntityTable } from 'dexie'
import type { Activity, CustomFood, Meal, Settings, StoredPhoto } from '../types'

export const db = new Dexie('calorie-counter') as Dexie & {
  meals: EntityTable<Meal, 'id'>
  settings: EntityTable<Settings, 'id'>
  activities: EntityTable<Activity, 'id'>
  customFoods: EntityTable<CustomFood, 'id'>
  photos: EntityTable<StoredPhoto, 'id'>
}

db.version(1).stores({
  meals: '++id, date, createdAt',
  settings: 'id',
})

// v2: activities (exercise log). Additive only — existing meals/settings untouched.
db.version(2).stores({
  meals: '++id, date, createdAt',
  settings: 'id',
  activities: '++id, date, createdAt, externalId',
})

// v3: customFoods (AI-looked-up foods saved for offline search). Additive only.
db.version(3).stores({
  meals: '++id, date, createdAt',
  settings: 'id',
  activities: '++id, date, createdAt, externalId',
  customFoods: '++id, name, createdAt',
})

// v4: photos (original uploads kept for 48 h so they can be saved to the device). Additive only.
db.version(4).stores({
  meals: '++id, date, createdAt',
  settings: 'id',
  activities: '++id, date, createdAt, externalId',
  customFoods: '++id, name, createdAt',
  photos: '++id, createdAt',
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
