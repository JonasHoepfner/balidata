import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key === 'sk_test_PLACEHOLDER') return null
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const plan: 'once' | 'monthly' = body.plan === 'monthly' ? 'monthly' : 'once'

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe non configuré — ajoutez STRIPE_SECRET_KEY dans .env.local' },
      { status: 503 }
    )
  }

  try {
    const isMonthly = plan === 'monthly'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: isMonthly ? 'subscription' : 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: isMonthly ? 'BaliData Pro — Accès mensuel' : 'BaliData — Rapport complet',
              description: isMonthly
                ? 'Analyses illimitées, prix exacts, comparables GPS, export PDF'
                : 'Rapport unique : prix exact, P25/P75, 3 comparables proches, export PDF',
            },
            ...(isMonthly
              ? { recurring: { interval: 'month' }, unit_amount: 3900 }
              : { unit_amount: 2900 }
            ),
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
