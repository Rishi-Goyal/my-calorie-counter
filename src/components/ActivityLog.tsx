import { useState } from 'react'
import { ACTIVITY_TYPES, activityKcal, logActivity } from '../lib/activities'
import { getSettings } from '../lib/db'

export default function ActivityForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [typeKey, setTypeKey] = useState('walking')
  const [minutes, setMinutes] = useState(30)
  const [weightKg, setWeightKg] = useState<number | null>(null)

  if (weightKg === null) {
    getSettings().then((s) => setWeightKg(s.profile?.weightKg ?? 70))
    return null
  }

  const type = ACTIVITY_TYPES.find((t) => t.key === typeKey)!
  const kcal = activityKcal(type.met, minutes, weightKg)

  return (
    <div>
      <h2 className="sheet-title">Log activity</h2>
      <label className="field">
        <span>Activity</span>
        <select value={typeKey} onChange={(e) => setTypeKey(e.target.value)}>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.icon} {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Duration (minutes)</span>
        <input
          type="number"
          min={1}
          max={600}
          value={minutes || ''}
          onChange={(e) => setMinutes(Math.max(0, Number(e.target.value)))}
        />
      </label>
      <div className="card" style={{ padding: 12 }}>
        <div className="row-sb">
          <span className="hint">Estimated burn ({type.met} MET × {weightKg} kg)</span>
          <b>{kcal} kcal</b>
        </div>
      </div>
      <button
        type="button"
        className="btn"
        disabled={minutes <= 0}
        onClick={async () => {
          await logActivity(type, minutes, weightKg)
          onDone()
        }}
      >
        Add to today
      </button>
      <button type="button" className="btn secondary" onClick={onBack} style={{ marginTop: 8 }}>
        Back
      </button>
    </div>
  )
}
