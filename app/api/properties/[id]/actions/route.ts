import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

async function ownershipCheck(id: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('properties').select('user_id').eq('id', id).single()
  return !!data && data.user_id === userId
}

// ── GET — journal des actions ──────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  if (!(await ownershipCheck(id, session.user.id))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data: actions, error } = await supabaseAdmin
    .from('property_actions')
    .select('*')
    .eq('property_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ actions: actions ?? [] })
}

// ── POST — créer une action ────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  if (!(await ownershipCheck(id, session.user.id))) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { action_type, old_value, new_value, note } = body

  if (!action_type) return NextResponse.json({ error: 'action_type requis' }, { status: 400 })

  // If price change, update property's current_price_night
  if (action_type === 'price_change' && new_value != null) {
    await supabaseAdmin
      .from('properties')
      .update({ current_price_night: new_value, updated_at: new Date().toISOString() })
      .eq('id', id)
  }

  const { data: action, error } = await supabaseAdmin
    .from('property_actions')
    .insert({
      property_id: id,
      user_id:     session.user.id,
      action_type,
      old_value:   old_value ?? null,
      new_value:   new_value ?? null,
      note:        note ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ action }, { status: 201 })
}
