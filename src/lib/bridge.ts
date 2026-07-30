import { db } from './db'
import { activityKcal } from './activities'

/**
 * Imports completed workouts written by the simple-workout PWA (same origin:
 * rishi-goyal.github.io) into the activity log. simple-workout writes summary
 * records into the shared IndexedDB database `fitness-bridge`, store
 * `workouts`: { id, date: 'YYYY-MM-DD', endedAt: epoch-ms, type, minutes }.
 *
 * Safe no-op when the bridge database doesn't exist (simple-workout not
 * installed / bridge branch not merged) — we never create it from this side.
 */

const BRIDGE_DB = 'fitness-bridge'
const BRIDGE_STORE = 'workouts'
const STRENGTH_MET = 5.0
const IMPORT_WINDOW_DAYS = 30

interface BridgeWorkout {
  id: string | number
  date: string
  endedAt: number
  type?: string
  minutes: number
}

async function bridgeExists(): Promise<boolean> {
  if (!('databases' in indexedDB)) return false
  const dbs = await indexedDB.databases()
  return dbs.some((d) => d.name === BRIDGE_DB)
}

function readBridgeWorkouts(): Promise<BridgeWorkout[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open(BRIDGE_DB)
    req.onerror = () => resolve([])
    req.onsuccess = () => {
      const bdb = req.result
      if (!bdb.objectStoreNames.contains(BRIDGE_STORE)) {
        bdb.close()
        resolve([])
        return
      }
      const tx = bdb.transaction(BRIDGE_STORE, 'readonly')
      const getAll = tx.objectStore(BRIDGE_STORE).getAll()
      getAll.onsuccess = () => {
        bdb.close()
        resolve(getAll.result as BridgeWorkout[])
      }
      getAll.onerror = () => {
        bdb.close()
        resolve([])
      }
    }
  })
}

let inFlight: Promise<number> | null = null

/** Returns the number of newly imported workouts. */
export function importBridgeWorkouts(weightKg: number): Promise<number> {
  // Concurrent callers (StrictMode double-effect, rapid visibility changes)
  // share one import run.
  if (!inFlight) {
    inFlight = doImport(weightKg).finally(() => {
      inFlight = null
    })
  }
  return inFlight
}

async function doImport(weightKg: number): Promise<number> {
  try {
    if (!(await bridgeExists())) return 0
    const workouts = await readBridgeWorkouts()
    if (workouts.length === 0) return 0

    const cutoff = Date.now() - IMPORT_WINDOW_DAYS * 86400000
    const recent = workouts.filter((w) => w.endedAt >= cutoff && w.minutes > 0 && w.date)
    if (recent.length === 0) return 0

    // Single rw transaction: IndexedDB serializes overlapping writers, so the
    // existing-check and the inserts are atomic and duplicates are impossible.
    return await db.transaction('rw', db.activities, async () => {
      const ids = recent.map((w) => `sw-${w.id}`)
      const existing = new Set(
        (await db.activities.where('externalId').anyOf(ids).toArray()).map((a) => a.externalId),
      )

      let imported = 0
      for (const w of recent) {
        const externalId = `sw-${w.id}`
        if (existing.has(externalId)) continue
        await db.activities.add({
          date: w.date,
          createdAt: w.endedAt,
          type: 'strength',
          label: 'Workout (Simple Workout)',
          minutes: Math.round(w.minutes),
          kcal: activityKcal(STRENGTH_MET, w.minutes, weightKg),
          source: 'simple-workout',
          externalId,
        })
        imported++
      }
      return imported
    })
  } catch {
    return 0 // bridge problems must never break the app
  }
}
