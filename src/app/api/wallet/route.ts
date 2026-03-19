import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    if (searchParams.get('ping')) {
      return NextResponse.json({ pong: true })
    }

    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ balance: 0, locked_balance: 0, ledger: [] })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'missing_env', balance: 0, locked_balance: 0, ledger: [] })
    }

    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(supabaseUrl.trim(), serviceKey.trim(), {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const [creditsRes, ledgerRes] = await Promise.all([
      admin.from('user_credits').select('balance, locked_balance').eq('user_id', userId).maybeSingle(),
      admin.from('credit_ledger').select('id, amount, type, bond_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20)
    ])

    return NextResponse.json({
      balance: creditsRes.data?.balance ?? 0,
      locked_balance: creditsRes.data?.locked_balance ?? 0,
      ledger: ledgerRes.data ?? [],
    })
  } catch (err) {
    return NextResponse.json({ error: String(err), balance: 0, locked_balance: 0, ledger: [] })
  }
}
