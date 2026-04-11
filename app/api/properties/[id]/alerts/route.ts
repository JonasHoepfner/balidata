import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

// ── GET — alertes non lues ─────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: property } = await supabaseAdmin
    .from('properties').select('user_id').eq('id', id).single()

  if (!property || property.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data: alerts, error } = await supabaseAdmin
    .from('property_alerts')
    .select('*')
    .eq('property_id', id)
    .eq('read', false)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ alerts: alerts ?? [] })
}

// ── PATCH — marquer une alerte comme lue ──────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { alert_id } = body as { alert_id: string }
  if (!alert_id) return NextResponse.json({ error: 'alert_id requis' }, { status: 400 })

  // Verify ownership via the alert's user_id
  const { data: existing } = await supabaseAdmin
    .from('property_alerts')
    .select('user_id')
    .eq('id', alert_id)
    .eq('property_id', id)
    .single()

  if (!existing || existing.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('property_alerts')
    .update({ read: true })
    .eq('id', alert_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ alert: data })
}
