import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

// ── Helpers ────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 10) { return Math.max(min, Math.min(max, v)) }

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function computeScore({
  currentPrice, priceMedian, priceP25, priceP75, reviewsAvg, badungMedian,
}: {
  currentPrice: number
  priceMedian: number
  priceP25: number
  priceP75: number
  reviewsAvg: number
  badungMedian: number
}) {
  const locScore = badungMedian > 0 ? clamp((priceMedian / badungMedian) * 5) : 5

  // Demand proxy: use fixed 60% activity as default (no high_activity_pct column here)
  const demScore = 6

  let prixScore: number
  if (currentPrice <= priceP25) prixScore = 10
  else if (currentPrice >= priceP75) prixScore = 0
  else if (currentPrice <= priceMedian) prixScore = 5 + 5 * (1 - (currentPrice - priceP25) / (priceMedian - priceP25 || 1))
  else prixScore = 5 * (1 - (currentPrice - priceMedian) / (priceP75 - priceMedian || 1))
  prixScore = clamp(prixScore)

  const standScore = clamp(reviewsAvg / 100 * 10)

  const estRev = priceMedian * 30 * 0.65
  const bRev = badungMedian * 30 * 0.65
  const potScore = bRev > 0 ? clamp((estRev / bRev) * 5) : 5

  const globalRaw = locScore * 0.25 + demScore * 0.20 + prixScore * 0.20 + standScore * 0.15 + potScore * 0.20
  return Math.round(globalRaw * 10)
}

// ── GET — list user properties with computed metrics ─────────────────────

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: properties, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!properties?.length) return NextResponse.json({ properties: [] })

  // Fetch zone stats for all relevant zones (include bedrooms for filtered median)
  const zones = [...new Set(properties.map(p => p.zone).filter(Boolean))] as string[]

  const { data: allListings } = await supabaseAdmin
    .from('str_listings')
    .select('zone, bedrooms, price_per_night_usd, reviews_count')
    .in('zone', zones)
    .not('price_per_night_usd', 'is', null)

  // Compute badung-wide median
  const { data: allBadung } = await supabaseAdmin
    .from('str_listings')
    .select('price_per_night_usd')
    .not('price_per_night_usd', 'is', null)
    .limit(1000)

  const badungPrices = (allBadung ?? [])
    .map(r => r.price_per_night_usd as number)
    .sort((a, b) => a - b)
  const badungMedian = percentile(badungPrices, 0.5)

  // Build buckets: by zone only, and by zone+bedrooms
  type ListingRow = { price: number; reviews: number | null }
  const byZone: Record<string, ListingRow[]> = {}
  const byZoneBedroom: Record<string, ListingRow[]> = {}

  for (const r of (allListings ?? [])) {
    const zone    = r.zone as string
    const beds    = r.bedrooms as number | null
    const price   = r.price_per_night_usd as number
    const reviews = r.reviews_count as number | null

    if (!byZone[zone]) byZone[zone] = []
    byZone[zone].push({ price, reviews })

    if (beds != null) {
      const key = `${zone}:${beds}`
      if (!byZoneBedroom[key]) byZoneBedroom[key] = []
      byZoneBedroom[key].push({ price, reviews })
    }
  }

  function buildMetrics(rows: ListingRow[]) {
    const prices  = rows.map(r => r.price).sort((a, b) => a - b)
    const reviews = rows.map(r => r.reviews).filter((r): r is number => r != null)
    const med     = percentile(prices, 0.5)
    return {
      priceMedian:       med,
      priceP25:          percentile(prices, 0.25),
      priceP75:          percentile(prices, 0.75),
      reviewsAvg:        reviews.length ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0,
      count:             prices.length,
      estMonthlyRevenue: Math.round(med * 0.65 * 30),
    }
  }

  const MIN_BEDROOM_COMPARABLES = 5

  const enriched = properties.map(p => {
    const zone         = p.zone as string | null
    const beds         = p.bedrooms as number | null
    const currentPrice = Number(p.current_price_night ?? 0)

    let zm: ReturnType<typeof buildMetrics> | null = null
    if (zone) {
      // Try zone+bedrooms first if property has bedrooms set
      if (beds != null) {
        const key  = `${zone}:${beds}`
        const rows = byZoneBedroom[key] ?? []
        if (rows.length >= MIN_BEDROOM_COMPARABLES) {
          zm = buildMetrics(rows)
        }
      }
      // Fallback: all listings in the zone
      if (!zm) {
        const rows = byZone[zone] ?? []
        if (rows.length > 0) zm = buildMetrics(rows)
      }
    }

    const priceMedian = zm?.priceMedian ?? 0
    const variancePct = priceMedian > 0 && currentPrice > 0
      ? Math.round(((currentPrice - priceMedian) / priceMedian) * 100)
      : null
    const score = zm && currentPrice > 0
      ? computeScore({
          currentPrice,
          priceMedian:  zm.priceMedian,
          priceP25:     zm.priceP25,
          priceP75:     zm.priceP75,
          reviewsAvg:   zm.reviewsAvg,
          badungMedian,
        })
      : null

    return {
      ...p,
      metrics: zm ? {
        priceMedian:       Math.round(zm.priceMedian),
        priceP25:          Math.round(zm.priceP25),
        priceP75:          Math.round(zm.priceP75),
        reviewsAvg:        Math.round(zm.reviewsAvg * 10) / 10,
        listingsCount:     zm.count,
        estMonthlyRevenue: zm.estMonthlyRevenue,
        variancePct,
        score,
        estOccupancy:      65,
      } : null,
    }
  })

  return NextResponse.json({ properties: enriched })
}

// ── POST — create a new property ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Check plan and property limit
  const { data: subscriber } = await supabaseAdmin
    .from('subscribers')
    .select('plan, active, is_admin')
    .eq('user_id', session.user.id)
    .order('active', { ascending: false })
    .limit(1)
    .maybeSingle()

  const isAdmin = !!subscriber?.is_admin

  if (!isAdmin) {
    const { count } = await supabaseAdmin
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Limite de 3 propriétés atteinte. Passez à Pro pour en ajouter plus.' },
        { status: 403 }
      )
    }
  }

  const body = await req.json()
  const {
    title, address, zone, property_type, bedrooms,
    current_price_night, acquisition_price,
    lease_type, lease_duration, latitude, longitude,
    weekly_alerts,
  } = body

  if (!title) return NextResponse.json({ error: 'Le titre est requis' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('properties')
    .insert({
      user_id: session.user.id,
      title,
      address: address ?? null,
      zone: zone ?? null,
      property_type: property_type ?? null,
      bedrooms: bedrooms ?? null,
      current_price_night: current_price_night ?? null,
      acquisition_price: acquisition_price ?? null,
      lease_type: lease_type ?? null,
      lease_duration: lease_duration ?? null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      weekly_alerts: weekly_alerts ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ property: data }, { status: 201 })
}
