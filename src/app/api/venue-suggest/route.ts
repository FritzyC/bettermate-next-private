import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { locationA, locationB, travelMode, tags } = await req.json()

  const googleKey = process.env.GOOGLE_PLACES_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  // Try Google Places first
  if (googleKey) {
    try {
      const venues = await getGoogleVenues(locationA, locationB, tags, googleKey)
      if (venues.length > 0) return NextResponse.json({ venues })
    } catch (e) {
      console.error('Google Places failed:', e)
    }
  }

  // Fallback to Claude
  if (anthropicKey) {
    try {
      const venues = await getClaudeVenues(locationA, locationB, travelMode, tags, anthropicKey)
      return NextResponse.json({ venues })
    } catch (e) {
      console.error('Claude venue gen failed:', e)
    }
  }

  return NextResponse.json({ venues: [] })
}

async function getGoogleVenues(locationA: string, locationB: string, tags: string[], apiKey: string) {
  // Geocode both locations
  const geocode = async (loc: string) => {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(loc)}&key=${apiKey}`)
    const d = await r.json()
    return d.results?.[0]?.geometry?.location ?? null
  }

  const [locA, locB] = await Promise.all([geocode(locationA), geocode(locationB)])
  if (!locA || !locB) return []

  // Midpoint
  const midLat = (locA.lat + locB.lat) / 2
  const midLng = (locA.lng + locB.lng) / 2

  // Search types based on tags or default
  const types = tags?.length > 0 ? ['restaurant', 'cafe', 'park'] : ['restaurant', 'cafe', 'park', 'museum', 'bar']

  const results: any[] = []
  for (const type of types.slice(0, 2)) {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${midLat},${midLng}&radius=8000&type=${type}&key=${apiKey}`
    )
    const d = await r.json()
    const places = d.results?.slice(0, 2) ?? []
    for (const p of places) {
      results.push({
        id: p.place_id,
        name: p.name,
        address: p.vicinity,
        type: type,
        rating: p.rating ?? null,
        photo: p.photos?.[0] ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${p.photos[0].photo_reference}&key=${apiKey}` : null,
        maps_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
        fairness: { bucket: 'midpoint', label: 'Near midpoint', explanation: 'This venue is near the midpoint between you both.' },
      })
    }
    if (results.length >= 3) break
  }

  return results.slice(0, 3)
}

async function getClaudeVenues(locationA: string, locationB: string, travelMode: string, tags: string[], apiKey: string) {
  const prompt = `You are a local venue expert. Suggest 3 real date venues near the midpoint between "${locationA}" and "${locationB}" for two people traveling by ${travelMode || 'car'}.
${tags?.length ? `They enjoy: ${tags.join(', ')}` : ''}

Return ONLY a JSON array with exactly 3 objects. Each object must have:
- id: unique string
- name: real venue name
- address: real street address
- type: venue type
- description: 1 sentence why it works for a date
- fairness: { bucket: "midpoint", label: "Near midpoint", explanation: "brief explanation" }

Return ONLY the JSON array, no other text.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
