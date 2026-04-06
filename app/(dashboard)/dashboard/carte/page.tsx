'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { Listing, SidebarContent, Filters, Layers } from '@/components/MapboxMap'

const MapboxMap = dynamic(() => import('@/components/MapboxMap'), { ssr: false })

// ── Helpers ───────────────────────────────────────────────────────────────

function median(arr: number[]) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function percentile(sorted: number[], p: number) {
  const idx = Math.floor(sorted.length * p)
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0
}

// ── Zone legend data ──────────────────────────────────────────────────────

const ZONE_LEGEND = [
  { color: '#FF69B4', label: 'Zone touristique STR ✓' },
  { color: '#FF8C00', label: 'Commercial / Commerce ✓' },
  { color: '#4A9FE8', label: 'Zone côtière ✓' },
  { color: '#FFD700', label: 'Résidentiel ⚠ conditionnel' },
  { color: '#4CAF50', label: 'Zone agricole ✗' },
  { color: '#888888', label: 'Terrain nu ✗' },
]

// ── Toggle ────────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#9A9188' }}>{label}</span>
      <div onClick={() => onChange(!checked)} style={{ width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', background: checked ? '#C4A882' : '#2A2A2A', transition: 'background 0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 3, left: checked ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: checked ? '#0A0A0A' : '#555', transition: 'left 0.2s' }} />
      </div>
    </div>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: active ? 'rgba(196,168,130,0.15)' : '#1A1A1A', color: active ? '#C4A882' : '#555', fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.06em', outline: active ? '1px solid rgba(196,168,130,0.4)' : '1px solid transparent', transition: 'all 0.15s' }}>
      {label}
    </button>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  )
}

// ── Price bar ─────────────────────────────────────────────────────────────

function PriceBar({ price, p25, med, p75 }: { price: number; p25: number; med: number; p75: number }) {
  const lo  = Math.max(0, p25 * 0.75)
  const hi  = p75 * 1.25
  const rng = hi - lo || 1
  const pct = Math.max(2, Math.min(98, ((price - lo) / rng) * 100))
  const p25pct = ((p25 - lo) / rng) * 100
  const medpct = ((med - lo) / rng) * 100
  const p75pct = ((p75 - lo) / rng) * 100

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(to right, #4CAF50, #FDD835, #FF9800, #e53935)', marginBottom: 20 }}>
        {/* marker */}
        <div style={{ position: 'absolute', top: '50%', left: `${pct}%`, transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: '50%', background: '#C4A882', border: '2px solid #0A0A0A', zIndex: 2 }} />
        {/* labels */}
        {[{ pct: p25pct, label: `P25 $${p25}` }, { pct: medpct, label: `Méd. $${med}` }, { pct: p75pct, label: `P75 $${p75}` }].map(({ pct: lp, label }) => (
          <div key={label} style={{ position: 'absolute', bottom: -18, left: `${lp}%`, transform: 'translateX(-50%)', fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', whiteSpace: 'nowrap' }}>
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Listing Modal (bottom sheet) ──────────────────────────────────────────

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']
const SEASON_MULT = [0.82, 0.78, 0.80, 0.83, 0.87, 0.92, 1.15, 1.18, 1.05, 1.00, 0.85, 1.12]

function ListingModal({
  listing,
  allListings,
  onClose,
  onFilterComparables,
}: {
  listing: Listing
  allListings: Listing[]
  onClose: () => void
  onFilterComparables: (listing: Listing) => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // Zone price stats
  const zoneListings = allListings.filter(l => l.zone === listing.zone)
  const sortedPrices = zoneListings.map(l => l.price_per_night).sort((a, b) => a - b)
  const p25  = percentile(sortedPrices, 0.25)
  const med  = median(sortedPrices)
  const p75  = percentile(sortedPrices, 0.75)

  const priceDiffPct = med > 0 ? ((listing.price_per_night - med) / med) * 100 : 0
  const perfColor  = priceDiffPct > 10 ? '#4ADE80' : priceDiffPct < -10 ? '#FB923C' : '#F0EAE2'
  const perfText   = priceDiffPct > 10
    ? `+${priceDiffPct.toFixed(0)}% au-dessus de la moyenne ${listing.zone}`
    : priceDiffPct < -10
    ? `${priceDiffPct.toFixed(0)}% sous la moyenne ${listing.zone}`
    : `Dans la moyenne du marché ${listing.zone}`

  // Comparables (closest by distance, excluding self)
  const comparables = allListings
    .filter(l => l.id !== listing.id)
    .map(l => ({ ...l, dist: haversineKm(listing.latitude, listing.longitude, l.latitude, l.longitude) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)

  // Revenue
  const monthly  = listing.monthly_revenue
  const annual   = monthly * 12
  const netMonth = Math.round(monthly * 0.67)
  const netAnnual = Math.round(annual * 0.67)
  const occ      = listing.occupancy_rate

  // Static map
  const token   = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ''
  const mapUrl  = `https://api.maptiler.com/maps/dataviz-dark/static/${listing.longitude},${listing.latitude},15/480x140.png?key=${token}`

  return (
    <>
      {/* Overlay — click closes */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, zIndex: 9 }} />

      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 520,
        background: '#111', border: '1px solid #2A2A2A',
        borderRadius: '16px 16px 0 0',
        zIndex: 10,
        height: expanded ? '85vh' : 'auto',
        overflowY: expanded ? 'auto' : 'visible',
        animation: 'slideUp 250ms ease',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
      }}>
        <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(60px); opacity: 0 } to { transform: translateX(-50%) translateY(0); opacity: 1 } }`}</style>

        {/* Expand handle */}
        <div onClick={() => setExpanded(e => !e)} style={{ textAlign: 'center', padding: '12px 0 0', cursor: 'pointer' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#2A2A2A', margin: '0 auto 4px' }} />
          <span style={{ color: '#3A3530', fontSize: 11 }}>{expanded ? '↓ Réduire' : '↑ Agrandir'}</span>
        </div>

        <div style={{ padding: '16px 24px 24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600, fontSize: 16, color: '#F0EAE2', marginBottom: 8, lineHeight: 1.3 }}>
                {listing.title}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#C4A882', letterSpacing: '0.08em' }}>{listing.zone}</span>
                <span style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 4, padding: '2px 8px', fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#7A7168' }}>
                  {listing.bedrooms}BR
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', padding: '0 0 0 16px', lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>

          {/* Static map */}
          <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', marginBottom: 16, height: 130, background: '#0A0A0A', flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mapUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {/* CSS pin at center */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)', pointerEvents: 'none' }}>
              <div style={{ width: 12, height: 12, background: '#e53935', border: '2px solid white', borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)' }} />
            </div>
          </div>

          {/* KPIs 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Prix / nuit',    value: `$${listing.price_per_night}`,           color: '#C4A882' },
              { label: 'Occupation',     value: `${Math.round(occ * 100)}%`,              color: '#4ADE80' },
              { label: 'Revenu mensuel', value: `$${monthly.toLocaleString()}`,           color: '#C4A882' },
              { label: 'Revenu annuel',  value: `$${annual.toLocaleString()}`,            color: '#F0EAE2' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#0A0A0A', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 5 }}>{label.toUpperCase()}</div>
                <div style={{ fontFamily: 'var(--font-outfit)', fontWeight: 700, fontSize: 18, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Performance */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 6 }}>POSITIONNEMENT PRIX</div>
            <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: perfColor, marginBottom: 10 }}>{perfText}</div>
            <PriceBar price={listing.price_per_night} p25={p25} med={med} p75={p75} />
          </div>

          {/* Comparables */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 8 }}>3 BIENS LES PLUS PROCHES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {comparables.map(c => (
                <div key={c.id} style={{ background: '#161616', borderRadius: 6, padding: '9px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#9A9188' }}>{c.title}</div>
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginLeft: 8 }}>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540' }}>{c.dist.toFixed(1)} km</span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#C4A882' }}>${c.price_per_night}</span>
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#555' }}>{c.bedrooms}BR</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expanded content */}
          {expanded && (
            <>
              {/* Revenu brut vs net */}
              <div style={{ background: '#0A0A0A', borderRadius: 8, padding: '14px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 12 }}>REVENU BRUT VS NET (×0.67)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Brut / mois', value: `$${monthly.toLocaleString()}`, color: '#C8BFB5' },
                    { label: 'Net / mois',  value: `$${netMonth.toLocaleString()}`, color: '#4ADE80' },
                    { label: 'Brut / an',   value: `$${annual.toLocaleString()}`,   color: '#C8BFB5' },
                    { label: 'Net / an',    value: `$${netAnnual.toLocaleString()}`, color: '#4ADE80' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 7, color: '#4A4540', marginBottom: 4 }}>{label.toUpperCase()}</div>
                      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Occupation mensuelle estimée */}
              <div style={{ background: '#0A0A0A', borderRadius: 8, padding: '14px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 12 }}>OCCUPATION MENSUELLE ESTIMÉE</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                  {MONTHS.map((m, i) => {
                    const mocc = Math.min(0.95, Math.max(0.3, occ * SEASON_MULT[i]))
                    const bar  = Math.round(mocc * 100)
                    return (
                      <div key={m} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 7, color: '#4A4540', marginBottom: 4 }}>{m}</div>
                        <div style={{ height: 32, background: '#1A1A1A', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${bar}%`, background: mocc > 0.8 ? '#4ADE80' : mocc > 0.65 ? '#C4A882' : '#FF9800', borderRadius: 3 }} />
                        </div>
                        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 7, color: '#555', marginTop: 3 }}>{bar}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { onFilterComparables(listing); onClose() }}
              style={{ flex: 2, padding: '11px', borderRadius: 50, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)' }}
            >
              Voir les comparables →
            </button>
            <button
              onClick={onClose}
              style={{ flex: 1, padding: '11px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#7A7168', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Sidebar panel (zone + estimate only) ──────────────────────────────────

function SidebarPanel({ content }: { content: SidebarContent }) {
  if (!content) {
    return (
      <div style={{ padding: '16px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>📍</div>
        <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#3A3530', lineHeight: 1.6 }}>
          Cliquez sur un listing, un polygone ou n&apos;importe où sur la carte.
        </p>
      </div>
    )
  }

  if (content.type === 'zone') {
    const p = content.feature.properties
    const status = p.str_status ?? (p.str_compatible ? 'authorized' : 'restricted')

    const badgeCfg = {
      authorized:  { bg: 'rgba(74,222,128,0.08)',   border: 'rgba(74,222,128,0.25)',   color: '#4ADE80',  text: 'STR Autorisé ✓' },
      conditional: { bg: 'rgba(251,146,60,0.08)',    border: 'rgba(251,146,60,0.35)',   color: '#FB923C',  text: 'STR Conditionnel ⚠' },
      restricted:  { bg: 'rgba(248,113,113,0.08)',   border: 'rgba(248,113,113,0.25)',  color: '#F87171',  text: 'STR Restreint ✗' },
    }[status]

    return (
      <div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#6A6158', letterSpacing: '0.1em', marginBottom: 10 }}>ZONAGE</div>
        {p.name && <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, fontWeight: 600, color: '#F0EAE2', marginBottom: 8 }}>{p.name}</div>}

        <div style={{ marginBottom: 12 }}>
          <span style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: 6,
            fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.06em',
            background: badgeCfg.bg, border: `1px solid ${badgeCfg.border}`, color: badgeCfg.color,
          }}>
            {badgeCfg.text}
          </span>
          {status === 'conditional' && (
            <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 10, color: '#FB923C', marginTop: 6, lineHeight: 1.5 }}>
              Vérification recommandée
            </div>
          )}
        </div>

        <div style={{ background: '#0A0A0A', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 3 }}>TYPE</div>
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C8BFB5' }}>{p.zone_label ?? p.zone_type}</div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', marginTop: 2 }}>{p.zone_type}</div>
        </div>
        <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 10, color: '#3A3530', lineHeight: 1.5, fontStyle: 'italic' }}>
          Données OSM indicatives — à confirmer avec un notaire PPAT agréé.
        </p>
      </div>
    )
  }

  if (content.type === 'estimate') {
    return (
      <div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#6A6158', letterSpacing: '0.1em', marginBottom: 10 }}>ESTIMATION ZONE</div>
        {content.estimatedRevenue !== null ? (
          <>
            <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#9A9188', marginBottom: 12, lineHeight: 1.6 }}>
              Un bien <strong style={{ color: '#C4A882' }}>2BR</strong> ici pourrait générer :
            </p>
            <div style={{ background: '#0A0A0A', borderRadius: 8, padding: '14px', textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 24, color: '#C4A882' }}>
                ~${content.estimatedRevenue.toLocaleString()}
              </div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 10, color: '#4A4540', marginTop: 3 }}>/ mois estimé</div>
            </div>
            <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 10, color: '#3A3530', lineHeight: 1.5, fontStyle: 'italic' }}>
              Moyenne des listings 2BR dans 1 km.
            </p>
          </>
        ) : (
          <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4A4540', lineHeight: 1.6 }}>
            Aucun listing 2BR dans 1 km autour de ce point.
          </p>
        )}
      </div>
    )
  }

  return null
}

// ── Page ──────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = { bedrooms: [], priceMin: 0, priceMax: 0 }
const DEFAULT_LAYERS:  Layers  = { heatmap: false, listings: true, zonage: false }

export default function CartePage() {
  const [listings,         setListings]         = useState<Listing[]>([])
  const [filters,          setFilters]          = useState<Filters>(DEFAULT_FILTERS)
  const [layers,           setLayers]           = useState<Layers>(DEFAULT_LAYERS)
  const [sidebar,          setSidebar]          = useState<SidebarContent>(null)
  const [selectedListing,  setSelectedListing]  = useState<Listing | null>(null)
  const [stats,            setStats]            = useState({ count: 0, medianPrice: 0, medianRevenue: 0, avgOccupancy: 0 })
  const [priceMin,         setPriceMin]         = useState('')
  const [priceMax,         setPriceMax]         = useState('')
  const [hasComparableFilter, setHasComparableFilter] = useState(false)

  useEffect(() => {
    fetch('/data/demo-listings.json').then(r => r.json()).then(setListings).catch(() => {})
  }, [])

  const priceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function updatePrices(min: string, max: string) {
    if (priceTimer.current) clearTimeout(priceTimer.current)
    priceTimer.current = setTimeout(() => {
      setFilters(f => ({ ...f, priceMin: Number(min) || 0, priceMax: Number(max) || 0 }))
    }, 400)
  }

  function toggleBedroom(br: number) {
    setFilters(f => ({
      ...f,
      bedrooms: f.bedrooms.includes(br) ? f.bedrooms.filter(b => b !== br) : [...f.bedrooms, br],
    }))
  }

  function handleFilterComparables(listing: Listing) {
    setFilters(f => ({ ...f, bedrooms: [listing.bedrooms] }))
    setLayers(l => ({ ...l, listings: true }))
    setHasComparableFilter(true)
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
    setPriceMin('')
    setPriceMax('')
    setHasComparableFilter(false)
  }

  const handleStats    = useCallback((s: typeof stats) => setStats(s), [])
  const handleListing  = useCallback((l: Listing) => setSelectedListing(l), [])

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0A0A0A', border: '1px solid #1E1E1E',
    borderRadius: 6, padding: '8px 10px', color: '#E8E0D4',
    fontSize: 12, outline: 'none', fontFamily: 'var(--font-dm-mono)',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-outfit)' }}>

      {/* ── Left panel ── */}
      <div style={{ width: 320, flexShrink: 0, background: '#0D0D0D', borderRight: '1px solid #1E1E1E', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #1A1A1A' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 24, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 3 }}>Carte du marché</h1>
          <p style={{ fontSize: 12, color: '#4A4540' }}>Canggu · Berawa · Pererenan</p>
        </div>

        <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>

          {/* Layers */}
          <div style={{ marginBottom: 18 }}>
            <SectionTitle>Layers</SectionTitle>
            <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '4px 12px' }}>
              <Toggle label="Heatmap revenus"      checked={layers.heatmap}  onChange={v => setLayers(l => ({ ...l, heatmap: v }))} />
              <div style={{ height: 1, background: '#1A1A1A' }} />
              <Toggle label="Biens comparables"    checked={layers.listings} onChange={v => setLayers(l => ({ ...l, listings: v }))} />
              <div style={{ height: 1, background: '#1A1A1A' }} />
              <Toggle label="Zonage réglementaire" checked={layers.zonage}   onChange={v => setLayers(l => ({ ...l, zonage: v }))} />
            </div>
          </div>

          {/* Filtres */}
          <div style={{ marginBottom: 18 }}>
            <SectionTitle>Filtres</SectionTitle>
            <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '14px 12px' }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.08em', marginBottom: 8 }}>CHAMBRES</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4].map(br => (
                    <Chip key={br} label={br < 4 ? `${br}BR` : '4BR+'}
                      active={filters.bedrooms.length === 0 || filters.bedrooms.includes(br)}
                      onClick={() => toggleBedroom(br)}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.08em', marginBottom: 8 }}>PRIX / NUIT (USD)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input type="number" placeholder="Min" value={priceMin} onChange={e => { setPriceMin(e.target.value); updatePrices(e.target.value, priceMax) }} style={inputStyle} />
                  <input type="number" placeholder="Max" value={priceMax} onChange={e => { setPriceMax(e.target.value); updatePrices(priceMin, e.target.value) }} style={inputStyle} />
                </div>
              </div>
            </div>
            <button onClick={resetFilters} style={{ marginTop: 8, width: '100%', padding: '7px', borderRadius: 6, background: hasComparableFilter ? 'rgba(196,168,130,0.08)' : 'transparent', border: hasComparableFilter ? '1px solid rgba(196,168,130,0.3)' : '1px solid #1A1A1A', color: hasComparableFilter ? '#C4A882' : '#4A4540', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.06em', transition: 'all 0.15s' }}>
              {hasComparableFilter ? '✕ RÉINITIALISER LE FILTRE COMPARABLES' : 'RÉINITIALISER LES FILTRES'}
            </button>
          </div>

          {/* Stats zone */}
          <div style={{ marginBottom: 18 }}>
            <SectionTitle>Résumé zone visible</SectionTitle>
            <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Listings',     value: stats.count },
                { label: 'Prix médian',  value: stats.medianPrice  ? `$${stats.medianPrice}` : '—' },
                { label: 'Rev. médian',  value: stats.medianRevenue ? `$${stats.medianRevenue.toLocaleString()}` : '—' },
                { label: 'Occ. moy.',    value: stats.avgOccupancy ? `${stats.avgOccupancy}%` : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 3 }}>{label.toUpperCase()}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar dynamique */}
          <div style={{ marginBottom: 18 }}>
            <SectionTitle>Détails</SectionTitle>
            <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '12px' }}>
              <SidebarPanel content={sidebar} />
            </div>
          </div>

          {/* Légende zonage */}
          {layers.zonage && (
            <div style={{ marginTop: 'auto', paddingTop: 4 }}>
              <SectionTitle>Légende zonage</SectionTitle>
              <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ZONE_LEGEND.map(({ color, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: color, flexShrink: 0, opacity: 0.85 }} />
                    <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#7A7168' }}>{label}</span>
                  </div>
                ))}
                <div style={{ marginTop: 4, fontFamily: 'var(--font-outfit)', fontSize: 9, color: '#2A2A2A', fontStyle: 'italic', lineHeight: 1.5 }}>
                  Données OSM indicatives — à confirmer avec un notaire PPAT.
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Map column ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapboxMap
          listings={listings}
          filters={filters}
          layers={layers}
          onListingClick={handleListing}
          onSidebarChange={setSidebar}
          onStatsChange={handleStats}
        />

        {/* Listing modal (bottom sheet) */}
        {selectedListing && (
          <ListingModal
            listing={selectedListing}
            allListings={listings}
            onClose={() => setSelectedListing(null)}
            onFilterComparables={handleFilterComparables}
          />
        )}
      </div>
    </div>
  )
}
