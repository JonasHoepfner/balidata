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
    .select('stripe_subscription_id')
    .eq('user_id', session.user.id)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!subscriber?.stripe_subscription_id) {
    return NextResponse.json({ error: 'Aucun abonnement actif trouvé' }, { status: 404 })
  }

  const updated = await stripe.subscriptions.update(subscriber.stripe_subscription_id, {
    cancel_at_period_end: true,
  })

  const cancelAtTs = (updated as unknown as { cancel_at: number | null }).cancel_at
  const cancelAt = cancelAtTs ? new Date(cancelAtTs * 1000).toISOString() : null

  // Mark subscriber as pending cancellation (access preserved until period end)
  await supabaseAdmin
    .from('subscribers')
    .update({ active: false })
    .eq('user_id', session.user.id)
    .eq('stripe_subscription_id', subscriber.stripe_subscription_id)

  return NextResponse.json({ success: true, cancelAt })
}
