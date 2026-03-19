import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'missing_service_key' }, { status: 500 })
  }
  const admin = await getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json({ error: 'missing userId' }, { status: 400 })
  }

  const { data: credits, error: creditsErr } = await admin
    .from('user_credits')
    .select('balance, locked_balance')
    .eq('user_id', userId)
    .maybeSingle()

  if (creditsErr) {
    return NextResponse.json({ error: creditsErr.message }, { status: 500 })
  }

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
