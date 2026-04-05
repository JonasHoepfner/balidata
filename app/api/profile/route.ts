import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const { first_name, last_name, avatar_type, country } = body

  // Check if a subscriber row exists for this user
  const { data: existing } = await supabaseAdmin
    .from('subscribers')
    .select('id')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin
      .from('subscribers')
      .update({ first_name, last_name, avatar_type, country })
      .eq('user_id', session.user.id)
  } else {
    // No subscriber row yet — create a profile-only row (no plan)
    await supabaseAdmin
      .from('subscribers')
      .insert({
        user_id: session.user.id,
        first_name,
        last_name,
        avatar_type,
        country,
        active: false,
        plan: null,
      })
  }

  return NextResponse.json({ success: true })
}
