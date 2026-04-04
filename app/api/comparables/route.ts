import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ── Maths ──────────────────────────────────────────────────────────────────

function toRad(deg: number) { return deg * Math.PI / 180 }

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(a))
}

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * pct / 100
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function r2(n: number) { return Math.round(n * 100) / 100 }

// ── Types ──────────────────────────────────────────────────────────────────

type Row = {
  airbnb_id: string
  title: string
  price_per_night_usd: number | null
  reviews_count: number | null
  bedrooms: number | null
  zone: string | null
  latitude: number | null
  longitude: number | null
  airbnb_url: string | null
}

type NearbyListing = {
  airbnb_id: string
  title: string
  price_per_night_usd: number
  distance_km: number
  airbnb_url: string | null
}

// ── Stats builder ──────────────────────────────────────────────────────────

function buildStats(rows: Row[], price_announced?: number, radius_km?: number, radius_used?: number) {
  const prices = rows
    .map(r => r.price_per_night_usd!)
    .filter(p => p != null)
    .sort((a, b) => a - b)

  const reviews = rows.map(r => r.reviews_count).filter(r => r != null) as number[]

  if (prices.length === 0) {
    return {
      listings_count: 0,
      price_median: null, price_p25: null, price_p75: null, price_avg: null,
      avg_reviews: null, est_monthly_revenue: null,
      verdict: 'no_data', variance_pct: null,
      radius_km: radius_km ?? null, radius_used: radius_used ?? null,
      nearest_listings: [],
    }
  }

  const price_median = percentile(prices, 50)
  const price_p25 = percentile(prices, 25)
  const price_p75 = percentile(prices, 75)
  const price_avg = prices.reduce((a, b) => a + b, 0) / prices.length
  const avg_reviews = reviews.length ? reviews.reduce((a, b) => a + b, 0) / reviews.length : null
  const est_monthly_revenue = price_median * 30 * 0.65

  let verdict: string | null = null
  let variance_pct: number | null = null
  if (price_announced != null) {
    const ratio = price_announced / price_median
    verdict = ratio <= 1.10 ? 'realiste' : ratio <= 1.30 ? 'optimiste' : 'survendu'
    variance_pct = r2(((price_announced - price_median) / price_median) * 100)
  }

  return {
    listings_count: prices.length,
    price_median: r2(price_median),
    price_p25: r2(price_p25),
    price_p75: r2(price_p75),
    price_avg: r2(price_avg),
    avg_reviews: avg_reviews != null ? Math.round(avg_reviews * 10) / 10 : null,
    est_monthly_revenue: r2(est_monthly_revenue),
    verdict,
    variance_pct,
    radius_km: radius_km ?? null,
    radius_used: radius_used ?? null,
    nearest_listings: [] as NearbyListing[],
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    zone,
    bedrooms,
    price_announced,
    lat,
    lng,
    radius_km = 1.0,
  } = body as {
    zone?: string
    bedrooms?: number
    price_announced?: number
    lat?: number
    lng?: number
    radius_km?: number
  }

  const useGPS = lat != null && lng != null

  // Fetch from Supabase
  let query = supabaseAdmin
    .from('str_listings')
    .select('airbnb_id, title, price_per_night_usd, reviews_count, bedrooms, zone, latitude, longitude, airbnb_url')

  if (!useGPS && zone) {
    query = query.ilike('zone', zone)
  }

  if (bedrooms != null) {
    query = query.gte('bedrooms', bedrooms - 1).lte('bedrooms', bedrooms + 1)
  }

  if (useGPS) {
    // Only fetch rows that have coordinates
    query = query.not('latitude', 'is', null).not('longitude', 'is', null)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data ?? []) as Row[]

  // ── GPS mode: Haversine filter with auto-expand ─────────────────────────
  if (useGPS) {
    const EXPAND_SEQUENCE = [radius_km, 2, 5]
    let filtered: Row[] = []
    let radius_used = radius_km

    for (const r of EXPAND_SEQUENCE) {
      filtered = rows.filter(row => {
        if (row.latitude == null || row.longitude == null) return false
        return haversine(lat!, lng!, row.latitude, row.longitude) <= r
      })
      radius_used = r
      if (filtered.length >= 5) break
    }

    const stats = buildStats(filtered, price_announced, radius_km, radius_used)

    // Nearest 3 listings sorted by distance
    const withDist = filtered
      .filter(r => r.price_per_night_usd != null && r.latitude != null && r.longitude != null)
      .map(r => ({
        airbnb_id: r.airbnb_id,
        title: r.title,
        price_per_night_usd: r.price_per_night_usd!,
        distance_km: r2(haversine(lat!, lng!, r.latitude!, r.longitude!)),
        airbnb_url: r.airbnb_url,
      }))
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 3)

    stats.nearest_listings = withDist

    const insufficient = filtered.length < 5
      ? `Données insuffisantes dans un rayon de ${radius_km}km — élargi à ${radius_used}km (${filtered.length} comparables).`
      : null

    return NextResponse.json({
      zone: zone ?? null,
      bedrooms: bedrooms ?? null,
      lat, lng,
      ...stats,
      insufficient_data_message: insufficient,
    })
  }

  // ── Zone mode (original) ────────────────────────────────────────────────
  const stats = buildStats(rows, price_announced)

  return NextResponse.json({
    zone: zone ?? null,
    bedrooms: bedrooms ?? null,
    lat: null, lng: null,
    ...stats,
    insufficient_data_message: null,
  })
}
