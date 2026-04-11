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
  console.log('[snapshot] ── START property_id:', id)

  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.log('[snapshot] ✗ No session')
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  console.log('[snapshot] session user_id:', session.user.id)

  const { data: property, error: propErr } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  console.log('[snapshot] property fetch →', propErr ? `ERROR: ${propErr.message}` : {
    id: property?.id,
    title: property?.title,
    zone: property?.zone,
    bedrooms: property?.bedrooms,
    current_price_night: property?.current_price_night,
    user_id: property?.user_id,
  })

  if (propErr || !property) return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 })
  if (property.user_id !== session.user.id) {
    console.log('[snapshot] ✗ Ownership mismatch — property.user_id:', property.user_id, '≠ session:', session.user.id)
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const zone         = property.zone as string | null
  const beds         = property.bedrooms as number | null
  const currentPrice = Number(property.current_price_night ?? 0)

  if (!zone) {
    console.log('[snapshot] ✗ No zone set on property')
    return NextResponse.json({ error: 'Zone requise pour le snapshot' }, { status: 400 })
  }

  // ── Fetch zone listings ───────────────────────────────────────────────────
  const { data: zoneListings, error: listErr } = await supabaseAdmin
    .from('str_listings')
    .select('price_per_night_usd, reviews_count, bedrooms')
    .eq('zone', zone)
    .not('price_per_night_usd', 'is', null)

  console.log('[snapshot] str_listings fetch for zone', zone, '→',
    listErr ? `ERROR: ${listErr.message}` : `${zoneListings?.length ?? 0} rows`)

  if (!zoneListings?.length) {
    console.log('[snapshot] ✗ No listings found for zone', zone)
    return NextResponse.json({ error: 'Pas assez de données pour la zone' }, { status: 400 })
  }

  // Bedroom filter with fallback
  let rows = zoneListings
  if (beds != null) {
    const bedroomRows = zoneListings.filter(r => r.bedrooms === beds)
    console.log('[snapshot] bedroom filter:', beds, 'BR →', bedroomRows.length, 'rows',
      bedroomRows.length >= 5 ? '(using bedroom filter)' : '(fallback to all zone)')
    if (bedroomRows.length >= 5) rows = bedroomRows
  }

  const prices    = rows.map(r => r.price_per_night_usd as number).sort((a, b) => a - b)
  const revCounts = rows.map(r => r.reviews_count as number | null).filter((r): r is number => r != null)

  const priceMedian   = percentile(prices, 0.5)
  const priceP25      = percentile(prices, 0.25)
  const priceP75      = percentile(prices, 0.75)
  const reviewsAvg    = revCounts.length ? revCounts.reduce((a, b) => a + b, 0) / revCounts.length : 0
  const listingsCount = prices.length

  const variancePct = priceMedian > 0 && currentPrice > 0
    ? Math.round(((currentPrice - priceMedian) / priceMedian) * 100)
    : null

  console.log('[snapshot] metrics →', {
    listingsCount,
    priceMedian: Math.round(priceMedian),
    priceP25:    Math.round(priceP25),
    priceP75:    Math.round(priceP75),
    reviewsAvg:  Math.round(reviewsAvg * 10) / 10,
    currentPrice,
    variancePct,
  })

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
  prixScore        = clamp(prixScore)
  const standScore = clamp(reviewsAvg / 100 * 10)
  const estRev     = priceMedian * 30 * 0.65
  const bRev       = badungMedian * 30 * 0.65
  const potScore   = bRev > 0 ? clamp((estRev / bRev) * 5) : 5
  const globalRaw  = locScore * 0.25 + demScore * 0.20 + prixScore * 0.20 + standScore * 0.15 + potScore * 0.20
  const score      = currentPrice > 0 ? Math.round(globalRaw * 10) : null

  console.log('[snapshot] score →', {
    badungMedian: Math.round(badungMedian),
    locScore: Math.round(locScore * 10) / 10,
    demScore,
    prixScore: Math.round(prixScore * 10) / 10,
    standScore: Math.round(standScore * 10) / 10,
    potScore: Math.round(potScore * 10) / 10,
    globalRaw: Math.round(globalRaw * 100) / 100,
    score,
  })

  // ── Recommended price ─────────────────────────────────────────────────────
  let recommendedPrice = currentPrice
  if (variancePct != null) {
    if (variancePct > 10)       recommendedPrice = Math.round(priceMedian * 0.95)
    else if (variancePct < -10) recommendedPrice = Math.round(priceMedian * 1.05)
  }
  const estMonthlyRevenue = Math.round(priceMedian * 0.65 * 30)

  console.log('[snapshot] recommendedPrice:', recommendedPrice, '— estMonthlyRevenue:', estMonthlyRevenue)

  // ── Previous snapshot for alert detection ─────────────────────────────────
  const { data: prevSnapshot } = await supabaseAdmin
    .from('property_snapshots')
    .select('price_median, listings_count')
    .eq('property_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  console.log('[snapshot] previous snapshot →', prevSnapshot
    ? { price_median: prevSnapshot.price_median, listings_count: prevSnapshot.listings_count }
    : 'none (first snapshot)')

  // ── Insert snapshot ───────────────────────────────────────────────────────
  const insertPayload = {
    property_id:         id,
    user_id:             session.user.id,
    price_median:        Math.round(priceMedian),
    price_p25:           Math.round(priceP25),
    price_p75:           Math.round(priceP75),
    variance_pct:        variancePct,
    score,
    est_monthly_revenue: estMonthlyRevenue,
    recommended_price:   recommendedPrice,
    listings_count:      listingsCount,
  }
  console.log('[snapshot] inserting into property_snapshots →', insertPayload)

  const { data: snapshot, error: snapErr } = await supabaseAdmin
    .from('property_snapshots')
    .insert(insertPayload)
    .select()
    .single()

  console.log('[snapshot] property_snapshots insert result →',
    snapErr ? `ERROR: ${snapErr.message} (code: ${snapErr.code})` : { id: snapshot?.id, created_at: snapshot?.created_at })

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
    const { error: alertErr } = await supabaseAdmin.from('property_alerts').insert(alertsToInsert)
    console.log('[snapshot] alerts insert →', alertErr ? `ERROR: ${alertErr.message}` : `${alertsToInsert.length} alert(s) created`)
  } else {
    console.log('[snapshot] no alerts to insert')
  }

  // ── Update property ───────────────────────────────────────────────────────
  const updatePayload = {
    current_score:     score,
    recommended_price: recommendedPrice,
    last_snapshot_at:  new Date().toISOString(),
    updated_at:        new Date().toISOString(),
  }
  console.log('[snapshot] updating properties →', updatePayload)

  const { data: updatedProp, error: updateErr } = await supabaseAdmin
    .from('properties')
    .update(updatePayload)
    .eq('id', id)
    .select('id, current_score, recommended_price, last_snapshot_at')
    .single()

  console.log('[snapshot] properties update result →',
    updateErr ? `ERROR: ${updateErr.message} (code: ${updateErr.code})` : updatedProp)

  console.log('[snapshot] ── DONE alerts_created:', alertsToInsert.length)

  return NextResponse.json({ snapshot, alerts_created: alertsToInsert.length })
}
