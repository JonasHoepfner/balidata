import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('str_listings')
    .select('airbnb_id, latitude, longitude, price_per_night_usd, bedrooms, title, zone, reviews_count, rating_overall')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Assign a stable numeric id from the row index (used for Mapbox hover filter)
  const rows = (data ?? []).map((row, i) => ({ ...row, id: i + 1 }))

  return NextResponse.json(rows)
}
