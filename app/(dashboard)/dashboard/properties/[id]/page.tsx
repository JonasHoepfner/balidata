'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const PropertyModal = dynamic(() => import('@/components/PropertyModal'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────────────────

type Scores = { localisation: number; demande: number; prix: number; standing: number; potentiel: number }

type Comparable = {
  title: string
  price_per_night_usd: number
  bedrooms: number | null
  airbnb_url: string | null
  distance_km: number | null
}

type Metrics = {
  priceMedian: number; priceP25: number; priceP75: number
  reviewsAvg: number; listingsCount: number; estMonthlyRevenue: number
  variancePct: number | null; score: number | null; estOccupancy: number
  scores: Scores; comparables: Comparable[]
}

type Recommendations = {
  market_context: string; pricing: string; positioning: string; optimization: string
}

type Property = {
  id: string; title: string; zone: string | null; address: string | null
  property_type: string | null; bedrooms: number | null
  current_price_night: number | null; recommended_price: number | null
  current_score: number | null; last_snapshot_at: string | null
  acquisition_price: number | null; lease_type: string | null; lease_duration: number | null
  latitude: number | null; longitude: number | null
  weekly_alerts: boolean; last_recommendations: Recommendations | null
  images: string[] | null; created_at: string
}

type Snapshot = {
  id: string; price_median: number; price_p25: number; price_p75: number
  variance_pct: number | null; score: number | null; est_monthly_revenue: number
  recommended_price: number | null; listings_count: number; created_at: string
}

type Alert = {
  id: string; alert_type: string; title: string; message: string; created_at: string
}

type Action = {
  id: string; action_type: string; old_value: number | null; new_value: number | null
  note: string | null; created_at: string
}

// ── Helpers & constants ────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return '#4ADE80'
  if (s >= 50) return '#FB923C'
  return '#F87171'
}

function scoreLabel(s: number) {
  if (s >= 80) return 'Excellent positioning — your price is well-calibrated'
  if (s >= 70) return 'Good positioning'
  if (s >= 50) return 'Average positioning — room for improvement'
  return 'Below market average — action recommended'
}

const ALERT_ICONS: Record<string, string> = {
  new_competitor:    '🏠',
  price_opportunity: '💰',
  high_season:       '🌊',
  market_movement:   '📈',
}

const ACTION_LABELS: Record<string, string> = {
  price_change: 'Price change',
  note:         'Note',
  snapshot:     'Metrics update',
}

const ACTION_COLORS: Record<string, string> = {
  price_change: '#C4A882',
  note:         '#60A5FA',
  snapshot:     '#4ADE80',
}

const BALI_SEASONALITY = [
  { month: 'Jan', index: 0.72 }, { month: 'Feb', index: 0.62 },
  { month: 'Mar', index: 0.65 }, { month: 'Apr', index: 0.60 },
  { month: 'May', index: 0.70 }, { month: 'Jun', index: 0.78 },
  { month: 'Jul', index: 0.92 }, { month: 'Aug', index: 0.95 },
  { month: 'Sep', index: 0.80 }, { month: 'Oct', index: 0.72 },
  { month: 'Nov', index: 0.65 }, { month: 'Dec', index: 0.85 },
]

// ── Sub-components ─────────────────────────────────────────────────────────

const mono: React.CSSProperties = { fontFamily: 'var(--font-dm-mono)' }
const outfit: React.CSSProperties = { fontFamily: 'var(--font-outfit)' }
const cormorant: React.CSSProperties = { fontFamily: 'var(--font-cormorant)' }

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ ...mono, fontSize: 9, color: '#4A4540', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>{children}</div>
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: '20px 24px', ...style }}>{children}</div>
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ ...outfit, fontSize: 12, color: '#9A9188' }}>{label}</span>
        <span style={{ ...mono, fontSize: 11, color: '#C4A882' }}>{value.toFixed(1)}/10</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: '#1A1A1A' }}>
        <div style={{ height: '100%', width: `${value * 10}%`, background: '#C4A882', borderRadius: 2 }} />
      </div>
    </div>
  )
}

function PricePositionBar({ price, p25, med, p75 }: { price: number; p25: number; med: number; p75: number }) {
  const lo  = Math.max(0, p25 * 0.8)
  const hi  = p75 * 1.2
  const rng = hi - lo || 1
  const pct = (v: number) => Math.max(2, Math.min(98, ((v - lo) / rng) * 100))
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(to right, #4CAF50, #FDD835, #FF9800, #e53935)', marginBottom: 24 }}>
        <div style={{ position: 'absolute', top: '50%', left: `${pct(price)}%`, transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: '#C4A882', border: '2px solid #0A0A0A', zIndex: 2 }} />
        {[{ v: p25, l: `P25 $${p25}` }, { v: med, l: `Median $${med}` }, { v: p75, l: `P75 $${p75}` }].map(({ v, l }) => (
          <div key={l} style={{ position: 'absolute', bottom: -20, left: `${pct(v)}%`, transform: 'translateX(-50%)', ...mono, fontSize: 8, color: '#4A4540', whiteSpace: 'nowrap' }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

function RecoCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ background: '#0A0A0A', border: '1px solid #1E1E1E', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={{ ...outfit, fontSize: 13, fontWeight: 600, color: '#C4A882', marginBottom: 6 }}>{title}</div>
          <div style={{ ...outfit, fontSize: 13, color: '#7A7168', lineHeight: 1.65 }}>{body}</div>
        </div>
      </div>
    </div>
  )
}

function ScoreLineChart({ snapshots }: { snapshots: Snapshot[] }) {
  if (snapshots.length < 2) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', ...mono, fontSize: 10, color: '#3A3530', lineHeight: 1.8 }}>
        Historical data will appear after your first weekly update.
      </div>
    )
  }
  const W = 600, H = 180
  const pad = { top: 16, right: 80, bottom: 32, left: 28 }
  const iW  = W - pad.left - pad.right
  const iH  = H - pad.top  - pad.bottom
  const n   = snapshots.length
  const maxPrice = Math.max(...snapshots.map(s => s.price_median ?? 0), 1)
  const normP    = (v: number) => (v / maxPrice) * 100
  const xOf = (i: number) => pad.left + (n === 1 ? iW / 2 : (i / (n - 1)) * iW)
  const yOf = (v: number) => pad.top + iH - (Math.min(100, Math.max(0, v)) / 100) * iH
  const scorePath = snapshots.map((s, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(s.score ?? 0).toFixed(1)}`).join(' ')
  const medPath   = snapshots.map((s, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(normP(s.price_median ?? 0)).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 180, overflow: 'visible' }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={pad.left} y1={yOf(v)} x2={W - pad.right} y2={yOf(v)} stroke="#1A1A1A" strokeWidth="0.5" />
          <text x={pad.left - 4} y={yOf(v) + 3} textAnchor="end" fontSize="7" fill="#3A3530" fontFamily="monospace">{v}</text>
        </g>
      ))}
      {snapshots.map((s, i) => (
        <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize="7" fill="#3A3530" fontFamily="monospace">
          {new Date(s.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}
        </text>
      ))}
      {/* Market median line (gray dashed) */}
      <path d={medPath} fill="none" stroke="#2A2A2A" strokeWidth="1.5" strokeDasharray="5 4" />
      {/* Score line (gold) */}
      <path d={scorePath} fill="none" stroke="#C4A882" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {snapshots.map((s, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(s.score ?? 0)} r="3" fill="#C4A882" />
      ))}
      {/* Legend */}
      <line x1={W - 76} y1={12} x2={W - 62} y2={12} stroke="#C4A882" strokeWidth="2" />
      <text x={W - 58} y={15} fontSize="7" fill="#C4A882" fontFamily="monospace">Score /100</text>
      <line x1={W - 76} y1={24} x2={W - 62} y2={24} stroke="#2A2A2A" strokeWidth="1.5" strokeDasharray="5 4" />
      <text x={W - 58} y={27} fontSize="7" fill="#3A3530" fontFamily="monospace">Mkt price</text>
    </svg>
  )
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 20px', ...outfit, fontSize: 13, color: '#C4A882', zIndex: 2000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {message}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [property,     setProperty]     = useState<Property | null>(null)
  const [metrics,      setMetrics]      = useState<Metrics | null>(null)
  const [snapshots,    setSnapshots]    = useState<Snapshot[]>([])
  const [alerts,       setAlerts]       = useState<Alert[]>([])
  const [actions,      setActions]      = useState<Action[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showEdit,     setShowEdit]     = useState(false)
  const [showDelete,   setShowDelete]   = useState(false)
  const [deleting,     setDeleting]     = useState(false)
  const [snapshotting, setSnapshotting] = useState(false)
  const [genLoading,   setGenLoading]   = useState(false)
  const [applyingPrice, setApplyingPrice] = useState(false)
  const [weeklyAlerts, setWeeklyAlerts] = useState(true)
  const [alertsSaving, setAlertsSaving] = useState(false)
  const [noteInput,    setNoteInput]    = useState('')
  const [savingNote,   setSavingNote]   = useState(false)
  const [toast,        setToast]        = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg) }

  const load = useCallback(async () => {
    setLoading(true)
    const [propRes, snapRes, alertRes, actionRes] = await Promise.all([
      fetch(`/api/properties/${id}`),
      fetch(`/api/properties/${id}/snapshots`),
      fetch(`/api/properties/${id}/alerts`),
      fetch(`/api/properties/${id}/actions`),
    ])
    if (!propRes.ok) { router.push('/dashboard/properties'); return }
    const [propData, snapData, alertData, actionData] = await Promise.all([
      propRes.json(), snapRes.json(), alertRes.json(), actionRes.json(),
    ])
    setProperty(propData.property)
    setMetrics(propData.metrics ?? null)
    setWeeklyAlerts(propData.property?.weekly_alerts ?? true)
    setSnapshots(snapData.snapshots ?? [])
    setAlerts(alertData.alerts ?? [])
    setActions(actionData.actions ?? [])
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/properties/${id}`, { method: 'DELETE' })
    router.push('/dashboard/properties')
  }

  async function handleSnapshot() {
    setSnapshotting(true)
    const res = await fetch(`/api/properties/${id}/snapshot`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { showToast(`Error: ${data.error}`); setSnapshotting(false); return }
    await load()
    setSnapshotting(false)
    showToast(`Metrics updated — ${data.alerts_created} alert${data.alerts_created !== 1 ? 's' : ''} generated`)
  }

  async function handleApplyPrice() {
    if (!property?.recommended_price) return
    setApplyingPrice(true)
    await fetch(`/api/properties/${id}/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action_type: 'price_change',
        old_value:   property.current_price_night,
        new_value:   property.recommended_price,
      }),
    })
    await load()
    setApplyingPrice(false)
    showToast(`Price updated to $${property.recommended_price}/night`)
  }

  async function handleMarkRead(alertId: string) {
    await fetch(`/api/properties/${id}/alerts`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    })
    setAlerts(prev => prev.filter(a => a.id !== alertId))
  }

  async function handleGenerateRecos() {
    if (!property) return
    setGenLoading(true)
    console.log('[handleGenerateRecos] POST /api/properties/' + id + '/recommend', {
      priceMedian: metrics?.priceMedian,
      variancePct: metrics?.variancePct,
      score: metrics?.score,
    })
    const res = await fetch(`/api/properties/${id}/recommend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priceMedian: metrics?.priceMedian, variancePct: metrics?.variancePct, score: metrics?.score }),
    })
    const data = await res.json()
    console.log('[handleGenerateRecos] response status:', res.status, '— data:', data)
    if (res.ok && data.recommendations) {
      setProperty(p => p ? { ...p, last_recommendations: data.recommendations } : p)
      showToast('Recommendations generated')
    }
    setGenLoading(false)
  }

  async function handleSaveNote() {
    if (!noteInput.trim()) return
    setSavingNote(true)
    await fetch(`/api/properties/${id}/actions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action_type: 'note', note: noteInput.trim() }),
    })
    setNoteInput('')
    const res = await fetch(`/api/properties/${id}/actions`)
    const data = await res.json()
    setActions(data.actions ?? [])
    setSavingNote(false)
    showToast('Note saved')
  }

  async function handleSaveAlerts() {
    setAlertsSaving(true)
    await fetch(`/api/properties/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weekly_alerts: weeklyAlerts }),
    })
    showToast('Email preferences saved')
    setAlertsSaving(false)
  }

  if (loading || !property) {
    return (
      <div style={{ padding: '64px 48px', textAlign: 'center' }}>
        <div style={{ ...mono, fontSize: 11, color: '#4A4540', letterSpacing: '0.1em' }}>LOADING…</div>
      </div>
    )
  }

  const m             = metrics
  const recos         = property.last_recommendations
  const score         = m?.score ?? property.current_score ?? null
  const currentPrice  = Number(property.current_price_night ?? 0)
  const recPrice      = property.recommended_price
  const currentMonth  = new Date().getMonth()

  const needsSnapshot = !property.last_snapshot_at ||
    (Date.now() - new Date(property.last_snapshot_at).getTime() > 7 * 24 * 60 * 60 * 1000)

  return (
    <div style={{ padding: '40px 48px', maxWidth: 860 }}>

      {/* ── Gallery ─────────────────────────────────────────────────────────── */}
      {property.images && property.images.length > 0 && (
        <div style={{ marginBottom: 28, overflowX: 'auto', display: 'flex', gap: 10, paddingBottom: 4 }}>
          {property.images.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" style={{ width: 240, height: 180, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
          ))}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <button onClick={() => router.push('/dashboard/properties')} style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', ...outfit, marginBottom: 14, padding: 0 }}>
          ← My Properties
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {property.property_type && (
                <span style={{ ...mono, fontSize: 9, color: '#C4A882', letterSpacing: '0.1em', background: 'rgba(196,168,130,0.08)', border: '1px solid rgba(196,168,130,0.2)', borderRadius: 4, padding: '2px 7px' }}>
                  {property.property_type.toUpperCase()}
                </span>
              )}
              {property.bedrooms && (
                <span style={{ ...mono, fontSize: 9, color: '#555', background: '#161616', border: '1px solid #2A2A2A', borderRadius: 4, padding: '2px 7px' }}>
                  {property.bedrooms}BR
                </span>
              )}
            </div>
            <h1 style={{ ...cormorant, fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 4 }}>
              {property.title}
            </h1>
            {property.zone && <div style={{ ...mono, fontSize: 10, color: '#C4A882', letterSpacing: '0.08em' }}>{property.zone}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
            <button onClick={() => setShowEdit(true)} style={{ padding: '9px 20px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#C4A882', fontSize: 12, cursor: 'pointer', ...outfit }}>
              Edit
            </button>
            <button onClick={() => setShowDelete(true)} style={{ padding: '9px 20px', borderRadius: 50, border: '1px solid rgba(248,113,113,0.25)', background: 'transparent', color: '#F87171', fontSize: 12, cursor: 'pointer', ...outfit }}>
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* ── Update metrics bar ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0D0D0D', border: '1px solid #1E1E1E', borderRadius: 10, padding: '12px 18px', marginBottom: 20 }}>
        <div>
          <span style={{ ...mono, fontSize: 9, color: '#4A4540', letterSpacing: '0.1em' }}>LAST UPDATE — </span>
          <span style={{ ...mono, fontSize: 9, color: '#3A3530' }}>
            {property.last_snapshot_at
              ? new Date(property.last_snapshot_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'Never'}
          </span>
          {needsSnapshot && (
            <span style={{ ...mono, fontSize: 9, color: '#FB923C', marginLeft: 10 }}>— update recommended</span>
          )}
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          style={{ padding: '8px 18px', borderRadius: 50, border: 'none', cursor: snapshotting ? 'default' : 'pointer', background: snapshotting ? '#1A1A1A' : 'linear-gradient(135deg, #C4A882, #8B6F47)', color: snapshotting ? '#555' : '#0A0A0A', fontSize: 12, fontWeight: 700, ...outfit, transition: 'all 0.2s', flexShrink: 0 }}
        >
          {snapshotting ? 'Updating…' : '↺ Update metrics'}
        </button>
      </div>

      {/* ── Alerts banner ───────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div style={{ background: 'rgba(196,168,130,0.06)', border: '1px solid rgba(196,168,130,0.25)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>🔔</span>
            <span style={{ ...outfit, fontSize: 14, fontWeight: 600, color: '#C4A882' }}>
              {alerts.length} unread alert{alerts.length > 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ display: 'flex', gap: 10, flex: 1, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{ALERT_ICONS[a.alert_type] ?? '📌'}</span>
                  <div>
                    <div style={{ ...outfit, fontSize: 13, fontWeight: 600, color: '#C8BFB5', marginBottom: 2 }}>{a.title}</div>
                    <div style={{ ...outfit, fontSize: 12, color: '#7A7168', lineHeight: 1.55 }}>{a.message}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleMarkRead(a.id)}
                  style={{ padding: '5px 12px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#4A4540', fontSize: 10, cursor: 'pointer', ...mono, flexShrink: 0 }}
                >
                  Mark as read
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Score & Recommended Price ────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Performance score &amp; pricing recommendation</SectionLabel>
        <Card style={{ border: score != null ? `1px solid rgba(196,168,130,0.2)` : '1px solid #1E1E1E' }}>
          {score != null ? (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ ...cormorant, fontSize: 80, fontWeight: 700, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
              <div style={{ ...mono, fontSize: 9, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 8 }}>/100</div>
              <div style={{ ...outfit, fontSize: 13, color: scoreColor(score) }}>{scoreLabel(score)}</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0 24px', ...outfit, fontSize: 13, color: '#4A4540' }}>
              Set a current nightly rate to see your performance score.
            </div>
          )}

          {/* Score bars */}
          {m?.scores && (
            <div style={{ marginBottom: 24, padding: '0 8px' }}>
              <ScoreBar label="Localisation"       value={m.scores.localisation} />
              <ScoreBar label="Zone demand"        value={m.scores.demande} />
              <ScoreBar label="Price competitiveness" value={m.scores.prix} />
              <ScoreBar label="Standing (reviews)" value={m.scores.standing} />
              <ScoreBar label="Rental potential"   value={m.scores.potentiel} />
            </div>
          )}

          {/* Recommended price box */}
          {recPrice != null && recPrice !== currentPrice ? (
            <div style={{ background: 'rgba(196,168,130,0.06)', border: '1px solid rgba(196,168,130,0.25)', borderRadius: 10, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ ...mono, fontSize: 9, color: '#C4A882', letterSpacing: '0.12em', marginBottom: 8 }}>RECOMMENDED PRICE THIS WEEK</div>
              <div style={{ ...cormorant, fontSize: 44, fontWeight: 700, color: '#C4A882', lineHeight: 1, marginBottom: 4 }}>
                ${recPrice}<span style={{ fontSize: 18, color: '#7A7168' }}>/night</span>
              </div>
              {m?.listingsCount && (
                <div style={{ ...outfit, fontSize: 12, color: '#7A7168', marginBottom: 16 }}>
                  Based on {m.listingsCount} comparables in {property.zone ?? 'your zone'}.
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleApplyPrice}
                  disabled={applyingPrice}
                  style={{ flex: 1, padding: '11px', borderRadius: 50, border: 'none', cursor: applyingPrice ? 'default' : 'pointer', background: applyingPrice ? '#2A2A2A' : 'linear-gradient(135deg, #C4A882, #8B6F47)', color: applyingPrice ? '#555' : '#0A0A0A', fontSize: 13, fontWeight: 700, ...outfit }}
                >
                  {applyingPrice ? 'Applying…' : 'Apply this price →'}
                </button>
                <button
                  onClick={() => setProperty(p => p ? { ...p, recommended_price: currentPrice } : p)}
                  style={{ flex: 1, padding: '11px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#7A7168', fontSize: 13, cursor: 'pointer', ...outfit }}
                >
                  Ignore
                </button>
              </div>
            </div>
          ) : (
            recPrice == null && (
              <div style={{ background: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: 10, padding: '14px 16px', textAlign: 'center', ...outfit, fontSize: 12, color: '#4A4540' }}>
                Run &ldquo;Update metrics&rdquo; to get a pricing recommendation.
              </div>
            )
          )}
        </Card>
      </div>

      {/* ── Historical chart ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Score evolution — last {snapshots.length > 0 ? `${Math.min(snapshots.length, 12)} weeks` : 'snapshots'}</SectionLabel>
        <Card>
          <ScoreLineChart snapshots={snapshots} />
        </Card>
      </div>

      {/* ── Price positioning bar ─────────────────────────────────────────────── */}
      {m && currentPrice > 0 && (
        <div style={{ marginBottom: 28 }}>
          <SectionLabel>Price positioning</SectionLabel>
          <Card>
            <PricePositionBar price={currentPrice} p25={m.priceP25} med={m.priceMedian} p75={m.priceP75} />
          </Card>
        </div>
      )}

      {/* ── Metrics grid ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Detailed metrics</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Current price / night', value: currentPrice ? `$${currentPrice}` : '—' },
            { label: 'Market median',          value: m?.priceMedian ? `$${m.priceMedian}` : '—' },
            { label: 'Recommended price',      value: recPrice ? `$${recPrice}` : '—' },
            { label: 'Est. monthly revenue',   value: m?.estMonthlyRevenue ? `$${m.estMonthlyRevenue.toLocaleString()}` : '—' },
            { label: 'Est. occupancy',         value: m?.estOccupancy ? `${m.estOccupancy}%` : '—' },
            { label: 'Comparables analyzed',   value: m?.listingsCount ? String(m.listingsCount) : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#0A0A0A', border: '1px solid #1A1A1A', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ ...mono, fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 6 }}>{label.toUpperCase()}</div>
              <div style={{ ...mono, fontSize: 18, color: '#C4A882' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Claude recommendations ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <SectionLabel>AI recommendations</SectionLabel>
          <button
            onClick={handleGenerateRecos}
            disabled={genLoading}
            style={{ padding: '8px 16px', borderRadius: 50, border: '1px solid rgba(196,168,130,0.3)', background: 'transparent', color: genLoading ? '#555' : '#C4A882', fontSize: 11, cursor: genLoading ? 'default' : 'pointer', ...mono, letterSpacing: '0.06em' }}
          >
            {genLoading ? 'Generating…' : recos ? '↺ Refresh' : 'Generate recommendations'}
          </button>
        </div>
        {recos ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <RecoCard icon="💰" title="Pricing"       body={recos.pricing} />
            <RecoCard icon="🎯" title="Positioning"   body={recos.positioning} />
            <RecoCard icon="⚡" title="Optimization"  body={recos.optimization} />
          </div>
        ) : (
          <Card style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ ...outfit, fontSize: 13, color: '#4A4540', marginBottom: 4 }}>No recommendations yet.</div>
            <div style={{ ...outfit, fontSize: 12, color: '#3A3530' }}>Click &ldquo;Generate recommendations&rdquo; for personalized insights.</div>
          </Card>
        )}
      </div>

      {/* ── Seasonality ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Seasonal demand in your zone</SectionLabel>
        <Card>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 96 }}>
            {BALI_SEASONALITY.map((item, i) => {
              const color     = item.index >= 0.85 ? '#4ADE80' : item.index >= 0.70 ? '#FB923C' : '#3A3530'
              const isCurrent = i === currentMonth
              return (
                <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', background: '#0A0A0A', borderRadius: 3, position: 'relative', height: 72 }}>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${item.index * 100}%`,
                      background: color,
                      opacity: isCurrent ? 1 : 0.5,
                      borderRadius: '2px 2px 0 0',
                    }} />
                    {isCurrent && (
                      <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', ...mono, fontSize: 6, color: '#C4A882', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>NOW</div>
                    )}
                  </div>
                  <span style={{ ...mono, fontSize: 7, color: isCurrent ? '#C4A882' : '#4A4540', letterSpacing: '0.04em' }}>
                    {item.month.toUpperCase()}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ ...mono, fontSize: 8, color: '#3A3530', marginTop: 12, lineHeight: 1.6 }}>
            Based on current market data — historical seasonality will improve over time.
          </div>
        </Card>
      </div>

      {/* ── Actions journal ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Decision journal</SectionLabel>
        <Card>
          {/* Add note */}
          <div style={{ display: 'flex', gap: 8, marginBottom: actions.length > 0 ? 20 : 0 }}>
            <input
              type="text"
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveNote() }}
              placeholder="Add a note…"
              style={{ flex: 1, background: '#0A0A0A', border: '1px solid #232323', borderRadius: 7, padding: '9px 12px', color: '#E8E0D4', fontSize: 13, outline: 'none', ...outfit }}
            />
            <button
              onClick={handleSaveNote}
              disabled={savingNote || !noteInput.trim()}
              style={{ padding: '9px 18px', borderRadius: 7, border: 'none', cursor: (savingNote || !noteInput.trim()) ? 'default' : 'pointer', background: (savingNote || !noteInput.trim()) ? '#1A1A1A' : 'linear-gradient(135deg, #C4A882, #8B6F47)', color: (savingNote || !noteInput.trim()) ? '#555' : '#0A0A0A', fontSize: 12, fontWeight: 700, ...outfit }}
            >
              {savingNote ? 'Saving…' : 'Save note'}
            </button>
          </div>

          {/* Timeline */}
          {actions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {actions.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', gap: 14, paddingBottom: i < actions.length - 1 ? 16 : 0, borderBottom: i < actions.length - 1 ? '1px solid #161616' : 'none', paddingTop: i > 0 ? 16 : 0 }}>
                  <div style={{ width: 2, background: '#1A1A1A', borderRadius: 1, flexShrink: 0, alignSelf: 'stretch', marginTop: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ ...mono, fontSize: 9, color: '#3A3530' }}>
                        {new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span style={{ ...mono, fontSize: 8, color: ACTION_COLORS[a.action_type] ?? '#7A7168', background: `${ACTION_COLORS[a.action_type] ?? '#7A7168'}15`, border: `1px solid ${ACTION_COLORS[a.action_type] ?? '#7A7168'}30`, borderRadius: 4, padding: '1px 6px', letterSpacing: '0.06em' }}>
                        {ACTION_LABELS[a.action_type] ?? a.action_type}
                      </span>
                    </div>
                    {a.action_type === 'price_change' && a.old_value != null && a.new_value != null && (
                      <div style={{ ...outfit, fontSize: 13, color: '#9A9188' }}>
                        <span style={{ color: '#7A7168' }}>${a.old_value}</span>
                        <span style={{ color: '#3A3530', margin: '0 8px' }}>→</span>
                        <span style={{ color: '#C4A882' }}>${a.new_value}</span>
                        <span style={{ color: '#4A4540' }}>/night</span>
                      </div>
                    )}
                    {a.note && (
                      <div style={{ ...outfit, fontSize: 13, color: '#7A7168', lineHeight: 1.55 }}>{a.note}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {actions.length === 0 && (
            <div style={{ textAlign: 'center', ...outfit, fontSize: 12, color: '#3A3530', marginTop: 8 }}>
              No decisions recorded yet. Start by adding a note above.
            </div>
          )}
        </Card>
      </div>

      {/* ── Comparables ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <SectionLabel>Nearby comparables</SectionLabel>
        {m?.comparables?.length ? (
          <Card style={{ padding: 0 }}>
            {m.comparables.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: i < m.comparables.length - 1 ? '1px solid #1A1A1A' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...outfit, fontSize: 13, color: '#9A9188', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.airbnb_url ? (
                      <a href={c.airbnb_url} target="_blank" rel="noopener noreferrer" style={{ color: '#9A9188', textDecoration: 'none' }}>{c.title}</a>
                    ) : c.title}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, marginLeft: 12 }}>
                  {c.distance_km != null && (
                    <span style={{ ...mono, fontSize: 10, color: '#4A4540' }}>{c.distance_km.toFixed(1)} km</span>
                  )}
                  <span style={{ ...mono, fontSize: 10, color: '#C4A882' }}>${c.price_per_night_usd}/night</span>
                  {c.bedrooms && <span style={{ ...mono, fontSize: 10, color: '#555' }}>{c.bedrooms}BR</span>}
                  <span style={{ ...mono, fontSize: 10, color: '#4A4540' }}>
                    ~${Math.round(c.price_per_night_usd * 0.65 * 30).toLocaleString()}/mo
                  </span>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <Card>
            <div style={{ ...outfit, fontSize: 13, color: '#4A4540' }}>
              {property.zone ? 'No comparables found in this zone.' : 'Select a zone to see nearby comparables.'}
            </div>
          </Card>
        )}
      </div>

      {/* ── Email alerts toggle ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <SectionLabel>Weekly email alerts</SectionLabel>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ ...outfit, fontSize: 14, fontWeight: 600, color: '#C8BFB5', marginBottom: 4 }}>
                Receive weekly pricing recommendations every Monday morning
              </div>
              <div style={{ ...outfit, fontSize: 12, color: '#4A4540', lineHeight: 1.55, maxWidth: 500 }}>
                We&apos;ll send you a personalized market update with pricing recommendations based on your property&apos;s performance vs the market.
              </div>
            </div>
            <div
              onClick={() => setWeeklyAlerts(v => !v)}
              style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer', background: weeklyAlerts ? '#C4A882' : '#2A2A2A', transition: 'background 0.2s', flexShrink: 0, marginLeft: 20 }}
            >
              <div style={{ position: 'absolute', top: 3, left: weeklyAlerts ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: weeklyAlerts ? '#0A0A0A' : '#555', transition: 'left 0.2s' }} />
            </div>
          </div>
          <button
            onClick={handleSaveAlerts}
            disabled={alertsSaving}
            style={{ padding: '10px 22px', borderRadius: 50, border: 'none', cursor: alertsSaving ? 'default' : 'pointer', background: alertsSaving ? '#1A1A1A' : 'linear-gradient(135deg, #C4A882, #8B6F47)', color: alertsSaving ? '#555' : '#0A0A0A', fontSize: 13, fontWeight: 700, ...outfit }}
          >
            {alertsSaving ? 'Saving…' : 'Save preferences'}
          </button>
        </Card>
      </div>

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      {showEdit && (
        <PropertyModal
          mode="edit"
          initial={{
            id:                  property.id,
            title:               property.title,
            property_type:       property.property_type ?? undefined,
            bedrooms:            property.bedrooms ?? undefined,
            zone:                property.zone ?? undefined,
            address:             property.address ?? undefined,
            current_price_night: property.current_price_night ?? undefined,
            acquisition_price:   property.acquisition_price ?? undefined,
            lease_type:          property.lease_type ?? undefined,
            lease_duration:      property.lease_duration ?? undefined,
            latitude:            property.latitude ?? undefined,
            longitude:           property.longitude ?? undefined,
            weekly_alerts:       property.weekly_alerts,
            images:              property.images ?? [],
          }}
          onClose={() => setShowEdit(false)}
          onSaved={load}
        />
      )}

      {/* ── Delete confirmation ─────────────────────────────────────────────── */}
      {showDelete && (
        <div
          onClick={() => setShowDelete(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 14, padding: '32px 28px', maxWidth: 400, width: '100%' }}>
            <h3 style={{ ...cormorant, fontSize: 22, fontWeight: 600, color: '#F0EAE2', marginBottom: 12 }}>Delete this property?</h3>
            <p style={{ ...outfit, fontSize: 13, color: '#7A7168', lineHeight: 1.6, marginBottom: 24 }}>
              This action is irreversible. All snapshots, alerts, and recommendations will be deleted.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDelete(false)} style={{ flex: 1, padding: '11px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#7A7168', fontSize: 13, cursor: 'pointer', ...outfit }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '11px', borderRadius: 50, border: 'none', background: 'rgba(248,113,113,0.15)', color: '#F87171', fontSize: 13, cursor: deleting ? 'default' : 'pointer', ...outfit, fontWeight: 600 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
