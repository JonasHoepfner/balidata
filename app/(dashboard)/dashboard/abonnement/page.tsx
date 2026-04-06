'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type Invoice = {
  id: string
  date: string
  amount: number
  currency: string
  status: string
  invoice_pdf: string | null
}

type Billing = {
  plan: string | null
  planCreatedAt: string | null
  currentPeriodEnd: string | null
  cancelAt: string | null
  invoices: Invoice[]
}

type Me = {
  isPaid: boolean
  plan: string | null
  planCreatedAt: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 10,
      padding: '14px 20px', maxWidth: 400,
      fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C4A882',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', lineHeight: 1.5,
    }}>
      {message}
    </div>
  )
}

// ── Cancel Modal ───────────────────────────────────────────────────────────

const CANCEL_REASONS = [
  'Le prix est trop élevé',
  "Je n'utilise plus le service",
  'Il manque des fonctionnalités',
  'Je passe à une autre solution',
  'Autre raison',
]

function CancelModal({
  onClose,
  onConfirmed,
}: {
  onClose: () => void
  onConfirmed: (cancelAt: string | null) => void
}) {
  const [step, setStep]         = useState<1 | 2>(1)
  const [reason, setReason]     = useState<string | null>(null)
  const [details, setDetails]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleConfirm() {
    setLoading(true)
    setError(null)
    try {
      // Log cancellation reason (analytics later)
      console.log('[BaliData] Cancellation reason:', reason, details || null)

      const res = await fetch('/api/cancel-subscription', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Une erreur est survenue.')
        setLoading(false)
        return
      }
      onConfirmed(data.cancelAt ?? null)
    } catch {
      setError('Une erreur est survenue.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0A0A0A', border: '1px solid #2A2A2A',
    borderRadius: 8, padding: '12px 14px', color: '#E8E0D4',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'var(--font-outfit)', resize: 'vertical',
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        animation: 'fadeIn 200ms ease',
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: '#111', border: '1px solid #2A2A2A', borderRadius: 12,
          padding: '32px', fontFamily: 'var(--font-outfit)',
        }}
      >
        {step === 1 ? (
          <>
            <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 26, fontWeight: 600, color: '#F0EAE2', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Êtes-vous sûr de vouloir résilier ?
            </h3>
            <p style={{ fontSize: 13, color: '#6A6158', marginBottom: 20, lineHeight: 1.6 }}>
              En résiliant, vous perdrez l&apos;accès à :
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['Rapports illimités pour tous vos biens', 'Dashboard complet avec carte et filtres', 'Historique de toutes vos analyses', 'Alertes marché mensuelles'].map(item => (
                <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#7A7168' }}>
                  <span style={{ color: '#8B2222', fontSize: 12 }}>✕</span>
                  {item}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={onClose}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8,
                  background: 'transparent', border: '1px solid #2A2A2A',
                  color: '#7A7168', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'var(--font-outfit)',
                }}
              >
                Annuler
              </button>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8, border: 'none',
                  background: 'rgba(139,34,34,0.12)', color: '#C97070',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-outfit)',
                }}
              >
                Continuer →
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 26, fontWeight: 600, color: '#F0EAE2', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Aidez-nous à nous améliorer
            </h3>
            <p style={{ fontSize: 13, color: '#6A6158', marginBottom: 20, lineHeight: 1.6 }}>
              Pourquoi souhaitez-vous résilier ?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {CANCEL_REASONS.map(r => {
                const active = reason === r
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: active ? '1px solid rgba(201,112,112,0.5)' : '1px solid #2A2A2A',
                      background: active ? 'rgba(139,34,34,0.10)' : '#0A0A0A',
                      color: active ? '#C97070' : '#6A6158',
                      fontFamily: 'var(--font-outfit)', fontSize: 13,
                      transition: 'all 0.15s',
                    }}
                  >
                    {r}
                  </button>
                )
              })}
            </div>
            <div style={{ marginBottom: 24 }}>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                placeholder="Votre retour nous aide à améliorer BaliData..."
                rows={3}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 12, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8,
                  background: 'transparent', border: '1px solid #2A2A2A',
                  color: '#7A7168', fontSize: 13, cursor: 'pointer',
                  fontFamily: 'var(--font-outfit)',
                }}
              >
                Retour
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                style={{
                  flex: 1, padding: '11px', borderRadius: 8, border: 'none',
                  background: loading ? '#1A0A0A' : 'rgba(139,34,34,0.18)',
                  color: loading ? '#5A3030' : '#C97070',
                  fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-outfit)',
                }}
              >
                {loading ? 'Résiliation en cours…' : 'Confirmer la résiliation'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

function CheckItem({ label }: { label: string }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#7A7168' }}>
      <span style={{ color: '#4CAF50', fontSize: 11, marginTop: 2, flexShrink: 0 }}>✓</span>
      {label}
    </li>
  )
}

export default function AbonnementPage() {
  const [me, setMe]               = useState<Me | null>(null)
  const [billing, setBilling]     = useState<Billing | null>(null)
  const [billingError, setBillingError] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [showCancel, setShowCancel] = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.json()),
      fetch('/api/billing').then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([meData, billingData]) => {
      setMe(meData)
      if (billingData) setBilling(billingData)
      else setBillingError(true)
      setLoading(false)
    })
  }, [])

  async function handleCheckout() {
    setCheckoutLoading(true)
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'monthly' }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setCheckoutLoading(false)
  }

  const handleCancelled = useCallback((cancelAt: string | null) => {
    setShowCancel(false)
    const dateStr = cancelAt ? fmtDate(cancelAt) : null
    setToast(
      dateStr
        ? `Votre abonnement sera résilié le ${dateStr}. Vous conservez l'accès jusqu'à cette date.`
        : 'Votre résiliation a été prise en compte.'
    )
    // Update local billing state to reflect cancellation
    setBilling(prev => prev ? { ...prev, cancelAt } : prev)
  }, [])

  const card: React.CSSProperties = {
    background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: '28px',
  }
  const goldCard: React.CSSProperties = {
    ...card, border: '1px solid rgba(196,168,130,0.3)',
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', fontFamily: 'var(--font-outfit)' }}>
        <div style={{ color: '#2A2A2A', fontSize: 13 }}>Chargement…</div>
      </div>
    )
  }

  const plan = me?.plan ?? null
  const cancelAt = billing?.cancelAt ?? null
  const isCancelling = !!cancelAt

  return (
    <div style={{ padding: '48px', fontFamily: 'var(--font-outfit)', maxWidth: 700 }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 4 }}>
          Mon abonnement
        </h1>
        <p style={{ fontSize: 14, color: '#6A6158' }}>Gérez votre plan et consultez vos paiements.</p>
      </div>

      {!me?.isPaid ? (
        /* ── No plan ── */
        <>
          <p style={{ fontSize: 13, color: '#6A6158', marginBottom: 24 }}>
            Vous n&apos;avez pas encore de plan actif. Choisissez une offre pour débloquer vos rapports.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Once */}
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6A6158', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Rapport unique</div>
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
              <button
                onClick={async () => {
                  setCheckoutLoading(true)
                  const res = await fetch('/api/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: 'once' }) })
                  const data = await res.json()
                  if (data.url) window.location.href = data.url
                  else setCheckoutLoading(false)
                }}
                disabled={checkoutLoading}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #2A2A2A', background: '#1A1A1A', color: '#8A8178', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {checkoutLoading ? 'Redirection…' : 'Obtenir ce rapport'}
              </button>
            </div>
            {/* Monthly */}
            <div style={{ ...card, border: '1px solid rgba(196,168,130,0.35)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-dm-mono)', padding: '3px 14px', borderRadius: 10, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>RECOMMANDÉ</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#8A8178', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Investisseur</div>
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
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >
                {checkoutLoading ? 'Redirection…' : "S'abonner"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── Section 1 — Plan actif ── */}
          <div style={{ ...goldCard, marginBottom: 16 }}>

            {/* Cancellation banner */}
            {isCancelling && cancelAt && (
              <div style={{
                background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)',
                borderRadius: 8, padding: '12px 16px', marginBottom: 20,
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                <span style={{ fontSize: 13, color: '#FB923C', lineHeight: 1.5 }}>
                  Votre abonnement se termine le <strong>{fmtDate(cancelAt)}</strong>. Vous conservez l&apos;accès jusqu&apos;à cette date.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
              <div>
                <span style={{
                  display: 'inline-block',
                  background: isCancelling ? 'rgba(251,146,60,0.08)' : 'rgba(74,222,128,0.08)',
                  border: `1px solid ${isCancelling ? 'rgba(251,146,60,0.25)' : 'rgba(74,222,128,0.25)'}`,
                  borderRadius: 8, padding: '5px 14px',
                  fontFamily: 'var(--font-dm-mono)', fontSize: 10,
                  color: isCancelling ? '#FB923C' : '#4ADE80',
                  letterSpacing: '0.08em', marginBottom: 12,
                }}>
                  {isCancelling ? 'RÉSILIATION PROGRAMMÉE' : `ACTIF · ${plan === 'monthly' ? 'INVESTISSEUR' : 'RAPPORT UNIQUE'}`}
                </span>

                {billing?.planCreatedAt && (
                  <p style={{ fontSize: 13, color: '#6A6158', marginBottom: 4 }}>
                    Actif depuis le {fmtDate(billing.planCreatedAt)}
                  </p>
                )}

                {plan === 'monthly' && (
                  <p style={{ fontSize: 13, color: '#6A6158', marginBottom: billing?.currentPeriodEnd ? 4 : 0 }}>
                    $39 / mois · Renouvellement automatique
                  </p>
                )}

                {billing?.currentPeriodEnd && !isCancelling && (
                  <p style={{ fontSize: 13, color: '#4A4540' }}>
                    Prochain renouvellement : {fmtDate(billing.currentPeriodEnd)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 2 — Historique paiements ── */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
              HISTORIQUE DES PAIEMENTS
            </div>

            {billingError ? (
              <p style={{ fontSize: 13, color: '#4A4540', fontStyle: 'italic' }}>
                Historique temporairement indisponible.
              </p>
            ) : !billing?.invoices?.length ? (
              <p style={{ fontSize: 13, color: '#4A4540' }}>Aucun paiement enregistré.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      {['Date', 'Description', 'Montant', 'Statut', 'Facture'].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '0 12px 12px 0',
                          fontFamily: 'var(--font-dm-mono)', fontSize: 9,
                          color: '#4A4540', letterSpacing: '0.08em', textTransform: 'uppercase',
                          borderBottom: '1px solid #1E1E1E', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billing.invoices.map((inv, i) => (
                      <tr key={inv.id} style={{ borderBottom: i < billing.invoices.length - 1 ? '1px solid #181818' : 'none' }}>
                        <td style={{ padding: '12px 12px 12px 0', color: '#7A7168', whiteSpace: 'nowrap' }}>
                          {fmtDate(inv.date)}
                        </td>
                        <td style={{ padding: '12px 12px 12px 0', color: '#9A9188' }}>
                          {plan === 'monthly' ? 'Abonnement Investisseur' : 'Rapport unique'}
                        </td>
                        <td style={{ padding: '12px 12px 12px 0', color: '#C8BFB5', whiteSpace: 'nowrap', fontFamily: 'var(--font-dm-mono)', fontSize: 12 }}>
                          {fmtAmount(inv.amount, inv.currency)}
                        </td>
                        <td style={{ padding: '12px 12px 12px 0' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                            fontSize: 10, fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.06em',
                            background: inv.status === 'paid' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                            border: `1px solid ${inv.status === 'paid' ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
                            color: inv.status === 'paid' ? '#4ADE80' : '#F87171',
                          }}>
                            {inv.status === 'paid' ? 'Payé' : 'Échoué'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 0 12px 0' }}>
                          {inv.invoice_pdf ? (
                            <a
                              href={inv.invoice_pdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#C4A882', fontSize: 12, textDecoration: 'none', fontFamily: 'var(--font-dm-mono)' }}
                            >
                              PDF →
                            </a>
                          ) : (
                            <span style={{ color: '#3A3530', fontSize: 12 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Section 3 — Upsell (once → monthly) ── */}
          {plan === 'once' && (
            <div style={{ ...goldCard, marginBottom: 16 }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#C4A882', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
                PASSEZ À L&apos;ABONNEMENT INVESTISSEUR
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <CheckItem label="Rapports illimités pour tous vos biens" />
                <CheckItem label="Accès au dashboard complet avec historique" />
                <CheckItem label="Alertes marché mensuelles" />
                <CheckItem label="Économisez sur chaque rapport supplémentaire" />
              </ul>
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                style={{
                  padding: '11px 26px', borderRadius: 9, border: 'none',
                  background: 'linear-gradient(135deg, #C4A882, #8B6F47)',
                  color: '#0A0A0A', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {checkoutLoading ? 'Redirection…' : 'Passer à Investisseur — $39/mois'}
              </button>
            </div>
          )}

          {/* ── Section 4 — Résiliation ── */}
          {plan === 'monthly' && !isCancelling && (
            <div style={{ marginTop: 8, paddingTop: 8 }}>
              <button
                onClick={() => setShowCancel(true)}
                style={{
                  background: 'none', border: 'none',
                  color: '#8B2222', fontSize: 12,
                  fontFamily: 'var(--font-outfit)', cursor: 'pointer',
                  padding: 0, textDecoration: 'underline', opacity: 0.7,
                }}
              >
                Résilier mon abonnement
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showCancel && (
        <CancelModal
          onClose={() => setShowCancel(false)}
          onConfirmed={handleCancelled}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
