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

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: subscriber } = await supabaseAdmin
    .from('subscribers')
    .select('plan, created_at, stripe_customer_id, stripe_subscription_id')
    .eq('user_id', session.user.id)
    .order('active', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!subscriber) {
    return NextResponse.json({ plan: null, planCreatedAt: null, currentPeriodEnd: null, cancelAt: null, invoices: [] })
  }

  const stripe = getStripe()
  if (!stripe || !subscriber.stripe_customer_id) {
    return NextResponse.json({
      plan: subscriber.plan ?? null,
      planCreatedAt: subscriber.created_at ?? null,
      currentPeriodEnd: null,
      cancelAt: null,
      invoices: [],
    })
  }

  // Fetch subscription details for currentPeriodEnd + cancelAt
  let currentPeriodEnd: string | null = null
  let cancelAt: string | null = null

  if (subscriber.stripe_subscription_id) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriber.stripe_subscription_id)
      currentPeriodEnd = new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString()
      const cancelAtPeriodEnd = (sub as unknown as { cancel_at_period_end: boolean }).cancel_at_period_end
      const cancelAtTs = (sub as unknown as { cancel_at: number | null }).cancel_at
      if (cancelAtPeriodEnd && cancelAtTs) {
        cancelAt = new Date(cancelAtTs * 1000).toISOString()
      }
    } catch {
      // Stripe error — skip
    }
  }

  // Fetch invoice history
  type InvoiceRow = {
    id: string
    date: string
    amount: number
    currency: string
    status: string
    invoice_pdf: string | null
  }

  let invoices: InvoiceRow[] = []
  try {
    const stripeInvoices = await stripe.invoices.list({
      customer: subscriber.stripe_customer_id,
      limit: 24,
    })
    invoices = stripeInvoices.data.map(inv => ({
      id: inv.id ?? '',
      date: new Date((inv.created ?? 0) * 1000).toISOString(),
      amount: inv.amount_paid ?? 0,
      currency: inv.currency ?? 'usd',
      status: inv.status ?? 'unknown',
      invoice_pdf: inv.invoice_pdf ?? null,
    }))
  } catch {
    // Return without invoices rather than failing
  }

  return NextResponse.json({
    plan: subscriber.plan ?? null,
    planCreatedAt: subscriber.created_at ?? null,
    currentPeriodEnd,
    cancelAt,
    invoices,
  })
}
