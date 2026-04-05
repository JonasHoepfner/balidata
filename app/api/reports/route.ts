import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

// GET — list all reports for logged-in user
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: reports, error } = await supabaseAdmin
    .from('reports')
    .select('id, zone, bedrooms, verdict, project_type, price_announced, created_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reports: reports ?? [] })
}

// POST — save a new analysis as a report
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const {
    zone, bedrooms, verdict, project_type,
    price_announced, developer_price,
    price_median, price_p25, price_p75, price_avg,
    listings_count, est_monthly_revenue, avg_reviews, variance_pct,
  } = body

  const { data, error } = await supabaseAdmin
    .from('reports')
    .insert({
      user_id: session.user.id,
      zone: zone ?? null,
      bedrooms: bedrooms ?? null,
      verdict: verdict ?? null,
      project_type: project_type ?? null,
      price_announced: price_announced ?? null,
      developer_price: developer_price ?? null,
      price_median: price_median ?? null,
      price_p25: price_p25 ?? null,
      price_p75: price_p75 ?? null,
      price_avg: price_avg ?? null,
      listings_count: listings_count ?? null,
      est_monthly_revenue: est_monthly_revenue ?? null,
      avg_reviews: avg_reviews ?? null,
      variance_pct: variance_pct ?? null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
