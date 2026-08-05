import { useState } from 'react'
import type { FoodRef } from '../types'
import { getSettings } from '../lib/db'
import { lookupFoodByName, GeminiError } from '../lib/gemini'
import { addCustomFood } from '../lib/nutrition'

/**
 * "Ask AI" fallback shown when a food search finds nothing locally. On
 * success the food is saved to the on-device custom list (searchable offline
 * from then on) and handed to the caller.
 */
export default function AiFoodLookup({ query, onFound }: { query: string; onFound: (f: FoodRef) => void }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function lookup() {
    setState('loading')
    try {
      const s = await getSettings()
      const food = await lookupFoodByName(query.trim(), s.geminiKey ?? '', s.model || 'gemini-2.5-flash')
      await addCustomFood(food)
      setState('idle')
      onFound({ ...food, custom: true })
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : 'Lookup failed — try again.')
      setState('error')
    }
  }

  if (state === 'loading') {
    return (
      <div className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 2px' }}>
        <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
        Asking AI about “{query.trim()}”…
      </div>
    )
  }

  return (
    <>
      {state === 'error' && <div className="error-box">{error}</div>}
      <button type="button" className="search-result" onClick={lookup}>
        <span className="n">🔮 Not in the database — ask AI about “{query.trim()}”</span>
      </button>
    </>
  )
}
