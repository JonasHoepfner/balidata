import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

function clamp(v: number, min = 0, max = 10) { return Math.max(min, Math.min(max, v)) }

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function toRad(deg: number) { return deg * Math.PI / 180 }
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

async function getPropertyMetrics(property: Record<string, unknown>, badungMedian: number) {
  const zone = property.zone as string | null
  const currentPrice = Number(property.current_price_night ?? 0)

  if (!zone) return null

  const { data: rows } = await supabaseAdmin
    .from('str_listings')
    .select('price_per_night_usd, reviews_count, latitude, longitude, title, bedrooms, airbnb_url')
    .eq('zone', zone)
    .not('price_per_night_usd', 'is', null)

  if (!rows?.length) return null

  const prices = rows.map(r => r.price_per_night_usd as number).sort((a, b) => a - b)
  const reviews = (rows.map(r => r.reviews_count as number | null).filter(r => r != null) as number[])
  const priceMedian = percentile(prices, 0.5)
  const priceP25 = percentile(prices, 0.25)
  const priceP75 = percentile(prices, 0.75)
  const reviewsAvg = reviews.length ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0

  const variancePct = priceMedian > 0 && currentPrice > 0
    ? Math.round(((currentPrice - priceMedian) / priceMedian) * 100)
    : null

  // Score
  const locScore = badungMedian > 0 ? clamp((priceMedian / badungMedian) * 5) : 5
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
  const score = currentPrice > 0 ? Math.round(globalRaw * 10) : null

  // Comparables — nearest if lat/lng available, otherwise from zone
  const lat = property.latitude as number | null
  const lng = property.longitude as number | null
  const comparables = rows
    .filter(r => r.price_per_night_usd != null)
    .map(r => ({
      title: r.title as string,
      price_per_night_usd: r.price_per_night_usd as number,
      bedrooms: r.bedrooms as number | null,
      airbnb_url: r.airbnb_url as string | null,
      distance_km: (lat != null && lng != null && r.latitude != null && r.longitude != null)
        ? Math.round(haversine(lat, lng, r.latitude as number, r.longitude as number) * 10) / 10
        : null,
    }))
    .sort((a, b) => {
      if (a.distance_km != null && b.distance_km != null) return a.distance_km - b.distance_km
      return 0
    })
    .slice(0, 5)

  return {
    priceMedian: Math.round(priceMedian),
    priceP25: Math.round(priceP25),
    priceP75: Math.round(priceP75),
    reviewsAvg: Math.round(reviewsAvg * 10) / 10,
    listingsCount: prices.length,
    estMonthlyRevenue: Math.round(priceMedian * 0.65 * 30),
    variancePct,
    score,
    estOccupancy: 65,
    scores: {
      localisation: Math.round(locScore * 10) / 10,
      demande: Math.round(demScore * 10) / 10,
      prix: Math.round(prixScore * 10) / 10,
      standing: Math.round(standScore * 10) / 10,
      potentiel: Math.round(potScore * 10) / 10,
    },
    comparables,
  }
}

// ── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: property, error } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !property) return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 })
  if (property.user_id !== session.user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Badung median
  const { data: allBadung } = await supabaseAdmin
    .from('str_listings')
    .select('price_per_night_usd')
    .not('price_per_night_usd', 'is', null)
    .limit(1000)
  const badungPrices = (allBadung ?? []).map(r => r.price_per_night_usd as number).sort((a, b) => a - b)
  const badungMedian = percentile(badungPrices, 0.5)

  const metrics = await getPropertyMetrics(property, badungMedian)

  return NextResponse.json({ property, metrics })
}

// ── PATCH ─────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: existing } = await supabaseAdmin
    .from('properties').select('user_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 })
  if (existing.user_id !== session.user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const body = await req.json()
  const allowed = [
    'title', 'address', 'zone', 'property_type', 'bedrooms',
    'current_price_night', 'acquisition_price', 'lease_type',
    'lease_duration', 'latitude', 'longitude', 'weekly_alerts',
  ]
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabaseAdmin
    .from('properties').update(updates).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ property: data })
}

// ── DELETE ────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: existing } = await supabaseAdmin
    .from('properties').select('user_id').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 })
  if (existing.user_id !== session.user.id) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { error } = await supabaseAdmin.from('properties').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
