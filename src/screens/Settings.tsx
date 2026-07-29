import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../lib/db'

export default function SettingsScreen() {
  const [key, setKey] = useState('')
  const [model, setModel] = useState('gemini-2.5-flash')
  const [kcalGoal, setKcalGoal] = useState(2000)
  const [proteinGoal, setProteinGoal] = useState(100)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    getSettings().then((s) => {
      setKey(s.geminiKey ?? '')
      setModel(s.model ?? 'gemini-2.5-flash')
      setKcalGoal(s.kcalGoal ?? 2000)
      setProteinGoal(s.proteinGoal ?? 100)
      setLoaded(true)
    })
  }, [])

  async function save() {
    await saveSettings({
      geminiKey: key.trim(),
      model: model.trim() || 'gemini-2.5-flash',
      kcalGoal: Math.max(0, kcalGoal),
      proteinGoal: Math.max(0, proteinGoal),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  if (!loaded) return <div className="screen" />

  return (
    <div className="screen">
      <h1 className="screen-title">Settings</h1>
      <p className="screen-sub">Photo analysis &amp; daily goals</p>

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
          (no credit card needed). The key is stored only on this device. Barcode scanning and food search work
          without a key.
        </p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Daily goals</h3>
        <label className="field">
          <span>Calories (kcal)</span>
          <input type="number" value={kcalGoal} min={0} onChange={(e) => setKcalGoal(Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Protein (g)</span>
          <input type="number" value={proteinGoal} min={0} onChange={(e) => setProteinGoal(Number(e.target.value))} />
        </label>
      </div>

      <button type="button" className="btn" onClick={save}>
        {saved ? 'Saved ✓' : 'Save settings'}
      </button>

      <p className="hint" style={{ marginTop: 16 }}>
        Estimates from photos are honest ranges, not exact numbers — packaged foods via barcode are label-exact,
        and confirming portions after each photo keeps estimates as tight as possible.
      </p>
    </div>
  )
}
