import type { MealItem } from '../types'

export interface ProductInfo {
  item: MealItem
  productName: string
  servingGrams?: number
}

export async function lookupBarcode(code: string): Promise<ProductInfo | null> {
  const url =
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json` +
    `?fields=product_name,brands,nutriments,serving_quantity,serving_quantity_unit`
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Open Food Facts error (HTTP ${res.status})`)
  }
  const data = await res.json()
  const product = data?.product
  if (!product) return null

  const n = product.nutriments ?? {}
  const kcal = Number(n['energy-kcal_100g'])
  if (!kcal && kcal !== 0) return null // product exists but has no nutrition data

  const name = [product.brands?.split(',')[0], product.product_name].filter(Boolean).join(' ') || `Product ${code}`

  let servingGrams: number | undefined
  const sq = Number(product.serving_quantity)
  const unit = String(product.serving_quantity_unit ?? 'g').toLowerCase()
  if (sq > 0 && (unit === 'g' || unit === 'ml')) servingGrams = Math.round(sq)

  return {
    productName: name,
    servingGrams,
    item: {
      name,
      grams: servingGrams ?? 100,
      unit: unit === 'ml' ? 'ml' : 'g',
      kcalPer100g: kcal,
      proteinPer100g: Number(n.proteins_100g) || 0,
      carbsPer100g: Number(n.carbohydrates_100g) || 0,
      fatPer100g: Number(n.fat_100g) || 0,
      confidence: 1,
    },
  }
}
