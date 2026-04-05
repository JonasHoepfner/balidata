import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key === 'sk_test_PLACEHOLDER') return null
  return new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key || key === 're_PLACEHOLDER') return null
  return new Resend(key)
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signature invalide'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const email = session.customer_details?.email
    if (!email) return NextResponse.json({ received: true })

    // Find the Supabase user by email
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const user = users.find(u => u.email === email)
    if (!user) return NextResponse.json({ received: true })

    await supabaseAdmin.from('subscribers').insert({
      user_id: user.id,
      plan: session.mode === 'subscription' ? 'monthly' : 'once',
      stripe_customer_id: session.customer as string | null,
      stripe_session_id: session.id,
      active: true,
    })

    // Send confirmation email
    const resend = getResend()
    if (resend) {
      await resend.emails.send({
        from: 'BaliData <noreply@balidata.io>',
        to: email,
        subject: 'Votre rapport BaliData est prêt',
        html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;min-height:100vh;padding:48px 24px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111111;border:1px solid #1E1E1E;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:32px 36px;border-bottom:1px solid #1E1E1E;">
            <span style="font-family:'Courier New',monospace;font-size:14px;color:#C4A882;letter-spacing:0.12em;font-weight:500;">BALIDATA</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 24px;">
            <h1 style="font-size:28px;font-weight:600;color:#F0EAE2;margin:0 0 12px;line-height:1.2;">
              Votre rapport est prêt
            </h1>
            <p style="font-size:15px;color:#7A7168;line-height:1.7;margin:0 0 28px;">
              Votre rapport complet BaliData est disponible dans votre espace client. Accédez à votre analyse de marché, vos scénarios de rendement et vos recommandations personnalisées.
            </p>
            <a href="${BASE_URL}/dashboard"
               style="display:inline-block;padding:13px 28px;border-radius:8px;background:linear-gradient(135deg,#C4A882,#8B6F47);color:#0A0A0A;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:-0.01em;">
              Accéder à mon espace →
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #1A1A1A;">
            <p style="font-size:11px;color:#3A3530;margin:0;line-height:1.6;">
              Vous recevez cet email car vous avez souscrit à BaliData.<br>
              Pour toute question : <a href="mailto:contact@balidata.io" style="color:#C4A882;text-decoration:none;">contact@balidata.io</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      }).catch(() => {
        // Email failure should not break the webhook response
      })
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId = typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

    if (customerId) {
      await supabaseAdmin
        .from('subscribers')
        .update({ active: false })
        .eq('stripe_customer_id', customerId)
    }
  }

  return NextResponse.json({ received: true })
}
