'use client'

import { useEffect, useState } from 'react'

type Report = {
  id: string; zone: string | null; bedrooms: number | null
  verdict: string | null; project_type: string | null; price_announced: number | null; created_at: string
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

const COL = '2fr 100px 100px 110px 80px'

export default function AnalysesPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => {
      setReports(d.reports ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div style={{ padding: '48px 48px', fontFamily: 'var(--font-outfit)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 4 }}>Mes analyses</h1>
          <p style={{ fontSize: 13, color: '#6A6158' }}>{loading ? '…' : `${reports.length} rapport${reports.length !== 1 ? 's' : ''}`}</p>
        </div>
        <a href="/dashboard/nouvelle-analyse" style={{ display: 'inline-block', padding: '10px 22px', borderRadius: 9, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
          + Nouvelle analyse
        </a>
      </div>

      {loading ? (
        <div style={{ color: '#2A2A2A', fontSize: 13 }}>Chargement…</div>
      ) : reports.length === 0 ? (
        <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📋</div>
          <p style={{ fontSize: 14, color: '#6A6158', marginBottom: 24 }}>Aucune analyse pour l&apos;instant.</p>
          <a href="/dashboard/nouvelle-analyse" style={{ display: 'inline-block', padding: '11px 26px', borderRadius: 9, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Lancer ma première analyse →
          </a>
        </div>
      ) : (
        <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: COL, gap: 12, padding: '12px 24px', borderBottom: '1px solid #1A1A1A' }}>
            {['Bien', 'Verdict', 'Prix/nuit', 'Date', ''].map((h, i) => (
              <div key={i} style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#3A3530', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {reports.map((r, i) => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: COL, gap: 12, padding: '14px 24px', borderBottom: i < reports.length - 1 ? '1px solid #161616' : 'none', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: '#D4C8BC', fontWeight: 500 }}>
                  {r.project_type ?? 'Villa'} {r.bedrooms ? `${r.bedrooms} ch.` : ''} — {r.zone ?? 'GPS'}
                </div>
              </div>
              <div><VerdictBadge verdict={r.verdict} /></div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: '#6A6158' }}>
                {r.price_announced ? `$${Math.round(r.price_announced).toLocaleString('en-US')}` : '—'}
              </div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#4A4540' }}>{fmtDate(r.created_at)}</div>
              <div>
                <a href={`/rapport/${r.id}`} style={{ display: 'inline-block', background: 'none', border: '1px solid #2A2A2A', borderRadius: 6, padding: '5px 12px', color: '#C4A882', fontSize: 11, textDecoration: 'none', fontFamily: 'var(--font-dm-mono)' }}>
                  Voir →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
