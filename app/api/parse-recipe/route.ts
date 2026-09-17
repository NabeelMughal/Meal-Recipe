import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const systemPrompt = [
  'Analyze the handwritten or printed recipe text in the image (which may be in English, Urdu script, or Roman Urdu).',
  'Translate and output ALL extracted text strictly in plain English.',
  'Return ONLY raw, valid JSON with NO markdown code block wrappers (no ```json).',
  'Follow this exact JSON schema:',
  '{',
  '  "title": "Recipe title in English",',
  '  "description": "Short summary in English",',
  '  "category": "Suggested category name",',
  '  "prepTime": 15,',
  '  "cookTime": 30,',
  '  "servings": 2,',
  '  "difficulty": "Easy", // Easy, Medium, or Hard',
  '  "ingredients": [',
  '    { "name": "Ingredient name in English", "notes": "Qty & unit details in English" }',
  '  ],',
  '  "instructions": [',
  '    "Step 1 detail in English...",',
  '    "Step 2 detail in English..."',
  '  ]',
  '}',
].join('\n')

function normalizeDifficulty(value: unknown) {
  const text = String(value ?? '').trim().toLowerCase()
  if (text === 'medium') return 'Medium'
  if (text === 'hard') return 'Hard'
  return 'Easy'
}

function sanitizeJsonPayload(rawText: string) {
  const trimmed = rawText.trim()
  if (!trimmed) return '{}'

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const cleaned = fenced ? fenced[1] : trimmed

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start !== -1 && end > start) {
    return cleaned.slice(start, end + 1)
  }

  return cleaned
}

function toNumber(value: unknown, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function normalizeRecipeData(payload: any) {
  const ingredients = Array.isArray(payload?.ingredients) ? payload.ingredients.map((item: any) => ({
    name: String(item?.name ?? '').trim() || 'Ingredient',
    notes: String(item?.notes ?? '').trim() || '',
  })) : []

  const instructions = Array.isArray(payload?.instructions)
    ? payload.instructions.map((step: any) => String(step ?? '').trim()).filter(Boolean)
    : []

  return {
    title: String(payload?.title ?? '').trim() || 'Untitled Recipe',
    description: String(payload?.description ?? '').trim() || '',
    category: String(payload?.category ?? '').trim() || 'General',
    prepTime: Math.max(0, toNumber(payload?.prepTime ?? payload?.prep_time, 0)),
    cookTime: Math.max(0, toNumber(payload?.cookTime ?? payload?.cook_time, 0)),
    servings: Math.max(1, toNumber(payload?.servings, 2)),
    difficulty: normalizeDifficulty(payload?.difficulty),
    ingredients,
    instructions,
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 })
    }

    const contentType = request.headers.get('content-type') || ''
    let file: File | null = null
    let base64Image = ''
    let mimeType = 'image/png'

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const incomingFile = formData.get('image') ?? formData.get('file')
      if (!(incomingFile instanceof File)) {
        return NextResponse.json({ error: 'No image file was provided.' }, { status: 400 })
      }
      file = incomingFile
    } else {
      const body = await request.json().catch(() => null)
      if (body?.imageBase64) {
        const rawImage = String(body.imageBase64)
        const dataUrl = rawImage.startsWith('data:') ? rawImage : `data:image/png;base64,${rawImage}`
        const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/i)
        if (matches) {
          mimeType = matches[1]
          base64Image = matches[2]
        }
      } else if (body?.image) {
        const dataUrl = String(body.image)
        const matches = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/i)
        if (matches) {
          mimeType = matches[1]
          base64Image = matches[2]
        }
      }
    }

    if (!file && !base64Image) {
      return NextResponse.json({ error: 'No image payload found.' }, { status: 400 })
    }

    if (!base64Image && file) {
      const buffer = Buffer.from(await file.arrayBuffer())
      base64Image = buffer.toString('base64')
      mimeType = file.type || 'image/jpeg'
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      systemInstruction: systemPrompt,
    })

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
            {
              text: 'Extract the complete recipe and return only raw JSON matching the required schema in plain English.',
            },
          ],
        },
      ],
    })

    const rawResponse = result.response.text()
    const cleaned = sanitizeJsonPayload(rawResponse)
    const parsed = JSON.parse(cleaned)
    return NextResponse.json(normalizeRecipeData(parsed))
  } catch (error: any) {
    console.error('Recipe parse failed:', error)
    return NextResponse.json(
      {
        error: error?.message || 'Failed to parse recipe from image.',
      },
      { status: 500 },
    )
  }
}
