import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const ids = searchParams.get('ids')
    if (!ids) return NextResponse.json({ data: [] })

    const admin = createClient(
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const idList = ids.split(',').filter(Boolean)
    const { data } = await admin
      .from('user_fingerprint')
      .select('id, display_name, photos')
      .in('id', idList)

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ data: [], error: String(err) })
  }
}
