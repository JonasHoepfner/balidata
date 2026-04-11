import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!property || property.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data: snapshots, error } = await supabaseAdmin
    .from('property_snapshots')
    .select('*')
    .eq('property_id', id)
    .order('created_at', { ascending: false })
    .limit(12)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return in chronological order (oldest → newest) for the chart
  return NextResponse.json({ snapshots: (snapshots ?? []).reverse() })
}
