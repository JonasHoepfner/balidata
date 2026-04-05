import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { data: report, error: reportError } = await supabaseAdmin
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Rapport introuvable' }, { status: 404 })
  }

  if (report.user_id !== session.user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const body = await req.json()
  const { globalScore } = body

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'sk-ant-PLACEHOLDER') {
    // Return stub content if no API key configured
    const stub = {
      market_context: `Le marché de ${report.zone ?? 'cette zone'} affiche une forte demande avec ${report.listings_count ?? 'plusieurs'} biens actifs.`,
      pricing: `Avec un prix médian de $${Math.round(report.price_median ?? 0)}/nuit, votre tarif actuel de $${Math.round(report.price_announced ?? 0)}/nuit ${(report.variance_pct ?? 0) > 10 ? 'est au-dessus du marché — envisagez une réduction de 10-15%' : 'est bien positionné — maintenez ou augmentez légèrement en haute saison'}.`,
      positioning: `Pour maximiser votre taux d'occupation, mettez en avant votre différenciation (piscine, vue, design) et maintenez un minimum de 20 avis positifs.`,
      optimization: `Optimisez vos photos professionnelles, proposez un check-in flexible et répondez aux messages en moins d'1h pour améliorer votre classement Airbnb.`,
    }
    await supabaseAdmin.from('reports').update({ report_content: stub }).eq('id', id)
    return NextResponse.json({ content: stub })
  }

  const userMessage = `Zone: ${report.zone ?? 'inconnue'}, prix annoncé: $${Math.round(report.price_announced ?? 0)}/nuit, prix médian marché: $${Math.round(report.price_median ?? 0)}/nuit, variance: ${report.variance_pct ?? 0}%, score global: ${globalScore ?? 0}/100, occupation estimée: 65%, comparables analysés: ${report.listings_count ?? 0}.`

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: 'Tu es un expert en location courte durée à Bali. Génère exactement un JSON valide avec ces clés : market_context (string, 1 phrase sur le marché de la zone), pricing (string, recommandation pricing concrète avec chiffres), positioning (string, recommandation positionnement), optimization (string, recommandation optimisation du bien). Réponds uniquement avec le JSON, aucun texte autour.',
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!anthropicRes.ok) {
    return NextResponse.json({ error: 'Erreur API Claude' }, { status: 502 })
  }

  const anthropicData = await anthropicRes.json()
  const raw = anthropicData?.content?.[0]?.text ?? '{}'

  let content: Record<string, string>
  try {
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    content = JSON.parse(cleaned)
  } catch {
    content = {
      market_context: 'Données de marché disponibles dans le rapport.',
      pricing: raw.slice(0, 200),
      positioning: '',
      optimization: '',
    }
  }

  await supabaseAdmin.from('reports').update({ report_content: content }).eq('id', id)

  return NextResponse.json({ content })
}
