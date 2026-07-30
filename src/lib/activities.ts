import { db, todayStr } from './db'
import type { Activity } from '../types'

export interface ActivityType {
  key: string
  label: string
  met: number
  icon: string
}

// MET values from the Compendium of Physical Activities (typical moderate efforts)
export const ACTIVITY_TYPES: ActivityType[] = [
  { key: 'walking', label: 'Walking (brisk)', met: 3.5, icon: '🚶' },
  { key: 'running', label: 'Running (~10 km/h)', met: 9.8, icon: '🏃' },
  { key: 'cycling', label: 'Cycling (moderate)', met: 7.5, icon: '🚴' },
  { key: 'strength', label: 'Strength training', met: 5.0, icon: '🏋️' },
  { key: 'hiit', label: 'HIIT / circuit', met: 8.0, icon: '🔥' },
  { key: 'yoga', label: 'Yoga', met: 3.0, icon: '🧘' },
  { key: 'swimming', label: 'Swimming', met: 8.0, icon: '🏊' },
  { key: 'badminton', label: 'Badminton', met: 5.5, icon: '🏸' },
  { key: 'football', label: 'Football', met: 8.0, icon: '⚽' },
  { key: 'cricket', label: 'Cricket', met: 4.8, icon: '🏏' },
]

/** Standard MET formula: kcal/min = MET × 3.5 × kg / 200 */
export function activityKcal(met: number, minutes: number, weightKg: number): number {
  return Math.round(((met * 3.5 * weightKg) / 200) * minutes)
}

export async function logActivity(type: ActivityType, minutes: number, weightKg: number): Promise<void> {
  const a: Activity = {
    date: todayStr(),
    createdAt: Date.now(),
    type: type.key,
    label: type.label,
    minutes,
    kcal: activityKcal(type.met, minutes, weightKg),
    source: 'manual',
  }
  await db.activities.add(a)
}
