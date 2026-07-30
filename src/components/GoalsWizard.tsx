import { useState } from 'react'
import type { ActivityLevel, Profile, Sex } from '../types'
import { ACTIVITY_LEVEL_LABELS, computeGoals, type GoalBreakdown } from '../lib/goals'
import { saveSettings } from '../lib/db'

export function GoalsExplanation({ profile, g }: { profile: Profile; g: GoalBreakdown }) {
  const dirWord = g.direction === 'lose' ? 'losing' : g.direction === 'gain' ? 'gaining' : 'maintaining'
  const targetDate =
    g.weeksToTarget !== null
      ? new Date(Date.now() + g.weeksToTarget * 7 * 86400000).toLocaleDateString([], { month: 'long', year: 'numeric' })
      : null
  return (
    <div className="explain">
      <div className="explain-row">
        <b>{g.bmr} kcal</b> — your body's burn at complete rest (BMR, Mifflin-St Jeor formula from your sex, age,
        height and weight)
      </div>
      <div className="explain-row">
        <b>{g.tdee} kcal</b> — daily maintenance: BMR × {g.activityFactor} for "{ACTIVITY_LEVEL_LABELS[profile.activityLevel].split(' — ')[0]}"
      </div>
      {g.direction !== 'maintain' && (
        <div className="explain-row">
          <b>
            {g.direction === 'lose' ? '−' : '+'}
            {g.deltaPerDay} kcal/day
          </b>{' '}
          — {dirWord} {profile.weeklyRateKg} kg/week (1 kg of body fat ≈ 7,700 kcal)
        </div>
      )}
      <div className="explain-row">
        <b>= {g.kcalGoal} kcal daily goal</b>
        {g.clamped && (
          <span className="warn"> raised to a safe minimum — consider a slower pace instead of eating less</span>
        )}
      </div>
      <hr />
      <div className="explain-row">
        <b>Protein {g.proteinGoal} g</b> — 1.8 g per kg of body weight, to hold on to muscle while {dirWord} weight
      </div>
      <div className="explain-row">
        <b>Fat {g.fatGoal} g</b> — 27.5% of calories, the level needed for hormone health
      </div>
      <div className="explain-row">
        <b>Carbs {g.carbsGoal} g</b> — the remaining calories, fuelling your day and training
      </div>
      {g.weeksToTarget !== null && (
        <>
          <hr />
          <div className="explain-row">
            At this pace you'd reach <b>{profile.targetWeightKg} kg in about {g.weeksToTarget} weeks</b> ({targetDate})
          </div>
        </>
      )}
    </div>
  )
}

export async function applyAutoGoals(profile: Profile): Promise<void> {
  const g = computeGoals(profile)
  await saveSettings({
    profile,
    goalsMode: 'auto',
    kcalGoal: g.kcalGoal,
    proteinGoal: g.proteinGoal,
    carbsGoal: g.carbsGoal,
    fatGoal: g.fatGoal,
  })
}

const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 28,
  heightCm: 172,
  weightKg: 75,
  targetWeightKg: 70,
  weeklyRateKg: 0.5,
  activityLevel: 'light',
}

export default function GoalsWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const [p, setP] = useState<Profile>(DEFAULT_PROFILE)
  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch })
  const g = computeGoals(p)

  async function finish() {
    await applyAutoGoals(p)
    onDone()
  }

  async function skip() {
    await saveSettings({ goalsMode: 'manual' }) // don't show the wizard again
    onDone()
  }

  const num = (v: number) => (Number.isFinite(v) ? v : 0)

  return (
    <div className="sheet-backdrop">
      <div className="sheet">
        <div className="sheet-handle" />
        {step === 0 && (
          <>
            <h2 className="sheet-title">Let's set your goals</h2>
            <p className="hint" style={{ marginBottom: 14 }}>
              A few details about you — everything stays on this device and powers a daily calorie and macro plan
              you can actually understand.
            </p>
            <label className="field">
              <span>Sex (for the metabolism formula)</span>
              <div className="seg">
                {(['male', 'female'] as Sex[]).map((s) => (
                  <button key={s} type="button" className={p.sex === s ? 'on' : ''} onClick={() => set({ sex: s })}>
                    {s === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
              </div>
            </label>
            <label className="field">
              <span>Age</span>
              <input type="number" value={p.age || ''} min={10} max={100} onChange={(e) => set({ age: num(+e.target.value) })} />
            </label>
            <label className="field">
              <span>Height (cm)</span>
              <input type="number" value={p.heightCm || ''} min={100} max={230} onChange={(e) => set({ heightCm: num(+e.target.value) })} />
            </label>
            <button type="button" className="btn" onClick={() => setStep(1)} disabled={!p.age || !p.heightCm}>
              Next
            </button>
            <button type="button" className="btn danger-text" onClick={skip}>
              Skip for now
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="sheet-title">Where you are, where you're going</h2>
            <label className="field">
              <span>Current weight (kg)</span>
              <input type="number" value={p.weightKg || ''} min={30} max={250} step={0.5} onChange={(e) => set({ weightKg: num(+e.target.value) })} />
            </label>
            <label className="field">
              <span>Target weight (kg)</span>
              <input type="number" value={p.targetWeightKg || ''} min={30} max={250} step={0.5} onChange={(e) => set({ targetWeightKg: num(+e.target.value) })} />
            </label>
            {p.targetWeightKg !== p.weightKg && (
              <label className="field">
                <span>Pace ({p.targetWeightKg < p.weightKg ? 'lose' : 'gain'} per week)</span>
                <div className="seg">
                  {[0.25, 0.5, 0.75].map((r) => (
                    <button key={r} type="button" className={p.weeklyRateKg === r ? 'on' : ''} onClick={() => set({ weeklyRateKg: r })}>
                      {r} kg{r === 0.25 ? ' · gentle' : r === 0.5 ? ' · steady' : ' · fast'}
                    </button>
                  ))}
                </div>
              </label>
            )}
            <button type="button" className="btn" onClick={() => setStep(2)} disabled={!p.weightKg || !p.targetWeightKg}>
              Next
            </button>
            <button type="button" className="btn secondary" onClick={() => setStep(0)} style={{ marginTop: 8 }}>
              Back
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="sheet-title">How active is a normal week?</h2>
            <p className="hint" style={{ marginBottom: 12 }}>
              Pick your baseline <b>excluding</b> workouts you'll log in the app — logged exercise tops up your
              budget on the day itself.
            </p>
            {(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`capture-opt${p.activityLevel === lvl ? ' selected' : ''}`}
                onClick={() => set({ activityLevel: lvl })}
              >
                <span>
                  <span className="t">{ACTIVITY_LEVEL_LABELS[lvl].split(' — ')[0]}</span>
                  <br />
                  <span className="d">{ACTIVITY_LEVEL_LABELS[lvl].split(' — ')[1]}</span>
                </span>
              </button>
            ))}
            <button type="button" className="btn" onClick={() => setStep(3)}>
              See my plan
            </button>
            <button type="button" className="btn secondary" onClick={() => setStep(1)} style={{ marginTop: 8 }}>
              Back
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="sheet-title">Your plan, explained</h2>
            <div className="card">
              <GoalsExplanation profile={p} g={g} />
            </div>
            <button type="button" className="btn" onClick={finish}>
              Use these goals
            </button>
            <button type="button" className="btn secondary" onClick={() => setStep(2)} style={{ marginTop: 8 }}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
