import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Fetch the report
  const { data: report, error: reportError } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })
  }

  if (report.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Fetch zone_stats for this zone + bedrooms
  let zoneStats = null
  if (report.zone) {
    const { data: stats } = await supabaseAdmin
      .from('zone_stats')
      .select('*')
      .ilike('zone', report.zone)
      .eq('bedrooms', report.bedrooms ?? 2)
      .maybeSingle()

    if (stats) {
      zoneStats = stats
    } else {
      // Fallback: zone without bedrooms filter
      const { data: statsFallback } = await supabaseAdmin
        .from('zone_stats')
        .select('*')
        .ilike('zone', report.zone)
        .limit(1)
        .maybeSingle()
      zoneStats = statsFallback
    }
  }

  // Fetch Badung-level median for normalization
  let badungMedian: number | null = null
  const { data: badungStats } = await supabaseAdmin
    .from('zone_stats')
    .select('price_median')

  if (badungStats && badungStats.length > 0) {
    const medians = badungStats
      .map((r: { price_median: number | null }) => r.price_median)
      .filter((v: number | null): v is number => v != null)
      .sort((a: number, b: number) => a - b)
    if (medians.length > 0) {
      badungMedian = medians[Math.floor(medians.length / 2)]
    }
  }

  return NextResponse.json({ report, zoneStats, badungMedian })
}
