import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()

  if (!url || !key) {
    return NextResponse.json({ error: 'missing_env', balance: 0, locked_balance: 0, ledger: [] })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'missing userId', balance: 0, locked_balance: 0, ledger: [] })
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: credits } = await admin
    .from('user_credits')
    .select('balance, locked_balance')
    .eq('user_id', userId)
    .maybeSingle()

  const { data: ledger } = await admin
    .from('credit_ledger')
    .select('id, amount, type, bond_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({
    balance: credits?.balance ?? 0,
    locked_balance: credits?.locked_balance ?? 0,
    ledger: ledger ?? [],
  })
}
