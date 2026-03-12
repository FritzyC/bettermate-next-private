import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { locationA, locationB, travelMode, tags } = await req.json()
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const googleKey = process.env.GOOGLE_PLACES_API_KEY

  console.log('keys:', !!anthropicKey, !!googleKey)

  if (!anthropicKey) {
    return NextResponse.json({ error: 'No API key', venues: [] })
  }

  const prompt = `You are a local venue expert with deep knowledge of cities across the United States including New York City, Atlanta, Albany, Los Angeles, Chicago, Miami, Houston, Washington DC, Boston, Philadelphia, and all major US metros.

Suggest 3 real, specific date venues near or between "${locationA}" and "${locationB}" for two people traveling by ${travelMode || 'car'}. Use your knowledge of the actual city or region these locations are in.
${tags?.length ? `They enjoy: ${tags.join(', ')}` : 'Suggest a mix of restaurant, cafe, and outdoor options.'}

Use ONLY real venues that actually exist in the relevant city or region. Include the actual street address. Match the city/neighborhood of the provided locations.

Return ONLY a valid JSON array with exactly 3 objects. Each object:
{
  "id": "unique_string",
  "name": "Real Venue Name",
  "address": "Real Street Address, City, NY",
  "type": "restaurant|cafe|park|bar|museum",
  "description": "One sentence why this works for a date",
  "lat": 42.6526,
  "lng": -73.7562,
  "fairness": { "bucket": "midpoint", "label": "Near midpoint", "explanation": "Easy for both to reach" }
}

Return ONLY the JSON array. No markdown, no explanation.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    console.log('Claude status:', res.status)
    const text = data.content?.[0]?.text ?? ''
    console.log('Claude text:', text.slice(0, 100))
    const clean = text.replace(/```json|```/g, '').trim()
    const venues = JSON.parse(clean)
    return NextResponse.json({ venues })
  } catch (e) {
    console.error('Claude failed:', e)
    return NextResponse.json({ venues: [], error: String(e) })
  }
}
