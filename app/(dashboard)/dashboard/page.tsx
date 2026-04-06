'use client'

import { useEffect, useState } from 'react'

type Me = {
  loggedIn: boolean; isPaid: boolean; isAdmin: boolean; plan: string | null
  email: string | null; firstName: string | null; planCreatedAt: string | null
}

type Report = {
  id: string; zone: string | null; bedrooms: number | null
  verdict: string | null; project_type: string | null; created_at: string
}

const VERDICT_CFG: Record<string, { color: string; bg: string; label: string }> = {
  realiste:  { color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',  label: 'Réaliste'  },
  optimiste: { color: '#FB923C', bg: 'rgba(251,146,60,0.08)',  label: 'Optimiste' },
  survendu:  { color: '#F87171', bg: 'rgba(248,113,113,0.08)', label: 'Survendu'  },
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  const cfg = VERDICT_CFG[verdict?.toLowerCase() ?? '']
  if (!cfg) return <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540' }}>—</span>
  return (
    <span style={{ display: 'inline-block', background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 6, padding: '3px 10px', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: cfg.color, letterSpacing: '0.06em' }}>
      {cfg.label}
    </span>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '20px 22px' }}>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 22, color: '#F0EAE2', lineHeight: 1.1, marginBottom: sub ? 4 : 0 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#4A4540' }}>{sub}</div>}
    </div>
  )
}

export default function DashboardHome() {
  const [me, setMe] = useState<Me | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/me').then(r => r.json()),
      fetch('/api/reports').then(r => r.json()),
    ]).then(([meData, reportsData]) => {
      setMe(meData)
      setReports(reportsData.reports ?? [])
      setLoading(false)
    })
  }, [])

  const latest = reports[0] ?? null

  const planLabel = me?.plan === 'monthly' ? 'INVESTISSEUR' : me?.plan === 'once' ? 'RAPPORT UNIQUE' : null

  return (
    <div style={{ padding: '48px 48px', fontFamily: 'var(--font-outfit)' }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 36, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Bonjour {me?.firstName ?? ''}
        </h1>
        <p style={{ fontSize: 14, color: '#6A6158' }}>Voici un aperçu de votre activité.</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
        <StatCard
          label="Analyses réalisées"
          value={loading ? '…' : String(reports.length)}
          sub="rapports générés"
        />
        <StatCard
          label="Dernière analyse"
          value={loading ? '…' : latest ? (latest.zone ?? 'GPS') : '—'}
          sub={latest ? fmtDate(latest.created_at) : 'Aucune analyse'}
        />
        <StatCard
          label="Plan actif"
          value={
            loading ? '…' :
            planLabel ? (
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#4ADE80' }}>{planLabel}</span>
            ) : (
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882' }}>AUCUN</span>
            )
          }
          sub={me?.planCreatedAt ? `Depuis ${fmtDate(me.planCreatedAt)}` : undefined}
        />
      </div>

      {/* Latest report / empty state */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>DERNIÈRE ANALYSE</div>

        {loading ? (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '28px 24px', color: '#2A2A2A', fontSize: 13 }}>Chargement…</div>
        ) : !latest ? (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>📊</div>
            <p style={{ fontSize: 14, color: '#6A6158', marginBottom: 24, lineHeight: 1.7 }}>
              Lancez votre première analyse pour obtenir<br />votre rapport de marché Bali.
            </p>
            <a href="/dashboard/nouvelle-analyse" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: 9, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Nouvelle analyse →
            </a>
          </div>
        ) : (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 16, fontWeight: 600, color: '#D4C8BC', marginBottom: 8 }}>
                {latest.project_type ?? 'Villa'} {latest.bedrooms ? `${latest.bedrooms} ch.` : ''} — {latest.zone ?? 'GPS'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <VerdictBadge verdict={latest.verdict} />
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540' }}>{fmtDate(latest.created_at)}</span>
              </div>
            </div>
            <a href={`/rapport/${latest.id}`} style={{ flexShrink: 0, padding: '10px 22px', borderRadius: 8, background: 'rgba(196,168,130,0.08)', border: '1px solid rgba(196,168,130,0.25)', color: '#C4A882', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Voir le rapport →
            </a>
          </div>
        )}
      </div>

      {/* Quick action */}
      <a href="/dashboard/nouvelle-analyse" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 9, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
        + Nouvelle analyse
      </a>
    </div>
  )
}
