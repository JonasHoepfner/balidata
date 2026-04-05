'use client'

import { useState } from 'react'

const PLANS = [
  {
    key: 'once' as const,
    label: 'Rapport unique',
    price: '$29',
    period: 'paiement unique',
    items: [
      'Un rapport complet',
      'PDF téléchargeable par email',
      'Accès permanent à ce rapport',
      'Données marché Airbnb en temps réel',
    ],
    highlight: false,
    cta: 'Obtenir ce rapport',
  },
  {
    key: 'monthly' as const,
    label: 'Investisseur',
    price: '$39',
    period: '/ mois',
    badge: 'Recommandé',
    items: [
      'Rapports illimités',
      'Dashboard complet',
      'Historique de vos analyses',
      'Alertes marché mensuelles',
      'PDF illimités',
    ],
    highlight: true,
    cta: 'S\'abonner',
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(plan: 'once' | 'monthly') {
    setLoading(plan)
    try {
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>

      {/* Logo */}
      <a href="/" style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: '#C4A882', letterSpacing: '0.14em', textDecoration: 'none', marginBottom: 56 }}>
        BALIDATA
      </a>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#C4A882', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
          ACCÈS
        </div>
        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 14 }}>
          Choisissez votre accès
        </h1>
        <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 15, color: '#6A6158', maxWidth: 420, lineHeight: 1.65 }}>
          Débloquez les données complètes de votre analyse Airbnb Bali.
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 740 }}>
        {PLANS.map(p => (
          <div
            key={p.key}
            style={{
              flex: '1 1 300px',
              background: '#111111',
              border: p.highlight ? '1px solid rgba(196,168,130,0.35)' : '1px solid #1E1E1E',
              borderRadius: 14,
              padding: '32px 28px',
              position: 'relative',
            }}
          >
            {p.badge && (
              <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-dm-mono)', padding: '4px 14px', borderRadius: 10, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                {p.badge}
              </div>
            )}

            <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, fontWeight: 600, color: '#8A8178', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
              {p.label}
            </div>

            <div style={{ marginBottom: 24 }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 42, color: '#F0EAE2', lineHeight: 1 }}>{p.price}</span>
              <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4A4540', marginLeft: 8 }}>{p.period}</span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {p.items.map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#7A7168', fontFamily: 'var(--font-outfit)' }}>
                  <span style={{ color: '#4CAF50', fontSize: 11, marginTop: 2, flexShrink: 0 }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleCheckout(p.key)}
              disabled={loading !== null}
              style={{
                width: '100%', padding: '13px', borderRadius: 9, border: 'none',
                cursor: loading !== null ? 'not-allowed' : 'pointer',
                background: p.highlight ? 'linear-gradient(135deg, #C4A882, #8B6F47)' : '#1A1A1A',
                color: p.highlight ? '#0A0A0A' : '#8A8178',
                fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-outfit)',
                transition: 'opacity 0.15s',
                opacity: loading !== null && loading !== p.key ? 0.5 : 1,
              }}
            >
              {loading === p.key ? 'Redirection…' : p.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Back link */}
      <a href="/" style={{ marginTop: 40, fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#3A3530', textDecoration: 'none', letterSpacing: '0.06em' }}>
        ← Retour à l&apos;accueil
      </a>
    </div>
  )
}
