'use client'

import { useEffect, useState } from 'react'

type Me = {
  isPaid: boolean; plan: string | null; planCreatedAt: string | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function CheckItem({ label }: { label: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#7A7168' }}>
      <span style={{ color: '#4CAF50', fontSize: 11, marginTop: 2, flexShrink: 0 }}>✓</span>
      {label}
    </li>
  )
}

export default function AbonnementPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => { setMe(d); setLoading(false) })
  }, [])

  async function handlePortal() {
    setPortalLoading(true)
    const res = await fetch('/api/customer-portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setPortalLoading(false)
  }

  async function handleCheckout(plan: 'once' | 'monthly') {
    setCheckoutLoading(true)
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setCheckoutLoading(false)
  }

  const card: React.CSSProperties = { background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: '28px 28px' }
  const goldCard: React.CSSProperties = { ...card, border: '1px solid rgba(196,168,130,0.3)' }

  return (
    <div style={{ padding: '48px 48px', fontFamily: 'var(--font-outfit)', maxWidth: 720 }}>

      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 4 }}>Mon abonnement</h1>
        <p style={{ fontSize: 14, color: '#6A6158' }}>Gérez votre plan et votre facturation.</p>
      </div>

      {loading ? (
        <div style={{ color: '#2A2A2A', fontSize: 13 }}>Chargement…</div>
      ) : !me?.isPaid ? (
        /* No plan — show both offers */
        <>
          <p style={{ fontSize: 13, color: '#6A6158', marginBottom: 24 }}>Vous n&apos;avez pas encore de plan actif. Choisissez une offre pour débloquer vos rapports.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Once */}
            <div style={card}>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, fontWeight: 600, color: '#6A6158', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Rapport unique</div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 36, color: '#F0EAE2' }}>$29</span>
                <span style={{ fontSize: 12, color: '#4A4540', marginLeft: 8 }}>paiement unique</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CheckItem label="Un rapport complet" />
                <CheckItem label="Données temps réel Airbnb" />
                <CheckItem label="PDF téléchargeable" />
                <CheckItem label="Accès permanent" />
              </ul>
              <button onClick={() => handleCheckout('once')} disabled={checkoutLoading} style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #2A2A2A', background: '#1A1A1A', color: '#8A8178', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {checkoutLoading ? 'Redirection…' : 'Obtenir ce rapport'}
              </button>
            </div>
            {/* Monthly */}
            <div style={{ ...card, border: '1px solid rgba(196,168,130,0.35)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-dm-mono)', padding: '3px 14px', borderRadius: 10, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>RECOMMANDÉ</div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, fontWeight: 600, color: '#8A8178', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Investisseur</div>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 36, color: '#F0EAE2' }}>$39</span>
                <span style={{ fontSize: 12, color: '#4A4540', marginLeft: 8 }}>/ mois</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CheckItem label="Rapports illimités" />
                <CheckItem label="Dashboard complet" />
                <CheckItem label="Historique de vos analyses" />
                <CheckItem label="Alertes marché mensuelles" />
              </ul>
              <button onClick={() => handleCheckout('monthly')} disabled={checkoutLoading} style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {checkoutLoading ? 'Redirection…' : "S'abonner"}
              </button>
            </div>
          </div>
        </>
      ) : me.plan === 'monthly' ? (
        /* Monthly plan */
        <>
          <div style={goldCard}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <span style={{ display: 'inline-block', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '5px 14px', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4ADE80', letterSpacing: '0.08em', marginBottom: 12 }}>
                  ACTIF · INVESTISSEUR
                </span>
                {me.planCreatedAt && (
                  <p style={{ fontSize: 13, color: '#6A6158', marginBottom: 4 }}>Actif depuis le {fmtDate(me.planCreatedAt)}</p>
                )}
                <p style={{ fontSize: 13, color: '#6A6158' }}>$39 / mois · Renouvellement automatique</p>
              </div>
              <button onClick={handlePortal} disabled={portalLoading} style={{ padding: '10px 22px', borderRadius: 8, background: 'none', border: '1px solid #2A2A2A', color: '#C4A882', fontSize: 13, cursor: 'pointer', opacity: portalLoading ? 0.6 : 1 }}>
                {portalLoading ? 'Chargement…' : 'Gérer mon abonnement'}
              </button>
            </div>
          </div>
          <div style={{ ...card, marginTop: 16 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>FACTURATION</div>
            <p style={{ fontSize: 13, color: '#6A6158', lineHeight: 1.7, marginBottom: 16 }}>
              Gérez vos factures, modifiez votre moyen de paiement ou résiliez depuis le portail sécurisé Stripe.
            </p>
            <button onClick={handlePortal} disabled={portalLoading} style={{ padding: '9px 20px', borderRadius: 7, background: 'none', border: '1px solid #2A2A2A', color: '#7A7168', fontSize: 12, cursor: 'pointer' }}>
              Accéder au portail Stripe →
            </button>
          </div>
        </>
      ) : (
        /* Once plan — upsell to monthly */
        <>
          <div style={card}>
            <span style={{ display: 'inline-block', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '5px 14px', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4ADE80', letterSpacing: '0.08em', marginBottom: 12 }}>
              ACTIF · RAPPORT UNIQUE
            </span>
            {me.planCreatedAt && (
              <p style={{ fontSize: 13, color: '#6A6158' }}>Acheté le {fmtDate(me.planCreatedAt)}</p>
            )}
          </div>
          <div style={{ ...goldCard, marginTop: 16 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#C4A882', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>PASSEZ À L&apos;ABONNEMENT INVESTISSEUR</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <CheckItem label="Rapports illimités pour tous vos biens" />
              <CheckItem label="Accès au dashboard complet avec historique" />
              <CheckItem label="Alertes marché mensuelles" />
              <CheckItem label="Économisez sur chaque rapport supplémentaire" />
            </ul>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => handleCheckout('monthly')} disabled={checkoutLoading} style={{ padding: '11px 26px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {checkoutLoading ? 'Redirection…' : 'Passer à Investisseur — $39/mois'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
