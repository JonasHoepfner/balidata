'use client'

import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Me = { loggedIn: boolean; isPaid: boolean; plan: string | null; email: string | null }

type Report = {
  id: string
  zone: string | null
  bedrooms: number | null
  verdict: string | null
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span style={{ color: '#4A4540', fontFamily: 'var(--font-dm-mono)', fontSize: 10 }}>—</span>
  const map: Record<string, { color: string; bg: string; label: string }> = {
    excellent: { color: '#4ADE80', bg: 'rgba(74,222,128,0.08)', label: 'Excellent' },
    bon: { color: '#86EFAC', bg: 'rgba(134,239,172,0.08)', label: 'Bon' },
    moyen: { color: '#FCD34D', bg: 'rgba(252,211,77,0.08)', label: 'Moyen' },
    faible: { color: '#F87171', bg: 'rgba(248,113,113,0.08)', label: 'Faible' },
  }
  const v = map[verdict.toLowerCase()] ?? { color: '#C4A882', bg: 'rgba(196,168,130,0.08)', label: verdict }
  return (
    <span style={{ display: 'inline-block', background: v.bg, border: `1px solid ${v.color}40`, borderRadius: 6, padding: '3px 10px', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: v.color, letterSpacing: '0.06em' }}>
      {v.label}
    </span>
  )
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 20px', fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C4A882', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {message}
    </div>
  )
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then((data: Me) => {
      setMe(data)
      if (!data.loggedIn) {
        window.location.href = '/login'
        return
      }
      // Load reports
      const supabase = createSupabaseBrowserClient()
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return
        const { data: rows } = await supabase
          .from('reports')
          .select('id, zone, bedrooms, verdict, created_at')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        setReports(rows ?? [])
        setLoadingReports(false)
      })
    })
  }, [])

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  async function handlePortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/customer-portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setToast('Impossible d\'accéder au portail. Contactez le support.')
      }
    } catch {
      setToast('Une erreur est survenue.')
    } finally {
      setPortalLoading(false)
    }
  }

  function handleDownloadPDF() {
    setToast('Export PDF bientôt disponible.')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', fontFamily: 'var(--font-outfit)' }}>

      {/* Fixed Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, borderBottom: '1px solid #1A1A1A', background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882', letterSpacing: '0.12em' }}>BALIDATA</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {me?.email && (
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#4A4540' }}>{me.email}</span>
          )}
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #2A2A2A', borderRadius: 7, padding: '7px 16px', color: '#6A6158', fontSize: 12, cursor: 'pointer' }}>
            Se déconnecter
          </button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ paddingTop: 80, maxWidth: 720, margin: '0 auto', padding: '80px 24px 80px' }}>

        {/* Section 1 — Plan */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540', letterSpacing: '0.14em', marginBottom: 16 }}>ABONNEMENT</div>
          <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 14, padding: '28px 28px' }}>
            {me == null ? (
              <div style={{ color: '#2A2A2A', fontSize: 13 }}>Chargement…</div>
            ) : me.isPaid ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ display: 'inline-block', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 8, padding: '5px 14px', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4ADE80', letterSpacing: '0.08em' }}>
                      ACTIF · {me.plan === 'monthly' ? 'MENSUEL' : me.plan === 'once' ? 'ACCÈS UNIQUE' : (me.plan ?? '').toUpperCase()}
                    </span>
                  </div>
                  {me.plan === 'once' && (
                    <p style={{ fontSize: 13, color: '#6A6158', marginTop: 8 }}>
                      Passez au plan mensuel pour accéder à des analyses illimitées et des mises à jour de marché chaque mois.{' '}
                      <a href="/#pricing" style={{ color: '#C4A882', textDecoration: 'none' }}>Voir les tarifs →</a>
                    </p>
                  )}
                </div>
                {me.plan === 'monthly' && (
                  <button
                    onClick={handlePortal}
                    disabled={portalLoading}
                    style={{ background: 'none', border: '1px solid #2A2A2A', borderRadius: 8, padding: '10px 20px', color: '#C4A882', fontSize: 13, cursor: portalLoading ? 'wait' : 'pointer', opacity: portalLoading ? 0.6 : 1 }}
                  >
                    {portalLoading ? 'Chargement…' : 'Gérer mon abonnement'}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <span style={{ display: 'inline-block', background: 'rgba(196,168,130,0.07)', border: '1px solid rgba(196,168,130,0.2)', borderRadius: 8, padding: '5px 14px', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#C4A882', letterSpacing: '0.08em' }}>
                    AUCUN PLAN ACTIF
                  </span>
                  <p style={{ fontSize: 13, color: '#6A6158', marginTop: 10 }}>Débloquez votre rapport complet pour accéder à toutes les données de marché.</p>
                </div>
                <a href="/#pricing" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 9, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  Voir les offres
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Section 2 — Reports */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540', letterSpacing: '0.14em', marginBottom: 16 }}>HISTORIQUE DES RAPPORTS</div>
          <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 14, overflow: 'hidden' }}>
            {loadingReports ? (
              <div style={{ padding: '32px 28px', color: '#2A2A2A', fontSize: 13 }}>Chargement…</div>
            ) : reports.length === 0 ? (
              <div style={{ padding: '40px 28px', textAlign: 'center' }}>
                <p style={{ color: '#4A4540', fontSize: 14, marginBottom: 16 }}>Vous n'avez encore lancé aucune analyse.</p>
                <a href="/#analyse" style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: '#C4A882', textDecoration: 'none', letterSpacing: '0.08em' }}>
                  Lancer ma première analyse →
                </a>
              </div>
            ) : (
              <>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 120px', gap: 12, padding: '12px 24px', borderBottom: '1px solid #1A1A1A' }}>
                  {['Zone', 'Ch.', 'Verdict', 'Date', ''].map((h, i) => (
                    <div key={i} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#3A3530', letterSpacing: '0.12em' }}>{h}</div>
                  ))}
                </div>
                {reports.map((r, i) => (
                  <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px 120px', gap: 12, padding: '14px 24px', borderBottom: i < reports.length - 1 ? '1px solid #161616' : 'none', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#D4C8BC' }}>{r.zone ?? '—'}</div>
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: '#6A6158' }}>{r.bedrooms != null ? `${r.bedrooms} ch.` : '—'}</div>
                    <div><VerdictBadge verdict={r.verdict} /></div>
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#4A4540' }}>{formatDate(r.created_at)}</div>
                    <div>
                      <button
                        onClick={handleDownloadPDF}
                        style={{ background: 'none', border: '1px solid #2A2A2A', borderRadius: 6, padding: '5px 12px', color: '#6A6158', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-dm-mono)' }}
                      >
                        PDF
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Section 3 — New analysis CTA */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <a
            href="/#analyse"
            style={{ display: 'inline-block', padding: '14px 36px', borderRadius: 10, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 14, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.02em' }}
          >
            Lancer une nouvelle analyse →
          </a>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
