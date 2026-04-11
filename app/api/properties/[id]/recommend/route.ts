import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  console.log('[recommend] ── START property_id:', id)

  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.log('[recommend] ✗ No session')
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  console.log('[recommend] session user_id:', session.user.id)

  const { data: property, error: propError } = await supabaseAdmin
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  console.log('[recommend] property fetch →', propError ? `ERROR: ${propError.message}` : {
    id: property?.id,
    title: property?.title,
    zone: property?.zone,
    property_type: property?.property_type,
    bedrooms: property?.bedrooms,
    current_price_night: property?.current_price_night,
    user_id: property?.user_id,
  })

  if (propError || !property) return NextResponse.json({ error: 'Propriété introuvable' }, { status: 404 })
  if (property.user_id !== session.user.id) {
    console.log('[recommend] ✗ Ownership mismatch')
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { priceMedian, variancePct, score } = body as {
    priceMedian?: number
    variancePct?: number
    score?: number
  }
  console.log('[recommend] request body →', { priceMedian, variancePct, score })

  const currentPrice  = Number(property.current_price_night ?? 0)
  const zone          = property.zone ?? 'inconnue'
  const propertyType  = property.property_type ?? 'villa'
  const bedrooms      = property.bedrooms ?? 2

  const apiKey = process.env.ANTHROPIC_API_KEY
  console.log('[recommend] ANTHROPIC_API_KEY present:', !!apiKey, '— is placeholder:', apiKey === 'sk-ant-PLACEHOLDER')

  if (!apiKey || apiKey === 'sk-ant-PLACEHOLDER') {
    console.log('[recommend] Using stub (no valid API key)')
    const stub = {
      market_context: `Le marché de ${zone} affiche une forte demande pour les locations courte durée avec une médiane de $${Math.round(priceMedian ?? currentPrice)}/nuit.`,
      pricing: `Avec un prix médian de $${Math.round(priceMedian ?? currentPrice)}/nuit, votre tarif actuel de $${Math.round(currentPrice)}/nuit ${(variancePct ?? 0) > 10 ? 'est au-dessus du marché — envisagez une réduction de 10-15% en basse saison' : 'est bien positionné — maintenez ou augmentez légèrement en haute saison (juillet-août).'}.`,
      positioning: `Pour maximiser votre taux d'occupation, mettez en avant les atouts distinctifs de votre ${propertyType} (piscine, vue, design intérieur) et visez un minimum de 20 avis positifs pour booster votre classement.`,
      optimization: `Investissez dans des photos professionnelles, proposez un check-in flexible et maintenez un délai de réponse inférieur à 1h pour améliorer votre score Airbnb et attirer plus de réservations.`,
    }
    const { data: patchData, error: patchErr } = await supabaseAdmin
      .from('properties')
      .update({ last_recommendations: stub, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, last_recommendations')
      .single()
    console.log('[recommend] stub PATCH →', patchErr ? `ERROR: ${patchErr.message}` : { id: patchData?.id, keys: Object.keys(patchData?.last_recommendations ?? {}) })
    return NextResponse.json({ recommendations: stub })
  }

  // ── Build Claude payload ──────────────────────────────────────────────────
  const userMessage = [
    `Zone: ${zone}`,
    `Type de bien: ${propertyType} ${bedrooms}BR`,
    `Prix actuel: $${Math.round(currentPrice)}/nuit`,
    priceMedian  ? `Prix médian du marché: $${Math.round(priceMedian)}/nuit` : null,
    variancePct != null ? `Variance vs marché: ${variancePct > 0 ? '+' : ''}${variancePct}%` : null,
    score != null ? `Score de performance: ${score}/100` : null,
  ].filter(Boolean).join(', ')

  const system = 'Tu es un expert en location courte durée à Bali. En tant que conseiller pour un propriétaire actif, génère exactement un JSON valide avec ces clés : market_context (string, 1 phrase sur le marché de la zone), pricing (string, recommandation pricing concrète avec chiffres), positioning (string, recommandation positionnement), optimization (string, recommandation optimisation du bien). Réponds uniquement avec le JSON, aucun texte autour.'

  const claudePayload = {
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system,
    messages: [{ role: 'user', content: userMessage }],
  }
  console.log('[recommend] Claude API payload →', { model: claudePayload.model, max_tokens: claudePayload.max_tokens, userMessage })

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(claudePayload),
  })

  console.log('[recommend] Claude API response status:', anthropicRes.status, anthropicRes.statusText)

  if (!anthropicRes.ok) {
    const errBody = await anthropicRes.text().catch(() => '(unreadable)')
    console.log('[recommend] ✗ Claude API error body:', errBody)
    return NextResponse.json({ error: 'Erreur API Claude' }, { status: 502 })
  }

  const anthropicData = await anthropicRes.json()
  console.log('[recommend] Claude API raw response →', {
    id: anthropicData?.id,
    model: anthropicData?.model,
    stop_reason: anthropicData?.stop_reason,
    usage: anthropicData?.usage,
    content_blocks: anthropicData?.content?.length,
    raw_text: anthropicData?.content?.[0]?.text?.slice(0, 200),
  })

  const raw = anthropicData?.content?.[0]?.text ?? '{}'

  let recommendations: Record<string, string>
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    recommendations = JSON.parse(cleaned)
    console.log('[recommend] parsed recommendations keys:', Object.keys(recommendations))
  } catch (parseErr) {
    console.log('[recommend] ✗ JSON parse failed:', parseErr, '— raw:', raw.slice(0, 300))
    recommendations = {
      market_context: `Marché de ${zone} — données actualisées.`,
      pricing: raw.slice(0, 300),
      positioning: '',
      optimization: '',
    }
  }

  const { data: patchData, error: patchErr } = await supabaseAdmin
    .from('properties')
    .update({ last_recommendations: recommendations, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, last_recommendations')
    .single()

  console.log('[recommend] PATCH properties →', patchErr
    ? `ERROR: ${patchErr.message} (code: ${patchErr.code})`
    : { id: patchData?.id, keys: Object.keys(patchData?.last_recommendations ?? {}) })

  console.log('[recommend] ── DONE')
  return NextResponse.json({ recommendations })
}
