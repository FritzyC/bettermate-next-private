import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string
    const slot = formData.get('slot') as string

    if (!file || !userId) return NextResponse.json({ error: 'Missing file or userId' }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error — missing env vars', debug: { hasUrl: !!supabaseUrl, hasKey: !!serviceKey } }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${userId}/${Date.now()}_${slot}.${ext}`
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: upErr } = await supabaseAdmin.storage
      .from('profile-photos')
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('profile-photos')
      .getPublicUrl(path)

    return NextResponse.json({ publicUrl, path })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
