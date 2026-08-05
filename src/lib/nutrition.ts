import type { FoodRef, MealItem } from '../types'
import foodsRaw from '../data/foods.json'
import { db } from './db'

export const FOODS = foodsRaw as FoodRef[]

// AI-looked-up foods saved on this device, cached for synchronous search.
let customFoods: FoodRef[] = []

export async function refreshCustomFoods(): Promise<void> {
  customFoods = (await db.customFoods.toArray()).map((c) => ({ ...c, custom: true }))
}
refreshCustomFoods()

export async function addCustomFood(f: FoodRef): Promise<void> {
  await db.customFoods.add({ ...f, custom: undefined, createdAt: Date.now() })
  await refreshCustomFoods()
}

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export function itemKcal(it: MealItem): number {
  return (it.grams * it.kcalPer100g) / 100
}

export function totals(items: MealItem[]): Totals {
  const t: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const it of items) {
    const g = it.grams / 100
    t.kcal += g * it.kcalPer100g
    t.protein += g * it.proteinPer100g
    t.carbs += g * it.carbsPer100g
    t.fat += g * it.fatPer100g
  }
  t.kcal = Math.round(t.kcal)
  t.protein = Math.round(t.protein * 10) / 10
  t.carbs = Math.round(t.carbs * 10) / 10
  t.fat = Math.round(t.fat * 10) / 10
  return t
}

export function foodToItem(f: FoodRef, grams?: number): MealItem {
  return {
    name: f.name,
    grams: grams ?? f.serving ?? 100,
    kcalPer100g: f.kcal,
    proteinPer100g: f.p,
    carbsPer100g: f.c,
    fatPer100g: f.f,
    unit: f.unit,
  }
}

export function searchFoods(query: string, limit = 12): FoodRef[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const words = q.split(/\s+/)
  const scored: { f: FoodRef; score: number }[] = []
  for (const f of [...FOODS, ...customFoods]) {
    const name = f.name.toLowerCase()
    let score = 0
    if (name.startsWith(q)) score = 3
    else if (name.includes(q)) score = 2
    else if (words.every((w) => name.includes(w))) score = 1
    if (score > 0) scored.push({ f, score })
  }
  scored.sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length)
  return scored.slice(0, limit).map((s) => s.f)
}
