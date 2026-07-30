import type { ActivityLevel, Profile } from '../types'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
}

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary — desk job, little exercise',
  light: 'Lightly active — walks / 1-3 workouts a week',
  moderate: 'Moderately active — 3-5 workouts a week',
  active: 'Very active — hard training most days',
}

export interface GoalBreakdown {
  bmr: number
  activityFactor: number
  tdee: number
  direction: 'lose' | 'gain' | 'maintain'
  deltaPerDay: number // kcal cut/added per day for the chosen pace
  kcalGoal: number
  clamped: boolean // true if the goal was raised to the safety floor
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  weeksToTarget: number | null
}

/**
 * Mifflin-St Jeor BMR × activity factor = TDEE, then a deficit/surplus from the
 * chosen weekly pace (1 kg body fat ≈ 7700 kcal). Protein at 1.8 g/kg body
 * weight, fat at 27.5% of calories, carbs fill the remainder.
 */
export function computeGoals(p: Profile): GoalBreakdown {
  const bmr = Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161))
  const activityFactor = ACTIVITY_FACTORS[p.activityLevel]
  const tdee = Math.round(bmr * activityFactor)

  const direction: GoalBreakdown['direction'] =
    p.targetWeightKg < p.weightKg ? 'lose' : p.targetWeightKg > p.weightKg ? 'gain' : 'maintain'
  const rate = direction === 'maintain' ? 0 : p.weeklyRateKg
  const deltaPerDay = Math.round((7700 * rate) / 7)

  let kcalGoal = direction === 'lose' ? tdee - deltaPerDay : tdee + deltaPerDay
  const floor = p.sex === 'male' ? 1500 : 1200
  const clamped = direction === 'lose' && kcalGoal < floor
  if (clamped) kcalGoal = floor

  const proteinGoal = Math.round(1.8 * p.weightKg)
  const fatGoal = Math.round((kcalGoal * 0.275) / 9)
  const carbsGoal = Math.max(0, Math.round((kcalGoal - proteinGoal * 4 - fatGoal * 9) / 4))

  const weeksToTarget =
    direction === 'maintain' || rate === 0
      ? null
      : Math.ceil(Math.abs(p.weightKg - p.targetWeightKg) / rate)

  return { bmr, activityFactor, tdee, direction, deltaPerDay, kcalGoal, clamped, proteinGoal, carbsGoal, fatGoal, weeksToTarget }
}
