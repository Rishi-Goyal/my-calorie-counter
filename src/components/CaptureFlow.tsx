import { useEffect, useMemo, useRef, useState } from 'react'
import type { DraftMeal, MealItem } from '../types'
import { db, getSettings, todayStr } from '../lib/db'
import { processPhoto } from '../lib/image'
import { analyzePhoto, GeminiError } from '../lib/gemini'
import { lookupBarcode } from '../lib/openfoodfacts'
import { startBarcodeScanner, type ScannerHandle } from '../lib/barcode'
import { totals, searchFoods, foodToItem, itemKcal } from '../lib/nutrition'
import ConfirmMeal from './ConfirmMeal'
import ActivityForm from './ActivityLog'
import AiFoodLookup from './AiFoodLookup'

type Stage =
  | { kind: 'menu' }
  | { kind: 'analyzing'; thumbnail: string }
  | { kind: 'scan' }
  | { kind: 'looking-up' }
  | { kind: 'search'; picked: MealItem[] }
  | { kind: 'confirm'; draft: DraftMeal }
  | { kind: 'activity' }

export default function CaptureFlow({ onClose, initial }: { onClose: () => void; initial?: DraftMeal }) {
  const [stage, setStage] = useState<Stage>(initial ? { kind: 'confirm', draft: initial } : { kind: 'menu' })
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handlePhoto(file: File) {
    setError(null)
    try {
      const { base64, thumbnail } = await processPhoto(file)
      setStage({ kind: 'analyzing', thumbnail })
      const settings = await getSettings()
      const result = await analyzePhoto(base64, settings.geminiKey ?? '', settings.model || 'gemini-2.5-flash')
      if (result.items.length === 0) {
        setError(result.description || 'No food detected in the photo.')
        setStage({ kind: 'menu' })
        return
      }
      setStage({
        kind: 'confirm',
        draft: {
          items: result.items,
          source: 'photo',
          thumbnail,
          description: result.description,
          kcalMin: result.kcalMin || undefined,
          kcalMax: result.kcalMax || undefined,
        },
      })
    } catch (e) {
      setError(e instanceof GeminiError ? e.message : 'Something went wrong analyzing the photo.')
      setStage({ kind: 'menu' })
    }
  }

  async function handleBarcode(code: string) {
    setStage({ kind: 'looking-up' })
    setError(null)
    try {
      const product = await lookupBarcode(code)
      if (!product) {
        setError(`Barcode ${code} not found in Open Food Facts (or it has no nutrition data). Try photo or search instead.`)
        setStage({ kind: 'menu' })
        return
      }
      setStage({
        kind: 'confirm',
        draft: { items: [product.item], source: 'barcode', description: product.productName },
      })
    } catch {
      setError('Could not reach Open Food Facts — check your connection.')
      setStage({ kind: 'menu' })
    }
  }

  async function saveMeal(draft: DraftMeal, items: MealItem[], kcalMin?: number, kcalMax?: number) {
    const t = totals(items)
    // Manual meals are described by their item list, so refresh it after edits;
    // photo/barcode meals keep the original description.
    const description =
      draft.source === 'manual' || !draft.description
        ? items.map((i) => i.name).join(', ')
        : draft.description

    if (draft.editId !== undefined) {
      // Editing keeps the meal's original date, time, source, and thumbnail
      await db.meals.update(draft.editId, {
        items,
        kcal: t.kcal,
        protein: t.protein,
        carbs: t.carbs,
        fat: t.fat,
        kcalMin,
        kcalMax,
        description,
      })
    } else {
      await db.meals.add({
        date: todayStr(),
        createdAt: Date.now(),
        items,
        kcal: t.kcal,
        protein: t.protein,
        carbs: t.carbs,
        fat: t.fat,
        kcalMin,
        kcalMax,
        source: draft.source,
        thumbnail: draft.thumbnail,
        description,
      })
    }
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-handle" />
        {error && <div className="error-box">{error}</div>}

        {stage.kind === 'menu' && (
          <>
            <h2 className="sheet-title">Add a meal</h2>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handlePhoto(f)
                e.target.value = ''
              }}
            />
            <button type="button" className="capture-opt" onClick={() => fileRef.current?.click()}>
              <span className="ico">📷</span>
              <span>
                <span className="t">Snap a photo</span>
                <br />
                <span className="d">AI identifies the food and estimates portions</span>
              </span>
            </button>
            <button type="button" className="capture-opt" onClick={() => setStage({ kind: 'scan' })}>
              <span className="ico">𝄃𝄃𝄂𝄀</span>
              <span>
                <span className="t">Scan a barcode</span>
                <br />
                <span className="d">Exact label nutrition for packaged food</span>
              </span>
            </button>
            <button type="button" className="capture-opt" onClick={() => setStage({ kind: 'search', picked: [] })}>
              <span className="ico">🔍</span>
              <span>
                <span className="t">Search foods</span>
                <br />
                <span className="d">Pick from the built-in food database</span>
              </span>
            </button>
            <button type="button" className="capture-opt" onClick={() => setStage({ kind: 'activity' })}>
              <span className="ico">🏃</span>
              <span>
                <span className="t">Log activity</span>
                <br />
                <span className="d">Exercise tops up today's calorie budget</span>
              </span>
            </button>
          </>
        )}

        {stage.kind === 'activity' && <ActivityForm onDone={onClose} onBack={() => setStage({ kind: 'menu' })} />}

        {stage.kind === 'analyzing' && (
          <div className="analyzing">
            <img src={stage.thumbnail} alt="your meal" />
            <div className="spinner" />
            <p className="msg">Analyzing your meal…</p>
          </div>
        )}

        {stage.kind === 'looking-up' && (
          <div className="analyzing">
            <div className="spinner" />
            <p className="msg">Looking up product…</p>
          </div>
        )}

        {stage.kind === 'scan' && (
          <BarcodeScanner onResult={handleBarcode} onCancel={() => setStage({ kind: 'menu' })} onError={(m) => {
            setError(m)
            setStage({ kind: 'menu' })
          }} />
        )}

        {stage.kind === 'search' && (
          <ManualSearch
            picked={stage.picked}
            onChange={(picked) => setStage({ kind: 'search', picked })}
            onContinue={() =>
              setStage({ kind: 'confirm', draft: { items: stage.picked, source: 'manual' } })
            }
          />
        )}

        {stage.kind === 'confirm' && (
          <ConfirmMeal
            draft={stage.draft}
            onSave={(items, min, max) => saveMeal(stage.draft, items, min, max)}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  )
}

function BarcodeScanner({
  onResult,
  onCancel,
  onError,
}: {
  onResult: (code: string) => void
  onCancel: () => void
  onError: (message: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    let handle: ScannerHandle | undefined
    let cancelled = false
    if (videoRef.current) {
      startBarcodeScanner(videoRef.current, onResult)
        .then((h) => {
          if (cancelled) h.stop()
          else handle = h
        })
        .catch(() => onError('Could not start the camera. Check camera permissions for this site.'))
    }
    return () => {
      cancelled = true
      handle?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <h2 className="sheet-title">Scan barcode</h2>
      <video ref={videoRef} className="scanner-video" muted playsInline />
      <p className="hint" style={{ margin: '10px 0' }}>
        Point the camera at the product barcode.
      </p>
      <button type="button" className="btn secondary" onClick={onCancel}>
        Back
      </button>
    </div>
  )
}

function ManualSearch({
  picked,
  onChange,
  onContinue,
}: {
  picked: MealItem[]
  onChange: (items: MealItem[]) => void
  onContinue: () => void
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchFoods(query), [query])

  return (
    <div>
      <h2 className="sheet-title">Search foods</h2>
      <input
        type="search"
        placeholder="e.g. chicken rice, dal, banana…"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      {results.map((f) => (
        <button
          key={f.name}
          type="button"
          className="search-result"
          onClick={() => {
            onChange([...picked, foodToItem(f)])
            setQuery('')
          }}
        >
          <span className="n">
            {f.name}
            {f.custom ? ' 🔮' : ''}
          </span>
          <span className="k">
            {f.kcal} kcal/100{f.unit ?? 'g'}
            {f.serving ? ` · ~${f.serving} ${f.unit ?? 'g'} serving` : ''}
          </span>
        </button>
      ))}
      {query.trim().length >= 3 && results.length === 0 && (
        <AiFoodLookup
          query={query}
          onFound={(f) => {
            onChange([...picked, foodToItem(f)])
            setQuery('')
          }}
        />
      )}
      {picked.length > 0 && (
        <>
          <p className="hint" style={{ margin: '12px 0 6px' }}>
            Selected — portions adjustable on the next screen
          </p>
          {picked.map((it, i) => (
            <div className="search-result picked-row" key={`${it.name}-${i}`}>
              <span className="n">{it.name}</span>
              <span className="k">
                {it.grams} {it.unit ?? 'g'} · {Math.round(itemKcal(it))} kcal
              </span>
              <button
                type="button"
                className="icon-btn danger"
                aria-label={`Remove ${it.name}`}
                onClick={() => onChange(picked.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={onContinue} style={{ marginTop: 8 }}>
            Continue ({picked.length} item{picked.length > 1 ? 's' : ''})
          </button>
        </>
      )}
    </div>
  )
}
