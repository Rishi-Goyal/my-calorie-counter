import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { DraftMeal, MealItem } from '../types'
import { db } from '../lib/db'
import { photoTimeLeft, savePhotoToDevice } from '../lib/photos'
import { totals, searchFoods, foodToItem } from '../lib/nutrition'
import AiFoodLookup from './AiFoodLookup'

interface Props {
  draft: DraftMeal
  onSave: (items: MealItem[], kcalMin?: number, kcalMax?: number) => void
  onCancel: () => void
}

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: MealItem
  onChange: (it: MealItem) => void
  onRemove: () => void
}) {
  const kcal = Math.round((item.grams * item.kcalPer100g) / 100)
  // Slider fine-tunes around the original estimate (0.5×–1.5×); big changes go
  // through the typed input. Range is fixed at mount so it doesn't shift mid-drag.
  const initial = useRef(item.grams).current
  const sliderMin = Math.max(5, Math.floor((initial * 0.5) / 5) * 5)
  const sliderMax = Math.max(sliderMin + 50, Math.ceil((initial * 1.5) / 5) * 5)
  const step = item.grams < 100 ? 5 : 10
  const conf = item.confidence
  const unit = item.unit ?? 'g'
  return (
    <div className="card confirm-item">
      <div className="head">
        <span className="name">{item.name}</span>
        <span className="kcal">{kcal} kcal</span>
      </div>
      <div className="sub">
        {item.kcalPer100g} kcal / 100 {unit}
        {conf !== undefined && conf < 0.75 ? ' · low confidence — check portion' : ''}
      </div>
      <div className="grams-row">
        <div className="stepper">
          <button type="button" onClick={() => onChange({ ...item, grams: Math.max(5, item.grams - step) })}>
            −
          </button>
          <input
            className="grams-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={5000}
            value={item.grams || ''}
            onChange={(e) =>
              onChange({ ...item, grams: Math.max(0, Math.min(5000, Math.round(Number(e.target.value) || 0))) })
            }
            onBlur={() => item.grams < 5 && onChange({ ...item, grams: 5 })}
            aria-label={`Amount in ${unit}`}
          />
          <span className="unit-lbl">{unit}</span>
          <button type="button" onClick={() => onChange({ ...item, grams: item.grams + step })}>
            +
          </button>
        </div>
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={5}
          value={Math.max(sliderMin, Math.min(sliderMax, item.grams))}
          onChange={(e) => onChange({ ...item, grams: Number(e.target.value) })}
        />
      </div>
      <button type="button" className="remove-btn" onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}

export default function ConfirmMeal({ draft, onSave, onCancel }: Props) {
  const [items, setItems] = useState<MealItem[]>(draft.items)
  const [query, setQuery] = useState('')
  const results = useMemo(() => searchFoods(query, 6), [query])

  const t = totals(items)
  const origKcal = useMemo(() => totals(draft.items).kcal, [draft.items])

  // If portions were adjusted, scale the model's confidence range proportionally
  let kcalMin = draft.kcalMin
  let kcalMax = draft.kcalMax
  if (kcalMin && kcalMax && origKcal > 0) {
    const ratio = t.kcal / origKcal
    kcalMin = Math.round(kcalMin * ratio)
    kcalMax = Math.round(kcalMax * ratio)
  }

  const editing = draft.editId !== undefined
  // The original upload, while it is still kept on the device (48 h)
  const photo = useLiveQuery(() => (draft.photoId ? db.photos.get(draft.photoId) : undefined), [draft.photoId])

  return (
    <div>
      <h2 className="sheet-title">{editing ? 'Edit meal' : 'Confirm your meal'}</h2>
      {draft.thumbnail && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <img
            src={draft.thumbnail}
            alt="meal"
            style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            {draft.description && <p className="hint">{draft.description}</p>}
            {photo && (
              <button type="button" className="linkish" onClick={() => savePhotoToDevice(photo)}>
                ⬇ Save photo <span className="hint">· {photoTimeLeft(photo)}</span>
              </button>
            )}
          </div>
        </div>
      )}
      <p className="hint" style={{ marginBottom: 12 }}>
        Adjust the portions below — this is what makes the estimate accurate.
      </p>

      {items.map((it, i) => (
        <ItemRow
          key={i}
          item={it}
          onChange={(next) => setItems(items.map((x, j) => (j === i ? next : x)))}
          onRemove={() => setItems(items.filter((_, j) => j !== i))}
        />
      ))}
      {items.length === 0 && <div className="empty">No items — add one below.</div>}

      <div className="card" style={{ padding: 12 }}>
        <input
          type="search"
          placeholder="Add an item (e.g. rice, dal, apple)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.map((f) => (
          <button
            key={f.name}
            type="button"
            className="search-result"
            style={{ marginTop: 8, marginBottom: 0 }}
            onClick={() => {
              setItems([...items, foodToItem(f)])
              setQuery('')
            }}
          >
            <span className="n">
              {f.name}
              {f.custom ? ' 🔮' : ''}
            </span>
            <span className="k">
              {f.kcal} kcal/100{f.unit ?? 'g'}
              {f.serving ? ` · ${f.serving} ${f.unit ?? 'g'}` : ''}
            </span>
          </button>
        ))}
        {query.trim().length >= 3 && results.length === 0 && (
          <div style={{ marginTop: 8 }}>
            <AiFoodLookup
              query={query}
              onFound={(f) => {
                setItems([...items, foodToItem(f)])
                setQuery('')
              }}
            />
          </div>
        )}
      </div>

      <div className="total-bar">
        <div className="row">
          <span>Total</span>
          <span>
            <span className="kcal">{t.kcal} kcal</span>
            {kcalMin && kcalMax ? <span className="range"> ({kcalMin}–{kcalMax})</span> : null}
          </span>
        </div>
        <div className="macros-line">
          Protein {t.protein} g · Carbs {t.carbs} g · Fat {t.fat} g
        </div>
        <button type="button" className="btn" disabled={items.length === 0} onClick={() => onSave(items, kcalMin, kcalMax)}>
          {editing ? 'Save changes' : 'Save meal'}
        </button>
        <button type="button" className="btn danger-text" onClick={onCancel}>
          {editing ? 'Cancel' : 'Discard'}
        </button>
      </div>
    </div>
  )
}
