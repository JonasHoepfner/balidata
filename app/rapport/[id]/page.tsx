'use client'

import { useEffect, useState, useCallback, use } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type ReportContent = {
  market_context?: string
  pricing?: string
  positioning?: string
  optimization?: string
}

type Report = {
  id: string
  zone: string | null
  bedrooms: number | null
  verdict: string | null
  project_type: string | null
  price_announced: number | null
  developer_price: number | null
  price_median: number | null
  price_p25: number | null
  price_p75: number | null
  price_avg: number | null
  listings_count: number | null
  est_monthly_revenue: number | null
  avg_reviews: number | null
  variance_pct: number | null
  created_at: string
  report_content: ReportContent | null
}

type ZoneStats = {
  zone: string | null
  bedrooms: number | null
  price_median: number | null
  price_p25: number | null
  price_p75: number | null
  price_avg: number | null
  est_monthly_revenue: number | null
  avg_reviews: number | null
  listings_count: number | null
  high_activity_pct: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US')

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

function clamp(v: number, min = 0, max = 10) { return Math.max(min, Math.min(max, v)) }

function computeScores(report: Report, zoneStats: ZoneStats | null, badungMedian: number | null) {
  const priceMedian = report.price_median ?? zoneStats?.price_median ?? 0
  const priceP25    = report.price_p25   ?? zoneStats?.price_p25   ?? 0
  const priceP75    = report.price_p75   ?? zoneStats?.price_p75   ?? 1
  const announced   = report.price_announced ?? priceMedian

  // Score Localisation: zone median vs Badung median, normalised 0-10
  const bMedian = badungMedian ?? priceMedian
  const locScore = bMedian > 0 ? clamp((priceMedian / bMedian) * 5) : 5

  // Score Demande: high_activity_pct / 10 (capped at 10)
  const demScore = clamp((zoneStats?.high_activity_pct ?? 60) / 10)

  // Score Compétitivité prix: 10 at P25, 5 at médiane, 0 at P75
  let prixScore: number
  if (announced <= priceP25) {
    prixScore = 10
  } else if (announced >= priceP75) {
    prixScore = 0
  } else if (announced <= priceMedian) {
    // Between P25 and médiane → interpolate 10 to 5
    prixScore = 5 + 5 * (1 - (announced - priceP25) / (priceMedian - priceP25 || 1))
  } else {
    // Between médiane and P75 → interpolate 5 to 0
    prixScore = 5 * (1 - (announced - priceMedian) / (priceP75 - priceMedian || 1))
  }
  prixScore = clamp(prixScore)

  // Score Standing: avg_reviews / 100 * 10
  const avgR = report.avg_reviews ?? zoneStats?.avg_reviews ?? 0
  const standScore = clamp(avgR / 100 * 10)

  // Score Potentiel locatif: est_monthly_revenue vs Badung median revenue
  const estRev = report.est_monthly_revenue ?? zoneStats?.est_monthly_revenue ?? 0
  const bRev = bMedian * 30 * 0.65 // rough Badung reference
  const potScore = bRev > 0 ? clamp((estRev / bRev) * 5) : 5

  // Global
  const globalRaw = locScore * 0.25 + demScore * 0.20 + prixScore * 0.20 + standScore * 0.15 + potScore * 0.20
  const global = Math.round(globalRaw * 10)

  return {
    localisation: Math.round(locScore * 10) / 10,
    demande:      Math.round(demScore * 10) / 10,
    prix:         Math.round(prixScore * 10) / 10,
    standing:     Math.round(standScore * 10) / 10,
    potentiel:    Math.round(potScore * 10) / 10,
    global,
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

const VERDICT_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  realiste:  { label: 'RÉALISTE',  color: '#4ADE80', bg: 'rgba(74,222,128,0.08)',  border: 'rgba(74,222,128,0.25)'  },
  optimiste: { label: 'OPTIMISTE', color: '#FB923C', bg: 'rgba(251,146,60,0.08)',  border: 'rgba(251,146,60,0.25)'  },
  survendu:  { label: 'SURVENDU',  color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.25)' },
  no_data:   { label: 'NO DATA',   color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.25)' },
}

function VerdictBadge({ verdict }: { verdict: string | null }) {
  const cfg = VERDICT_CFG[verdict?.toLowerCase() ?? ''] ?? VERDICT_CFG.no_data
  return (
    <span style={{ display: 'inline-block', background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '4px 12px', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: cfg.color, letterSpacing: '0.1em' }}>
      {cfg.label}
    </span>
  )
}

function ScoreBar({ label, value, max = 10 }: { label: string; value: number; max?: number }) {
  const pct = (value / max) * 100
  const color = pct >= 70 ? '#4ADE80' : pct >= 40 ? '#FB923C' : '#F87171'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C4C0BB' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color }}>
          {value.toFixed(1)}/{max}
        </span>
      </div>
      <div style={{ height: 5, background: '#1A1A1A', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%', borderRadius: 3,
            background: color,
            width: `${pct}%`,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
    </div>
  )
}

function SectionTitle({ label, title }: { label: string; title: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 26, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.01em', lineHeight: 1.15 }}>{title}</h2>
    </div>
  )
}

function Card({ children, gold }: { children: React.ReactNode; gold?: boolean }) {
  return (
    <div style={{
      background: '#111111',
      border: gold ? '1px solid rgba(196,168,130,0.3)' : '1px solid #1E1E1E',
      borderRadius: 10,
      padding: '18px 20px',
    }}>
      {children}
    </div>
  )
}

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <Card gold={highlight}>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: highlight ? 28 : 22, color: highlight ? '#C4A882' : '#F0EAE2', lineHeight: 1.1, marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#4A4540' }}>{sub}</div>}
    </Card>
  )
}

function RecoCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <Card>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, fontWeight: 600, color: '#C4A882', marginBottom: 6 }}>{title}</div>
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#7A7168', lineHeight: 1.65 }}>{body}</div>
        </div>
      </div>
    </Card>
  )
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 20px', fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C4A882', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {message}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function RapportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [zoneStats, setZoneStats] = useState<ZoneStats | null>(null)
  const [badungMedian, setBadungMedian] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingReco, setGeneratingReco] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadReport = useCallback(async () => {
    try {
      const res = await fetch(`/api/reports/${id}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Rapport introuvable')
        setLoading(false)
        return
      }
      const data = await res.json()
      setReport(data.report)
      setZoneStats(data.zoneStats ?? null)
      setBadungMedian(data.badungMedian ?? null)
      setLoading(false)

      // If no report_content, generate via Claude
      if (!data.report?.report_content) {
        const scores = computeScores(data.report, data.zoneStats ?? null, data.badungMedian ?? null)
        setGeneratingReco(true)
        const genRes = await fetch(`/api/reports/${id}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ globalScore: scores.global }),
        })
        if (genRes.ok) {
          const genData = await genRes.json()
          setReport(prev => prev ? { ...prev, report_content: genData.content } : prev)
        }
        setGeneratingReco(false)
      }
    } catch {
      setError('Erreur lors du chargement du rapport')
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadReport() }, [loadReport])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: '#C4A882', letterSpacing: '0.1em', marginBottom: 16, animation: 'pulse 2s infinite' }}>
            Génération de votre rapport…
          </div>
          <div style={{ width: 32, height: 32, border: '2px solid #2A2A2A', borderTop: '2px solid #C4A882', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, color: '#F87171', marginBottom: 12 }}>Rapport introuvable</div>
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, color: '#6A6158', marginBottom: 24 }}>{error}</div>
          <a href="/dashboard" style={{ color: '#C4A882', fontFamily: 'var(--font-dm-mono)', fontSize: 12 }}>← Dashboard</a>
        </div>
      </div>
    )
  }

  const scores = computeScores(report, zoneStats, badungMedian)
  const verdict = VERDICT_CFG[report.verdict?.toLowerCase() ?? ''] ?? VERDICT_CFG.no_data

  const priceMedian = report.price_median ?? 0
  const priceP25    = report.price_p25    ?? 0
  const priceP75    = report.price_p75    ?? 0
  const announced   = report.price_announced ?? priceMedian

  // Recommended price
  const priceRec =
    report.verdict === 'survendu'  ? Math.round(priceMedian * 0.95) :
    report.verdict === 'realiste'  ? Math.round(announced) :
    Math.round(priceMedian * 1.05)

  // Positioning bar
  const barRange = (priceP75 - priceP25) || 1
  const positionPct = priceP25 > 0
    ? Math.min(100, Math.max(0, ((announced - priceP25) / barRange) * 100))
    : 50

  // Projections
  const projections = [
    {
      label: 'Conservateur',
      occ: 0.50,
      price: Math.round(announced * 0.90),
      color: '#6A6158',
    },
    {
      label: 'Réaliste',
      occ: 0.65,
      price: Math.round(priceMedian),
      color: '#C4A882',
    },
    {
      label: 'Optimisé',
      occ: 0.78,
      price: priceRec,
      color: '#4ADE80',
    },
  ].map(p => {
    const monthly = Math.round(p.price * 30 * p.occ)
    const annual = Math.round(monthly * 12)
    const net = Math.round(annual * 0.67) // after 33% charges
    const roi = report.developer_price ? ((net / report.developer_price) * 100).toFixed(1) : null
    return { ...p, monthly, annual, net, roi }
  })

  const propertyName = `${report.project_type ?? 'Villa'} ${report.bedrooms ?? '?'} ch. — ${report.zone ?? 'GPS'}`

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A' }}>

      {/* Fixed nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 56, borderBottom: '1px solid #1A1A1A', background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882', letterSpacing: '0.12em' }}>BALIDATA</span>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setToast('Export PDF bientôt disponible.')}
            style={{ background: 'linear-gradient(135deg, #C4A882, #8B6F47)', border: 'none', borderRadius: 7, padding: '7px 16px', color: '#0A0A0A', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-outfit)', cursor: 'pointer' }}
          >
            Télécharger PDF
          </button>
          <a href="/dashboard" style={{ background: 'none', border: '1px solid #2A2A2A', borderRadius: 7, padding: '7px 16px', color: '#6A6158', fontSize: 12, fontFamily: 'var(--font-outfit)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            ← Dashboard
          </a>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '80px 24px 80px' }}>

        {/* ── Section 1: Identité ── */}
        <div style={{ paddingTop: 16, marginBottom: 40, borderBottom: '1px solid #1A1A1A', paddingBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>
            Rapport · {fmtDate(report.created_at)}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 12 }}>
                {propertyName}
              </h1>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <VerdictBadge verdict={report.verdict} />
                {report.zone && (
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540', letterSpacing: '0.08em' }}>{report.zone.toUpperCase()}</span>
                )}
                {report.bedrooms && (
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540' }}>{report.bedrooms} CHAMBRES</span>
                )}
              </div>
            </div>
            {/* Global score big */}
            <div style={{ textAlign: 'center', background: '#111', border: '1px solid rgba(196,168,130,0.25)', borderRadius: 12, padding: '16px 24px', minWidth: 100 }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 6 }}>SCORE</div>
              <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 48, fontWeight: 700, color: '#C4A882', lineHeight: 1 }}>{scores.global}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', marginTop: 4 }}>/100</div>
            </div>
          </div>
        </div>

        {/* ── Section 2: KPIs ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle label="Indicateurs" title="KPIs principaux" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <KpiCard label="Score global" value={`${scores.global}/100`} sub="Performance combinée" highlight />
            <KpiCard label="Positionnement marché" value={verdict.label} sub={`${report.variance_pct != null ? (report.variance_pct > 0 ? '+' : '') + report.variance_pct.toFixed(1) + '% vs médiane' : '—'}`} />
            <KpiCard label="Prix annoncé" value={fmt(report.price_announced)} sub="par nuit · utilisateur" />
            <KpiCard label="Prix médian marché" value={fmt(priceMedian)} sub={`${report.zone ?? 'Zone'} · ${report.listings_count ?? '—'} comparables`} />
            <KpiCard label="Prix recommandé" value={fmt(priceRec)} sub={report.verdict === 'survendu' ? 'Alignement -5%' : report.verdict === 'realiste' ? 'Prix actuel optimal' : 'Potentiel +5%'} />
            <KpiCard label="Revenu mensuel estimé" value={fmt(report.est_monthly_revenue ?? zoneStats?.est_monthly_revenue)} sub="base 65% occupation" />
          </div>
        </div>

        {/* ── Section 3: Positionnement prix ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle label="Analyse" title="Positionnement sur le marché" />
          <Card>
            <div style={{ position: 'relative', marginBottom: 24 }}>
              {/* Gradient bar */}
              <div style={{ height: 10, borderRadius: 5, background: 'linear-gradient(90deg, #4ADE80 0%, #FB923C 55%, #F87171 100%)', position: 'relative', marginBottom: 24 }}>
                {/* Markers */}
                {[
                  { pct: 0,   label: 'P25',    val: fmt(priceP25),    above: true },
                  { pct: 50,  label: 'Médiane', val: fmt(priceMedian), above: false },
                  { pct: 100, label: 'P75',    val: fmt(priceP75),    above: true },
                ].map(m => (
                  <div key={m.label} style={{ position: 'absolute', left: `${m.pct}%`, top: '50%', transform: 'translate(-50%,-50%)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A1A1A', border: '2px solid #555' }} />
                  </div>
                ))}
                {/* User position */}
                <div style={{ position: 'absolute', top: '50%', left: `${positionPct}%`, transform: 'translate(-50%, -50%)', width: 18, height: 18, borderRadius: '50%', background: '#C4A882', border: '2.5px solid #0A0A0A', boxShadow: '0 0 0 3px rgba(196,168,130,0.3)', zIndex: 2 }} />
              </div>
              {/* Labels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', fontSize: 9, fontFamily: 'var(--font-dm-mono)', color: '#4A4540' }}>
                <div>
                  <div style={{ color: '#6A6158' }}>P25 · Bas du marché</div>
                  <div style={{ color: '#D4C8BC', marginTop: 2 }}>{fmt(priceP25)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#6A6158' }}>Médiane</div>
                  <div style={{ color: '#D4C8BC', marginTop: 2 }}>{fmt(priceMedian)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#6A6158' }}>P75 · Haut de gamme</div>
                  <div style={{ color: '#D4C8BC', marginTop: 2 }}>{fmt(priceP75)}</div>
                </div>
              </div>
            </div>
            <div style={{ background: '#0A0A0A', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#C4A882', flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#6A6158' }}>
                Votre bien à <strong style={{ color: '#C4A882' }}>{fmt(announced)}/nuit</strong> se positionne à {positionPct.toFixed(0)}% de la fourchette de marché.
              </span>
            </div>
          </Card>
        </div>

        {/* ── Section 4: Analyse marché ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle label="Marché" title="Analyse de la zone" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Zone', report.zone ?? '—'],
                  ['Comparables', String(report.listings_count ?? '—')],
                  ['Prix moyen', fmt(report.price_avg)],
                  ['Avis moyens', report.avg_reviews != null ? report.avg_reviews.toFixed(1) : '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#3A3530', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: '#D4C8BC' }}>{value}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>CONTEXTE MARCHÉ</div>
              {generatingReco ? (
                <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#3A3530' }}>Génération en cours…</div>
              ) : (
                <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#7A7168', lineHeight: 1.7, margin: 0 }}>
                  {report.report_content?.market_context ?? 'Analyse de marché disponible après génération.'}
                </p>
              )}
            </Card>
          </div>
        </div>

        {/* ── Section 5: Scoring ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle label="Performance" title="Scoring du bien" />
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 40px' }}>
              <div>
                <ScoreBar label="Localisation"           value={scores.localisation} />
                <ScoreBar label="Demande de la zone"     value={scores.demande} />
                <ScoreBar label="Compétitivité prix"     value={scores.prix} />
              </div>
              <div>
                <ScoreBar label="Standing (avis)"        value={scores.standing} />
                <ScoreBar label="Potentiel locatif"      value={scores.potentiel} />
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #1A1A1A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C4C0BB', fontWeight: 600 }}>Score global</span>
                  <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 700, color: '#C4A882' }}>{scores.global}<span style={{ fontSize: 16, color: '#4A4540' }}>/100</span></span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Section 6: Recommandations ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle label="Intelligence" title="Recommandations" />
          {generatingReco ? (
            <Card>
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#C4A882', letterSpacing: '0.08em', marginBottom: 12 }}>Génération des recommandations…</div>
                <div style={{ width: 24, height: 24, border: '2px solid #2A2A2A', borderTop: '2px solid #C4A882', borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <RecoCard icon="💰" title="Recommandation Tarification"
                body={report.report_content?.pricing ?? 'Recommandation disponible après génération.'} />
              <RecoCard icon="🎯" title="Positionnement"
                body={report.report_content?.positioning ?? 'Recommandation disponible après génération.'} />
              <RecoCard icon="⚡" title="Optimisation du bien"
                body={report.report_content?.optimization ?? 'Recommandation disponible après génération.'} />
            </div>
          )}
        </div>

        {/* ── Section 7: Projections ── */}
        <div style={{ marginBottom: 40 }}>
          <SectionTitle label="Projections" title="Scénarios de rendement" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {projections.map(p => (
              <div key={p.label} style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '20px 18px' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: p.color, marginBottom: 14 }}>{p.label}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    ['Prix / nuit',        fmt(p.price)],
                    ['Taux occupation',     `${Math.round(p.occ * 100)}%`],
                    ['Revenu mensuel',      fmt(p.monthly)],
                    ['Revenu annuel net',   fmt(p.net)],
                    ...(p.roi ? [['ROI net', `${p.roi}%`]] : []),
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#3A3530', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: '#E8E0D4' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
