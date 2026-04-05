import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key === 'sk_test_PLACEHOLDER') return null
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

const PLANS = {
  once: {
    mode: 'payment' as const,
    name: 'BaliData — Rapport complet',
    description: 'Prix exacts, P25/P75, 3 comparables GPS, 3 scénarios de rendement, zonage, export PDF',
    unit_amount: 2900,
  },
  monthly: {
    mode: 'subscription' as const,
    name: 'BaliData Investisseur — Mensuel',
    description: 'Analyses illimitées, dashboard carte, historique marché, alertes prix',
    unit_amount: 3900,
    recurring: { interval: 'month' as const },
  },
  b2b: {
    mode: 'subscription' as const,
    name: 'BaliData Partenaire B2B — Mensuel',
    description: 'Widget intégrable, marque blanche, accès API, support dédié',
    unit_amount: 19900,
    recurring: { interval: 'month' as const },
  },
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const planKey = (body.plan ?? 'once') as keyof typeof PLANS
  const plan = PLANS[planKey] ?? PLANS.once

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans .env.local' },
      { status: 503 }
    )
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: plan.mode,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: plan.name, description: plan.description },
            unit_amount: plan.unit_amount,
            ...(plan.mode === 'subscription' && 'recurring' in plan
              ? { recurring: plan.recurring }
              : {}),
          },
          quantity: 1,
        },
      ],
      success_url: `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur Stripe inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
