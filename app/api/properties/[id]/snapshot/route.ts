import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

function clamp(v: number, min = 0, max = 10) { return Math.max(min, Math.min(max, v)) }

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * p
  const lo  = Math.floor(idx)
  const hi  = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: property, error: propErr } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  if (propErr || !property) return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 })
  if (property.user_id !== session.user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const zone         = property.zone as string | null
  const beds         = property.bedrooms as number | null
  const currentPrice = Number(property.current_price_night ?? 0)

  if (!zone) return NextResponse.json({ error: 'Zone requise pour le snapshot' }, { status: 400 })

  // ── Fetch zone listings ───────────────────────────────────────────────────
  const { data: zoneListings } = await supabaseAdmin
    .from('str_listings')
    .select('price_per_night_usd, reviews_count, bedrooms')
    .eq('zone', zone)
    .not('price_per_night_usd', 'is', null)

  if (!zoneListings?.length) return NextResponse.json({ error: 'Pas assez de données pour la zone' }, { status: 400 })

  // Bedroom filter with fallback
  let rows = zoneListings
  if (beds != null) {
    const bedroomRows = zoneListings.filter(r => r.bedrooms === beds)
    if (bedroomRows.length >= 5) rows = bedroomRows
  }

  const prices    = rows.map(r => r.price_per_night_usd as number).sort((a, b) => a - b)
  const revCounts = rows.map(r => r.reviews_count as number | null).filter((r): r is number => r != null)

  const priceMedian = percentile(prices, 0.5)
  const priceP25    = percentile(prices, 0.25)
  const priceP75    = percentile(prices, 0.75)
  const reviewsAvg  = revCounts.length ? revCounts.reduce((a, b) => a + b, 0) / revCounts.length : 0
  const listingsCount = prices.length

  const variancePct = priceMedian > 0 && currentPrice > 0
    ? Math.round(((currentPrice - priceMedian) / priceMedian) * 100)
    : null

  // ── Score ─────────────────────────────────────────────────────────────────
  const { data: allBadung } = await supabaseAdmin
    .from('str_listings')
    .select('price_per_night_usd')
    .not('price_per_night_usd', 'is', null)
    .limit(1000)
  const badungPrices = (allBadung ?? []).map(r => r.price_per_night_usd as number).sort((a, b) => a - b)
  const badungMedian = percentile(badungPrices, 0.5)

  const locScore  = badungMedian > 0 ? clamp((priceMedian / badungMedian) * 5) : 5
  const demScore  = 6
  let prixScore: number
  if (!currentPrice || currentPrice <= priceP25) prixScore = currentPrice ? 10 : 5
  else if (currentPrice >= priceP75)             prixScore = 0
  else if (currentPrice <= priceMedian) prixScore = 5 + 5 * (1 - (currentPrice - priceP25) / (priceMedian - priceP25 || 1))
  else                                  prixScore = 5 * (1 - (currentPrice - priceMedian) / (priceP75 - priceMedian || 1))
  prixScore       = clamp(prixScore)
  const standScore = clamp(reviewsAvg / 100 * 10)
  const estRev     = priceMedian * 30 * 0.65
  const bRev       = badungMedian * 30 * 0.65
  const potScore   = bRev > 0 ? clamp((estRev / bRev) * 5) : 5
  const globalRaw  = locScore * 0.25 + demScore * 0.20 + prixScore * 0.20 + standScore * 0.15 + potScore * 0.20
  const score      = currentPrice > 0 ? Math.round(globalRaw * 10) : null

  // ── Recommended price ─────────────────────────────────────────────────────
  let recommendedPrice = currentPrice
  if (variancePct != null) {
    if (variancePct > 10)  recommendedPrice = Math.round(priceMedian * 0.95)
    else if (variancePct < -10) recommendedPrice = Math.round(priceMedian * 1.05)
  }
  const estMonthlyRevenue = Math.round(priceMedian * 0.65 * 30)

  // ── Previous snapshot for alert detection ─────────────────────────────────
  const { data: prevSnapshot } = await supabaseAdmin
    .from('property_snapshots')
    .select('price_median, listings_count')
    .eq('property_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Insert snapshot ───────────────────────────────────────────────────────
  const { data: snapshot, error: snapErr } = await supabaseAdmin
    .from('property_snapshots')
    .insert({
      property_id:        id,
      user_id:            session.user.id,
      price_median:       Math.round(priceMedian),
      price_p25:          Math.round(priceP25),
      price_p75:          Math.round(priceP75),
      variance_pct:       variancePct,
      score,
      est_monthly_revenue: estMonthlyRevenue,
      recommended_price:  recommendedPrice,
      listings_count:     listingsCount,
    })
    .select()
    .single()

  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 })

  // ── Generate smart alerts ─────────────────────────────────────────────────
  const alertsToInsert: Array<{
    property_id: string; user_id: string; alert_type: string; title: string; message: string
  }> = []

  if (prevSnapshot) {
    const prevCount  = prevSnapshot.listings_count as number | null
    const prevMedian = prevSnapshot.price_median   as number | null

    if (prevCount != null && listingsCount > prevCount) {
      const n = listingsCount - prevCount
      alertsToInsert.push({
        property_id: id,
        user_id:     session.user.id,
        alert_type:  'new_competitor',
        title:       `${n} new listing${n > 1 ? 's' : ''} in your zone`,
        message:     `${n} new competitor${n > 1 ? 's' : ''} appeared in ${zone} this week. Review your pricing to stay competitive.`,
      })
    }

    if (prevMedian && priceMedian > prevMedian * 1.05) {
      const rise = Math.round(((priceMedian - prevMedian) / prevMedian) * 100)
      alertsToInsert.push({
        property_id: id,
        user_id:     session.user.id,
        alert_type:  'price_opportunity',
        title:       `Market median rose ${rise}% in ${zone}`,
        message:     `The market median price in ${zone} increased by ${rise}% this week. This may be a good time to review your pricing upward.`,
      })
    }
  }

  if (alertsToInsert.length > 0) {
    await supabaseAdmin.from('property_alerts').insert(alertsToInsert)
  }

  // ── Update property ───────────────────────────────────────────────────────
  await supabaseAdmin
    .from('properties')
    .update({
      current_score:      score,
      recommended_price:  recommendedPrice,
      last_snapshot_at:   new Date().toISOString(),
      updated_at:         new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({ snapshot, alerts_created: alertsToInsert.length })
}
