export type Unit = 'g' | 'ml'

export interface FoodRef {
  name: string
  kcal: number // per 100g (or 100 ml for liquids)
  p: number // protein per 100g
  c: number // carbs per 100g
  f: number // fat per 100g
  serving?: number // typical serving in grams/ml
  unit?: Unit // absent = grams
  custom?: boolean // true for AI-looked-up foods saved on this device
}

export interface CustomFood extends FoodRef {
  id?: number
  createdAt: number
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
  photoId?: number // original upload in the photos table, while it is still kept (48 h)
}

/** An uploaded meal photo, kept for 48 h so it can be saved to the device later. */
export interface StoredPhoto {
  id?: number
  createdAt: number // epoch ms; the photo is deleted PHOTO_TTL_MS after this
  blob: Blob // the original file as uploaded
  type: string // MIME type, e.g. image/jpeg
  thumbnail: string // small jpeg data URL for lists
}

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  targetWeightKg: number
  weeklyRateKg: number // desired change pace, kg per week (0 = maintain)
  activityLevel: ActivityLevel
}

export interface Settings {
  id: number // always 1
  geminiKey?: string
  model?: string
  // Active goals. In 'auto' mode these are recomputed from profile; in 'manual' they are user-set.
  kcalGoal?: number
  proteinGoal?: number
  carbsGoal?: number
  fatGoal?: number
  profile?: Profile
  goalsMode?: 'auto' | 'manual'
}

export interface Activity {
  id?: number
  date: string // YYYY-MM-DD local
  createdAt: number
  type: string // key from ACTIVITY_TYPES, or free text
  label: string
  minutes: number
  kcal: number
  source: 'manual' | 'simple-workout'
  externalId?: string // dedupe key for bridge imports
}

export interface DraftMeal {
  items: MealItem[]
  source: MealSource
  thumbnail?: string
  description?: string
  kcalMin?: number
  kcalMax?: number
  photoId?: number
  editId?: number // present = editing this existing meal instead of logging a new one
}
