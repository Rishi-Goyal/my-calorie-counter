import { db } from '../lib/db'
import type { Meal } from '../types'

const SOURCE_ICON: Record<string, string> = { photo: '📷', barcode: '𝄃𝄃𝄂', manual: '🔍' }

interface Props {
  meal: Meal
  onEdit: (meal: Meal) => void
  onCopy: (meal: Meal) => void
}

export default function MealCard({ meal, onEdit, onCopy }: Props) {
  const time = new Date(meal.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div
      className="card meal-card"
      role="button"
      tabIndex={0}
      onClick={() => onEdit(meal)}
      onKeyDown={(e) => e.key === 'Enter' && onEdit(meal)}
    >
      {meal.thumbnail ? (
        <img className="meal-thumb" src={meal.thumbnail} alt="" />
      ) : (
        <div className="meal-thumb">{SOURCE_ICON[meal.source] ?? '🍽️'}</div>
      )}
      <div className="meal-info">
        <div className="meal-name">{meal.description || meal.items.map((i) => i.name).join(', ')}</div>
        <div className="meal-meta">
          {time} · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
        </div>
      </div>
      <div className="meal-kcal">
        {meal.kcal}
        {meal.kcalMin && meal.kcalMax ? <span className="range">{meal.kcalMin}–{meal.kcalMax}</span> : null}
      </div>
      <div className="meal-actions">
        <button
          type="button"
          className="icon-btn"
          aria-label="Copy meal to today"
          title="Copy to today"
          onClick={(e) => {
            e.stopPropagation()
            onCopy(meal)
          }}
        >
          ⧉
        </button>
        <button
          type="button"
          className="icon-btn danger"
          aria-label="Delete meal"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm('Delete this meal?')) db.meals.delete(meal.id!)
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
