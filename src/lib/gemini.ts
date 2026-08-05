import type { FoodRef, MealItem } from '../types'

export interface AnalysisResult {
  items: MealItem[]
  description: string
  kcalMin: number
  kcalMax: number
}

export class GeminiError extends Error {
  kind: 'no-key' | 'bad-key' | 'rate-limit' | 'network' | 'parse' | 'other'
  constructor(kind: GeminiError['kind'], message: string) {
    super(message)
    this.kind = kind
  }
}

const PROMPT = `You are a nutrition analysis engine. Analyze this photo of food/drink.

Identify each distinct food or drink item that would be eaten. For each item estimate:
- the edible portion mass in grams actually visible (use plate size ~26cm, cutlery, hands, or packaging for scale; account for depth/height of piles)
- nutrition PER 100 GRAMS of that food as prepared (cooked values; include absorbed cooking oil, butter, dressings, and sugar in drinks)
- your confidence 0-1 that the identification AND portion are right

Units: use grams (unit "g") for solid and semi-solid foods. For drinks and other liquids consumed by volume (milk, juice, tea, coffee, lassi, soup you'd drink), set unit to "ml", estimate the volume in ml, and give nutrition per 100 ml.

Indian dals and lentil curries: identify the variety from color and texture — toor/arhar (yellow, mushy), moong (pale yellow, small grains), masoor (orange-brown), chana (deep yellow, grainy, holds shape), urad (off-white or black), dal makhani (dark, creamy), panchmel (mixed), sambar (thin, with vegetables and tamarind). Judge consistency from the photo and set kcalPer100g accordingly: watery/thin 60-80, pourable/medium 95-120, thick/scoopable 125-155, makhani-style with visible butter or cream 150-200. Name the item with variety and consistency, e.g. "Toor dal, thick". Dal counts as semi-solid: use grams, not ml.

Also give totalKcalMin and totalKcalMax: an honest 80% confidence interval for the total calories of everything in the photo.

Be realistic, not conservative: home-cooked and restaurant food usually contains more oil than it appears. If the photo contains no food, return an empty items array and say so in description.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    description: { type: 'STRING', description: 'One short sentence describing the meal' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          grams: { type: 'NUMBER', description: 'amount in g, or in ml when unit is ml' },
          unit: { type: 'STRING', enum: ['g', 'ml'] },
          kcalPer100g: { type: 'NUMBER' },
          proteinPer100g: { type: 'NUMBER' },
          carbsPer100g: { type: 'NUMBER' },
          fatPer100g: { type: 'NUMBER' },
          confidence: { type: 'NUMBER' },
        },
        required: ['name', 'grams', 'unit', 'kcalPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g', 'confidence'],
      },
    },
    totalKcalMin: { type: 'NUMBER' },
    totalKcalMax: { type: 'NUMBER' },
  },
  required: ['description', 'items', 'totalKcalMin', 'totalKcalMax'],
}

async function callGemini(parts: unknown[], schema: object, apiKey: string, model: string): Promise<unknown> {
  if (!apiKey) throw new GeminiError('no-key', 'No API key set. Add your free Gemini key in Settings.')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.2,
        },
      }),
    })
  } catch {
    throw new GeminiError('network', 'Network error — check your connection and try again.')
  }

  if (res.status === 429) throw new GeminiError('rate-limit', 'Free-tier rate limit hit. Wait a minute and try again.')
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new GeminiError('bad-key', 'The API key or model name was rejected. Check them in Settings.')
  }
  if (!res.ok) throw new GeminiError('other', `Gemini API error (HTTP ${res.status}).`)

  const data = await res.json()
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new GeminiError('parse', 'The model returned an empty response. Try again.')
  try {
    return JSON.parse(text)
  } catch {
    throw new GeminiError('parse', 'Could not parse the response. Try again.')
  }
}

export async function analyzePhoto(base64Jpeg: string, apiKey: string, model: string): Promise<AnalysisResult> {
  const parsed = (await callGemini(
    [{ inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } }, { text: PROMPT }],
    RESPONSE_SCHEMA,
    apiKey,
    model,
  )) as {
    description?: string
    items?: Array<Partial<MealItem>>
    totalKcalMin?: number
    totalKcalMax?: number
  }

  const items: MealItem[] = (parsed.items ?? [])
    .filter((it) => it.name && (it.grams ?? 0) > 0)
    .map((it) => ({
      name: String(it.name),
      grams: Math.round(Number(it.grams)),
      unit: it.unit === 'ml' ? ('ml' as const) : ('g' as const),
      kcalPer100g: Number(it.kcalPer100g) || 0,
      proteinPer100g: Number(it.proteinPer100g) || 0,
      carbsPer100g: Number(it.carbsPer100g) || 0,
      fatPer100g: Number(it.fatPer100g) || 0,
      confidence: Math.min(1, Math.max(0, Number(it.confidence) || 0.5)),
    }))

  return {
    items,
    description: parsed.description ?? '',
    kcalMin: Math.round(Number(parsed.totalKcalMin) || 0),
    kcalMax: Math.round(Number(parsed.totalKcalMax) || 0),
  }
}

const FOOD_LOOKUP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'canonical dish/food name, capitalized' },
    kcalPer100: { type: 'NUMBER' },
    proteinPer100: { type: 'NUMBER' },
    carbsPer100: { type: 'NUMBER' },
    fatPer100: { type: 'NUMBER' },
    typicalServing: { type: 'NUMBER', description: 'one normal serving, in g or ml' },
    unit: { type: 'STRING', enum: ['g', 'ml'] },
  },
  required: ['name', 'kcalPer100', 'proteinPer100', 'carbsPer100', 'fatPer100', 'typicalServing', 'unit'],
}

/** Text-only lookup for a food missing from the local database. */
export async function lookupFoodByName(query: string, apiKey: string, model: string): Promise<FoodRef> {
  const prompt = `Give typical nutrition values for this food: "${query}".

Per 100 g as prepared and eaten (per 100 ml with unit "ml" if it is a drink). Where the preparation is ambiguous, assume a typical Indian or Singaporean home kitchen, including absorbed cooking oil/ghee. typicalServing is the g/ml of one normal portion. Use the food's proper name (e.g. "Sabudana vada" for "sabudana wada").`

  const parsed = (await callGemini([{ text: prompt }], FOOD_LOOKUP_SCHEMA, apiKey, model)) as {
    name?: string
    kcalPer100?: number
    proteinPer100?: number
    carbsPer100?: number
    fatPer100?: number
    typicalServing?: number
    unit?: string
  }

  const kcal = Number(parsed.kcalPer100)
  if (!parsed.name || !Number.isFinite(kcal) || kcal < 0) {
    throw new GeminiError('parse', `Couldn't get nutrition for "${query}". Try a more specific name.`)
  }

  return {
    name: String(parsed.name),
    kcal: Math.round(kcal),
    p: Math.round((Number(parsed.proteinPer100) || 0) * 10) / 10,
    c: Math.round((Number(parsed.carbsPer100) || 0) * 10) / 10,
    f: Math.round((Number(parsed.fatPer100) || 0) * 10) / 10,
    serving: Math.round(Number(parsed.typicalServing) || 100),
    unit: parsed.unit === 'ml' ? 'ml' : undefined,
  }
}
