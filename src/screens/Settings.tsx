import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../lib/db'
import type { ActivityLevel, Profile, Sex } from '../types'
import { ACTIVITY_LEVEL_LABELS, computeGoals } from '../lib/goals'
import { GoalsExplanation, applyAutoGoals } from '../components/GoalsWizard'

const EMPTY_PROFILE: Profile = {
  sex: 'male',
  age: 28,
  heightCm: 172,
  weightKg: 75,
  targetWeightKg: 70,
  weeklyRateKg: 0.5,
  activityLevel: 'light',
}

export default function SettingsScreen({ onOpenWizard }: { onOpenWizard: () => void }) {
  const [key, setKey] = useState('')
  const [model, setModel] = useState('gemini-2.5-flash')
  const [mode, setMode] = useState<'auto' | 'manual'>('manual')
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE)
  const [hasProfile, setHasProfile] = useState(false)
  const [kcalGoal, setKcalGoal] = useState(2000)
  const [proteinGoal, setProteinGoal] = useState(100)
  const [showWhy, setShowWhy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSettings().then((s) => {
      setKey(s.geminiKey ?? '')
      setModel(s.model ?? 'gemini-2.5-flash')
      setMode(s.goalsMode ?? (s.profile ? 'auto' : 'manual'))
      if (s.profile) {
        setProfile(s.profile)
        setHasProfile(true)
      }
      setKcalGoal(s.kcalGoal ?? 2000)
      setProteinGoal(s.proteinGoal ?? 100)
      setLoaded(true)
    })
  }, [])

  const setP = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch })
  const g = computeGoals(profile)

  async function save() {
    await saveSettings({ geminiKey: key.trim(), model: model.trim() || 'gemini-2.5-flash' })
    if (mode === 'auto') {
      await applyAutoGoals(profile)
      setHasProfile(true)
    } else {
      await saveSettings({
        goalsMode: 'manual',
        kcalGoal: Math.max(0, kcalGoal),
        proteinGoal: Math.max(0, proteinGoal),
        // manual mode keeps sensible derived carb/fat splits
        carbsGoal: Math.round((Math.max(0, kcalGoal) * 0.5) / 4),
        fatGoal: Math.round((Math.max(0, kcalGoal) * 0.3) / 9),
      })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  if (!loaded) return <div className="screen" />

  return (
    <div className="screen">
      <h1 className="screen-title">Settings</h1>
      <p className="screen-sub">Profile, goals &amp; photo analysis</p>

      <div className="card">
        <div className="row-sb" style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 15 }}>Profile &amp; goals</h3>
          <div className="seg small">
            <button type="button" className={mode === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}>
              Auto
            </button>
            <button type="button" className={mode === 'manual' ? 'on' : ''} onClick={() => setMode('manual')}>
              Manual
            </button>
          </div>
        </div>

        {mode === 'auto' ? (
          <>
            {!hasProfile && (
              <p className="hint" style={{ marginBottom: 10 }}>
                No profile yet — fill this in (or <a onClick={onOpenWizard} style={{ cursor: 'pointer' }}>run the guided setup</a>).
              </p>
            )}
            <label className="field">
              <span>Sex</span>
              <div className="seg">
                {(['male', 'female'] as Sex[]).map((s) => (
                  <button key={s} type="button" className={profile.sex === s ? 'on' : ''} onClick={() => setP({ sex: s })}>
                    {s === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
              </div>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="field">
                <span>Age</span>
                <input type="number" value={profile.age || ''} onChange={(e) => setP({ age: +e.target.value })} />
              </label>
              <label className="field">
                <span>Height (cm)</span>
                <input type="number" value={profile.heightCm || ''} onChange={(e) => setP({ heightCm: +e.target.value })} />
              </label>
              <label className="field">
                <span>Weight (kg)</span>
                <input type="number" step={0.5} value={profile.weightKg || ''} onChange={(e) => setP({ weightKg: +e.target.value })} />
              </label>
              <label className="field">
                <span>Target (kg)</span>
                <input type="number" step={0.5} value={profile.targetWeightKg || ''} onChange={(e) => setP({ targetWeightKg: +e.target.value })} />
              </label>
            </div>
            {profile.targetWeightKg !== profile.weightKg && (
              <label className="field">
                <span>Pace (kg/week)</span>
                <div className="seg">
                  {[0.25, 0.5, 0.75].map((r) => (
                    <button key={r} type="button" className={profile.weeklyRateKg === r ? 'on' : ''} onClick={() => setP({ weeklyRateKg: r })}>
                      {r}
                    </button>
                  ))}
                </div>
              </label>
            )}
            <label className="field">
              <span>Baseline activity (excluding logged workouts)</span>
              <select value={profile.activityLevel} onChange={(e) => setP({ activityLevel: e.target.value as ActivityLevel })}>
                {(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {ACTIVITY_LEVEL_LABELS[lvl]}
                  </option>
                ))}
              </select>
            </label>
            <div className="card" style={{ padding: 12, marginBottom: 10 }}>
              <div className="row-sb">
                <span className="hint">Your plan</span>
                <b>
                  {g.kcalGoal} kcal · P{g.proteinGoal} C{g.carbsGoal} F{g.fatGoal}
                </b>
              </div>
              <button type="button" className="linkish" onClick={() => setShowWhy(!showWhy)}>
                {showWhy ? 'Hide' : 'How is this calculated?'}
              </button>
              {showWhy && <GoalsExplanation profile={profile} g={g} />}
            </div>
          </>
        ) : (
          <>
            <label className="field">
              <span>Calories (kcal/day)</span>
              <input type="number" value={kcalGoal} min={0} onChange={(e) => setKcalGoal(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>Protein (g/day)</span>
              <input type="number" value={proteinGoal} min={0} onChange={(e) => setProteinGoal(Number(e.target.value))} />
            </label>
            <p className="hint">Carb and fat targets are derived (50% / 30% of calories). Switch to Auto to base everything on your body and target weight.</p>
          </>
        )}
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Photo analysis (Gemini)</h3>
        <label className="field">
          <span>Gemini API key</span>
          <input
            type="password"
            value={key}
            placeholder="Paste your free API key"
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input type="text" value={model} list="model-options" onChange={(e) => setModel(e.target.value)} />
          <datalist id="model-options">
            <option value="gemini-2.5-flash" />
            <option value="gemini-2.5-flash-lite" />
            <option value="gemini-3-flash" />
          </datalist>
        </label>
        <p className="hint">
          Get a free key at{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            aistudio.google.com/apikey
          </a>{' '}
          (no credit card needed). The key is stored only on this device.
        </p>
      </div>

      <button type="button" className="btn" onClick={save}>
        {saved ? 'Saved ✓' : 'Save settings'}
      </button>

      <p className="hint" style={{ marginTop: 16 }}>
        Workouts finished in the Simple Workout app on this phone are picked up automatically and credited to that
        day's calorie budget.
      </p>
    </div>
  )
}
