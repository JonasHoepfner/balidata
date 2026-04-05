'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AddressAutocomplete, type PlaceResult } from '@/components/AddressAutocomplete'

// ── Types ──────────────────────────────────────────────────────────────────

type NearbyListing = {
  airbnb_id: string
  title: string
  price_per_night_usd: number
  distance_km: number
  airbnb_url: string | null
}

type ComparablesResult = {
  zone: string | null
  bedrooms: number | null
  lat: number | null
  lng: number | null
  listings_count: number
  price_median: number | null
  price_p25: number | null
  price_p75: number | null
  price_avg: number | null
  avg_reviews: number | null
  est_monthly_revenue: number | null
  verdict: 'realiste' | 'optimiste' | 'survendu' | 'no_data'
  variance_pct: number | null
  radius_km: number | null
  radius_used: number | null
  nearest_listings: NearbyListing[]
  insufficient_data_message: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  realiste:  { label: 'Réaliste',              color: '#4ADE80', bg: 'rgba(74,222,128,0.07)',  border: 'rgba(74,222,128,0.22)',  desc: 'Votre prix est bien positionné par rapport au marché.' },
  optimiste: { label: 'Optimiste',             color: '#FB923C', bg: 'rgba(251,146,60,0.07)',  border: 'rgba(251,146,60,0.22)',  desc: 'Votre prix est au-dessus de la médiane, mais reste plausible.' },
  survendu:  { label: 'Survendu',              color: '#F87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.22)', desc: 'Votre prix dépasse significativement le marché local.' },
  no_data:   { label: 'Données insuffisantes', color: '#9CA3AF', bg: 'rgba(156,163,175,0.07)', border: 'rgba(156,163,175,0.22)', desc: 'Aucun comparable trouvé pour ces critères.' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number | null) => n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US')

const fmtRange = (n: number | null) => {
  if (n == null) return '—'
  const lo = Math.round(n * 0.85 / 10) * 10
  const hi = Math.round(n * 1.15 / 10) * 10
  return `$${lo.toLocaleString('en-US')} – $${hi.toLocaleString('en-US')}`
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Blurred({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ filter: 'blur(7px)', userSelect: 'none', pointerEvents: 'none', display: 'inline-block' }}>
      {children}
    </span>
  )
}

function StatCard({ label, value, sub, accent = false, small = false, blurred = false }: {
  label: string; value: string; sub?: string; accent?: boolean; small?: boolean; blurred?: boolean
}) {
  return (
    <div style={{ background: '#111111', border: `1px solid ${accent ? 'rgba(196,168,130,0.18)' : '#1E1E1E'}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4540', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: small ? 16 : 22, fontWeight: 400, color: accent ? '#C4A882' : '#F0EAE2', lineHeight: 1.15, marginBottom: 4 }}>
        {blurred ? <Blurred>{value}</Blurred> : value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#3A3530', fontFamily: 'var(--font-outfit)' }}>{sub}</div>}
    </div>
  )
}

function UnlockBanner({ onUnlock, loading }: { onUnlock: (plan: 'once' | 'monthly') => void; loading: boolean }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(196,168,130,0.07), rgba(139,111,71,0.04))', border: '1px solid rgba(196,168,130,0.18)', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 22, fontWeight: 600, color: '#F0EAE2', marginBottom: 8, letterSpacing: '-0.01em' }}>
        Débloquez l&apos;analyse complète
      </div>
      <div style={{ fontSize: 13, color: '#5A5148', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px', fontFamily: 'var(--font-outfit)' }}>
        Prix exact, fourchette P25/P75, 3 listings les plus proches, 3 scénarios de rendement, export PDF.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => onUnlock('once')} disabled={loading}
          style={{ padding: '11px 22px', borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)' }}>
          {loading ? '…' : 'Rapport unique — $29'}
        </button>
        <button onClick={() => onUnlock('monthly')} disabled={loading}
          style={{ padding: '11px 22px', borderRadius: 8, border: '1px solid rgba(196,168,130,0.28)', cursor: loading ? 'not-allowed' : 'pointer', background: 'transparent', color: '#C4A882', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-outfit)' }}>
          {loading ? '…' : 'Accès illimité — $39/mois'}
        </button>
      </div>
    </div>
  )
}

// ── Inner component (needs useSearchParams → must be inside Suspense) ──────

function AnalysisDemoInner() {
  const searchParams = useSearchParams()
  const [isPaid, setIsPaid] = useState(false)
  const [stripeLoading, setStripeLoading] = useState(false)

  const [zone, setZone] = useState('Canggu')
  const [bedrooms, setBedrooms] = useState('2')
  const [price, setPrice] = useState('')
  const [address, setAddress] = useState('')
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number; label: string } | null>(null)

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComparablesResult | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('paid') === 'true') setIsPaid(true)
  }, [searchParams])

  const runAnalysis = useCallback(async (coords?: { lat: number; lng: number } | null) => {
    setLoading(true)
    setResult(null)
    setApiError(null)
    try {
      const body: Record<string, unknown> = {
        bedrooms: bedrooms === '5+' ? undefined : parseInt(bedrooms),
        price_announced: price ? parseFloat(price) : undefined,
      }
      if (coords) {
        body.lat = coords.lat; body.lng = coords.lng; body.radius_km = 1.0
      } else {
        body.zone = zone
      }
      const res = await fetch('/api/comparables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [bedrooms, price, zone])

  const handlePlaceSelect = useCallback((place: PlaceResult) => {
    setAddress(place.label)
    setGeoCoords(place)
    runAnalysis(place)
  }, [runAnalysis])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    runAnalysis(geoCoords)
  }

  async function handleUnlock(plan: 'once' | 'monthly') {
    setStripeLoading(true)
    try {
      const res = await fetch('/api/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      if (data.url) window.location.href = data.url
    } finally {
      setStripeLoading(false)
    }
  }

  const verdict = result ? VERDICT_CONFIG[result.verdict] : null

  const inputBase: React.CSSProperties = {
    width: '100%', background: '#0A0A0A', border: '1px solid #232323',
    borderRadius: 8, padding: '11px 12px', color: '#E8E0D4',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'var(--font-outfit)',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#4A4540', marginBottom: 7,
    fontFamily: 'var(--font-dm-mono)',
  }

  return (
    <div>
      {/* Form */}
      <form onSubmit={handleSubmit} style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 14, padding: '28px 28px 24px', marginBottom: 24 }}>
        {/* Address */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Adresse du bien</label>
          <AddressAutocomplete
            value={address}
            onChange={(val) => { setAddress(val); if (!val.trim()) setGeoCoords(null) }}
            onSelect={handlePlaceSelect}
            disabled={loading}
          />
          {geoCoords && (
            <div style={{ marginTop: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-outfit)' }}>
              <span style={{ color: '#4ADE80' }}>✓</span>
              <span style={{ color: '#4A5A50', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{geoCoords.label.slice(0, 90)}{geoCoords.label.length > 90 ? '…' : ''}</span>
              <button type="button" onClick={() => { setGeoCoords(null); setAddress('') }} style={{ background: 'none', border: 'none', color: '#5A5148', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}>✕ effacer</button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#1A1A1A' }} />
          <span style={{ fontSize: 10, color: '#3A3530', fontWeight: 600, fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.08em' }}>OU FILTRER PAR ZONE</span>
          <div style={{ flex: 1, height: 1, background: '#1A1A1A' }} />
        </div>

        {/* Zone / Bedrooms / Price */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ ...labelStyle, opacity: geoCoords ? 0.4 : 1 }}>Zone</label>
            <select value={zone} onChange={(e) => setZone(e.target.value)} disabled={!!geoCoords}
              style={{ ...inputBase, cursor: geoCoords ? 'not-allowed' : 'pointer', opacity: geoCoords ? 0.4 : 1, appearance: 'none' }}>
              {['Canggu', 'Seminyak', 'Ubud', 'Sanur', 'Uluwatu'].map(z => <option key={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Chambres</label>
            <select value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}
              style={{ ...inputBase, cursor: 'pointer', appearance: 'none' }}>
              {['1', '2', '3', '4', '5+'].map(b => (
                <option key={b} value={b}>{b === '5+' ? '5+ chambres' : b === '1' ? '1 chambre' : `${b} chambres`}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Prix / nuit (USD)</label>
            <input type="number" min={1} placeholder="ex. 250" value={price}
              onChange={(e) => setPrice(e.target.value)} style={{ ...inputBase, cursor: 'text' }} />
          </div>
        </div>

        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '13px 24px', borderRadius: 9, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: loading ? '#181818' : 'linear-gradient(135deg, #C4A882 0%, #8B6F47 100%)', color: loading ? '#3A3530' : '#0A0A0A', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.01em' }}>
          {loading ? 'Analyse en cours…' : 'Analyser le marché'}
        </button>
      </form>

      {/* Error */}
      {apiError && (
        <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '13px 17px', color: '#F87171', fontSize: 13, marginBottom: 20, fontFamily: 'var(--font-outfit)' }}>
          Erreur : {apiError}
        </div>
      )}

      {/* Results */}
      {result && verdict && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.insufficient_data_message && (
            <div style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 10, padding: '11px 15px', color: '#FB923C', fontSize: 12 }}>
              ⚠ {result.insufficient_data_message}
            </div>
          )}
          {result.radius_used != null && (
            <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '10px 16px', fontSize: 12, color: '#5A5148', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-outfit)' }}>
              <span style={{ color: '#C4A882' }}>◎</span>
              <span><strong style={{ color: '#8A8178' }}>{result.listings_count} comparable{result.listings_count !== 1 ? 's' : ''}</strong> dans un rayon de <strong style={{ color: '#8A8178' }}>{result.radius_used}km</strong></span>
            </div>
          )}

          {/* Verdict */}
          <div style={{ background: verdict.bg, border: `1px solid ${verdict.border}`, borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: verdict.color, marginBottom: 8, opacity: 0.7 }}>Verdict</div>
            <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 52, fontWeight: 700, letterSpacing: '-0.02em', color: verdict.color, lineHeight: 1, marginBottom: 8 }}>{verdict.label}</div>
            {result.variance_pct != null && (
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 15, color: verdict.color, fontWeight: 400, marginBottom: 8, opacity: 0.85 }}>
                {result.variance_pct > 0 ? '+' : ''}{result.variance_pct.toFixed(1)}% vs médiane du marché
              </div>
            )}
            <div style={{ fontSize: 13, color: '#6A6158', fontFamily: 'var(--font-outfit)' }}>{verdict.desc}</div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <StatCard label="Prix médian" value={isPaid ? fmt(result.price_median) : fmtRange(result.price_median)} sub={isPaid ? 'du marché' : 'fourchette (unlock pour exact)'} blurred={!isPaid} />
            <StatCard label="P25 / P75" value={isPaid ? `${fmt(result.price_p25)} – ${fmt(result.price_p75)}` : '••••• – •••••'} sub="intervalle" small blurred={!isPaid} />
            <StatCard label="Comparables" value={`${result.listings_count}`} sub="annonces analysées" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <StatCard label="Revenu mensuel estimé" value={isPaid ? fmt(result.est_monthly_revenue) : fmtRange(result.est_monthly_revenue)} sub="médiane × 30j × 65%" accent blurred={!isPaid} />
            <StatCard label="Avis moyens" value={result.avg_reviews != null ? `${result.avg_reviews}` : '—'} sub="par comparable" />
          </div>

          {/* Nearest listings */}
          {result.nearest_listings?.length > 0 && (
            <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #1A1A1A', fontFamily: 'var(--font-dm-mono)', fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4540' }}>
                3 listings les plus proches
              </div>
              {result.nearest_listings.map((l, i) => (
                <div key={l.airbnb_id} style={{ padding: '13px 18px', borderBottom: i < result.nearest_listings.length - 1 ? '1px solid #161616' : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#3A3530', minWidth: 24 }}>#{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isPaid ? (
                      <a href={l.airbnb_url ?? '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#C4A882', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</a>
                    ) : (
                      <span style={{ fontSize: 12, color: '#4A4540', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', filter: 'blur(4px)', userSelect: 'none' }}>{l.title}</span>
                    )}
                    <span style={{ fontSize: 11, color: '#3A3530', fontFamily: 'var(--font-dm-mono)' }}>{l.distance_km} km</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: '#F0EAE2', whiteSpace: 'nowrap' }}>
                    {fmt(l.price_per_night_usd)}<span style={{ fontSize: 10, color: '#4A4540' }}>/nuit</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isPaid && <UnlockBanner onUnlock={handleUnlock} loading={stripeLoading} />}

          <p style={{ fontSize: 10, color: '#2E2A26', textAlign: 'center', paddingTop: 4, fontFamily: 'var(--font-dm-mono)' }}>
            Données Airbnb Bali · {result.zone ?? 'GPS'} · {result.bedrooms != null ? `${result.bedrooms} ch. ±1` : 'toutes chambres'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Export wrapped in Suspense ─────────────────────────────────────────────

export function AnalysisDemo() {
  return (
    <Suspense fallback={<div style={{ height: 200, background: '#111111', borderRadius: 14 }} />}>
      <AnalysisDemoInner />
    </Suspense>
  )
}
