import { useMemo, useState } from 'react'
import type { DraftMeal, MealItem } from '../types'
import { totals, searchFoods, foodToItem } from '../lib/nutrition'

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
  const sliderMax = Math.max(Math.ceil((item.grams * 2) / 10) * 10, 300)
  const conf = item.confidence
  return (
    <div className="card confirm-item">
      <div className="head">
        <span className="name">{item.name}</span>
        <span className="kcal">{kcal} kcal</span>
      </div>
      <div className="sub">
        {item.kcalPer100g} kcal / 100 g
        {conf !== undefined && conf < 0.75 ? ' · low confidence — check portion' : ''}
      </div>
      <div className="grams-row">
        <div className="stepper">
          <button type="button" onClick={() => onChange({ ...item, grams: Math.max(5, item.grams - 10) })}>
            −
          </button>
          <span className="val">{item.grams} g</span>
          <button type="button" onClick={() => onChange({ ...item, grams: item.grams + 10 })}>
            +
          </button>
        </div>
        <input
          type="range"
          min={5}
          max={sliderMax}
          step={5}
          value={item.grams}
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

  return (
    <div>
      <h2 className="sheet-title">Confirm your meal</h2>
      {draft.thumbnail && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <img
            src={draft.thumbnail}
            alt="meal"
            style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }}
          />
          {draft.description && <p className="hint">{draft.description}</p>}
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
            <span className="n">{f.name}</span>
            <span className="k">
              {f.kcal} kcal/100g{f.serving ? ` · ${f.serving} g` : ''}
            </span>
          </button>
        ))}
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
          Save meal
        </button>
        <button type="button" className="btn danger-text" onClick={onCancel}>
          Discard
        </button>
      </div>
    </div>
  )
}
