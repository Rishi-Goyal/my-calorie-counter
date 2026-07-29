import type { MealItem } from '../types'

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
          grams: { type: 'NUMBER' },
          kcalPer100g: { type: 'NUMBER' },
          proteinPer100g: { type: 'NUMBER' },
          carbsPer100g: { type: 'NUMBER' },
          fatPer100g: { type: 'NUMBER' },
          confidence: { type: 'NUMBER' },
        },
        required: ['name', 'grams', 'kcalPer100g', 'proteinPer100g', 'carbsPer100g', 'fatPer100g', 'confidence'],
      },
    },
    totalKcalMin: { type: 'NUMBER' },
    totalKcalMax: { type: 'NUMBER' },
  },
  required: ['description', 'items', 'totalKcalMin', 'totalKcalMax'],
}

export async function analyzePhoto(base64Jpeg: string, apiKey: string, model: string): Promise<AnalysisResult> {
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
        contents: [
          {
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
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
  if (!text) throw new GeminiError('parse', 'The model returned an empty response. Try another photo.')

  let parsed: {
    description?: string
    items?: Array<Partial<MealItem>>
    totalKcalMin?: number
    totalKcalMax?: number
  }
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new GeminiError('parse', 'Could not parse the analysis. Try again.')
  }

  const items: MealItem[] = (parsed.items ?? [])
    .filter((it) => it.name && (it.grams ?? 0) > 0)
    .map((it) => ({
      name: String(it.name),
      grams: Math.round(Number(it.grams)),
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
