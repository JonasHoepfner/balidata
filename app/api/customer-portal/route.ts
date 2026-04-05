import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key === 'sk_test_PLACEHOLDER') return null
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

export async function POST() {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
  }

  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: subscriber } = await supabaseAdmin
    .from('subscribers')
    .select('stripe_customer_id')
    .eq('user_id', session.user.id)
    .eq('active', true)
    .limit(1)
    .single()

  if (!subscriber?.stripe_customer_id) {
    return NextResponse.json({ error: 'Aucun abonnement Stripe trouvé' }, { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscriber.stripe_customer_id,
    return_url: `${baseUrl}/dashboard`,
  })

  return NextResponse.json({ url: portalSession.url })
}
