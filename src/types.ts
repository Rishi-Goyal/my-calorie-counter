export type Unit = 'g' | 'ml'

export interface FoodRef {
  name: string
  kcal: number // per 100g (or 100 ml for liquids)
  p: number // protein per 100g
  c: number // carbs per 100g
  f: number // fat per 100g
  serving?: number // typical serving in grams/ml
  unit?: Unit // absent = grams
}

export interface MealItem {
  name: string
  grams: number // amount in g, or ml when unit is 'ml'
  kcalPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  confidence?: number // 0..1, from AI analysis
  unit?: Unit // absent = grams
}

export type MealSource = 'photo' | 'barcode' | 'manual'

export interface Meal {
  id?: number
  date: string // YYYY-MM-DD local
  createdAt: number // epoch ms
  items: MealItem[]
  kcal: number
  protein: number
  carbs: number
  fat: number
  kcalMin?: number
  kcalMax?: number
  source: MealSource
  thumbnail?: string // small jpeg data URL
  description?: string
}

export interface Settings {
  id: number // always 1
  geminiKey?: string
  model?: string
  kcalGoal?: number
  proteinGoal?: number
}

export interface DraftMeal {
  items: MealItem[]
  source: MealSource
  thumbnail?: string
  description?: string
  kcalMin?: number
  kcalMax?: number
  editId?: number // present = editing this existing meal instead of logging a new one
}
