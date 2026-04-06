'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { Listing, SidebarContent, Filters, Layers } from '@/components/MapboxMap'

// SSR=false — Mapbox uses browser APIs
const MapboxMap = dynamic(() => import('@/components/MapboxMap'), { ssr: false })

// ── Toggle Switch ─────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
      <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#9A9188' }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 36, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
          background: checked ? '#C4A882' : '#2A2A2A',
          transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: checked ? 19 : 3,
          width: 14, height: 14, borderRadius: '50%',
          background: checked ? '#0A0A0A' : '#555',
          transition: 'left 0.2s',
        }} />
      </div>
    </div>
  )
}

// ── Chip button ───────────────────────────────────────────────────────────

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(196,168,130,0.15)' : '#1A1A1A',
        color: active ? '#C4A882' : '#555',
        fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.06em',
        outline: active ? '1px solid rgba(196,168,130,0.4)' : '1px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

// ── Section heading ───────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540',
      letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

// ── Sidebar panel ─────────────────────────────────────────────────────────

function SidebarPanel({
  content,
  onFilterBedrooms,
}: {
  content: SidebarContent
  onFilterBedrooms?: (br: number) => void
}) {
  if (!content) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 22, marginBottom: 10 }}>📍</div>
        <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#3A3530', lineHeight: 1.6 }}>
          Cliquez sur un listing, un polygone ou n&apos;importe où sur la carte pour afficher les détails.
        </p>
      </div>
    )
  }

  if (content.type === 'listing') {
    const l = content.listing
    const occ = Math.round(l.occupancy_rate * 100)
    return (
      <div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#C4A882', letterSpacing: '0.1em', marginBottom: 10 }}>LISTING</div>
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, fontWeight: 600, color: '#F0EAE2', marginBottom: 4, lineHeight: 1.4 }}>{l.title}</div>
        <div style={{ fontSize: 12, color: '#6A6158', marginBottom: 16 }}>{l.zone}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Prix / nuit', value: `$${l.price_per_night}` },
            { label: 'Chambres',    value: `${l.bedrooms} BR` },
            { label: 'Occupation',  value: `${occ}%` },
            { label: 'Rev. mensuel', value: `$${l.monthly_revenue.toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#0A0A0A', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 4 }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: '#C4A882' }}>{value}</div>
            </div>
          ))}
        </div>
        {onFilterBedrooms && (
          <button
            onClick={() => onFilterBedrooms(l.bedrooms)}
            style={{
              width: '100%', padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgba(196,168,130,0.1)', color: '#C4A882',
              fontFamily: 'var(--font-outfit)', fontSize: 12, fontWeight: 600,
              outline: '1px solid rgba(196,168,130,0.25)',
            }}
          >
            Voir les comparables {l.bedrooms}BR →
          </button>
        )}
      </div>
    )
  }

  if (content.type === 'zone') {
    const p = content.feature.properties
    const compat = p.str_compatible
    return (
      <div>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#6A6158', letterSpacing: '0.1em', marginBottom: 10 }}>ZONAGE</div>
        {p.name && (
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, fontWeight: 600, color: '#F0EAE2', marginBottom: 8 }}>{p.name}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            display: 'inline-block', padding: '4px 12px', borderRadius: 6,
            fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.06em',
            background: compat ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${compat ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
            color: compat ? '#4ADE80' : '#F87171',
          }}>
            {compat ? 'STR COMPATIBLE' : 'STR RESTREINT'}
          </span>
        </div>
        <div style={{ background: '#0A0A0A', borderRadius: 8, padding: '12px', marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 4 }}>TYPE DE ZONE</div>
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C8BFB5' }}>{p.zone_label}</div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540', marginTop: 2 }}>{p.zone_type}</div>
        </div>
        <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 10, color: '#3A3530', lineHeight: 1.6, fontStyle: 'italic' }}>
          Données indicatives OSM — à confirmer avec un notaire PPAT.
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
            <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#9A9188', marginBottom: 16, lineHeight: 1.6 }}>
              Un bien <strong style={{ color: '#C4A882' }}>2 chambres</strong> dans cette zone pourrait générer environ :
            </p>
            <div style={{ background: '#0A0A0A', borderRadius: 10, padding: '18px', textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 28, color: '#C4A882' }}>
                ~${content.estimatedRevenue.toLocaleString()}
              </div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#4A4540', marginTop: 4 }}>/ mois estimé</div>
            </div>
            <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 10, color: '#3A3530', lineHeight: 1.6, fontStyle: 'italic' }}>
              Basé sur la moyenne des listings 2BR dans un rayon de 1 km.
            </p>
          </>
        ) : (
          <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4A4540', lineHeight: 1.6 }}>
            Aucun listing 2BR dans un rayon de 1 km autour de ce point.
          </p>
        )}
        <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 10, color: '#3A3530', lineHeight: 1.5, marginTop: 12, fontStyle: 'italic' }}>
          Coordonnées : {content.lat.toFixed(5)}, {content.lng.toFixed(5)}
        </p>
      </div>
    )
  }

  return null
}

// ── Page ───────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: Filters = { bedrooms: [], priceMin: 0, priceMax: 0 }
const DEFAULT_LAYERS:  Layers  = { heatmap: false, listings: true, zonage: false }

export default function CartePage() {
  const [listings,   setListings]   = useState<Listing[]>([])
  const [filters,    setFilters]    = useState<Filters>(DEFAULT_FILTERS)
  const [layers,     setLayers]     = useState<Layers>(DEFAULT_LAYERS)
  const [sidebar,    setSidebar]    = useState<SidebarContent>(null)
  const [stats,      setStats]      = useState({ count: 0, medianPrice: 0, medianRevenue: 0, avgOccupancy: 0 })
  const [priceMin,   setPriceMin]   = useState('')
  const [priceMax,   setPriceMax]   = useState('')

  useEffect(() => {
    fetch('/data/demo-listings.json').then(r => r.json()).then(setListings).catch(() => {})
  }, [])

  // Debounce price filter
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

  function filterOnlyBedroom(br: number) {
    setFilters(f => ({ ...f, bedrooms: [br] }))
    setLayers(l => ({ ...l, listings: true }))
  }

  const handleStats = useCallback((s: typeof stats) => setStats(s), [])

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
    setPriceMin('')
    setPriceMax('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0A0A0A', border: '1px solid #1E1E1E',
    borderRadius: 6, padding: '8px 10px', color: '#E8E0D4',
    fontSize: 12, outline: 'none', fontFamily: 'var(--font-dm-mono)',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)', overflow: 'hidden', fontFamily: 'var(--font-outfit)' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 320, flexShrink: 0,
        background: '#0D0D0D', borderRight: '1px solid #1E1E1E',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #1A1A1A' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 24, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 3 }}>
            Carte du marché
          </h1>
          <p style={{ fontSize: 12, color: '#4A4540' }}>Canggu · Berawa · Pererenan</p>
        </div>

        <div style={{ padding: '16px 20px', flex: 1 }}>

          {/* ── Layers ── */}
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>Layers</SectionTitle>
            <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '4px 12px' }}>
              <Toggle label="Heatmap revenus"       checked={layers.heatmap}   onChange={v => setLayers(l => ({ ...l, heatmap: v }))} />
              <div style={{ height: 1, background: '#1A1A1A' }} />
              <Toggle label="Biens comparables"     checked={layers.listings}  onChange={v => setLayers(l => ({ ...l, listings: v }))} />
              <div style={{ height: 1, background: '#1A1A1A' }} />
              <Toggle label="Zonage réglementaire"  checked={layers.zonage}    onChange={v => setLayers(l => ({ ...l, zonage: v }))} />
            </div>
          </div>

          {/* ── Filtres ── */}
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>Filtres</SectionTitle>
            <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '14px 12px' }}>
              {/* Bedrooms */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.08em', marginBottom: 8 }}>CHAMBRES</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4].map(br => (
                    <Chip
                      key={br}
                      label={br < 4 ? `${br}BR` : '4BR+'}
                      active={filters.bedrooms.length === 0 || filters.bedrooms.includes(br)}
                      onClick={() => toggleBedroom(br)}
                    />
                  ))}
                </div>
              </div>

              {/* Price range */}
              <div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.08em', marginBottom: 8 }}>PRIX / NUIT (USD)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <input
                      type="number" placeholder="Min" value={priceMin}
                      onChange={e => { setPriceMin(e.target.value); updatePrices(e.target.value, priceMax) }}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <input
                      type="number" placeholder="Max" value={priceMax}
                      onChange={e => { setPriceMax(e.target.value); updatePrices(priceMin, e.target.value) }}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={resetFilters}
              style={{
                marginTop: 8, width: '100%', padding: '7px', borderRadius: 6,
                background: 'transparent', border: '1px solid #1A1A1A',
                color: '#4A4540', fontSize: 11, cursor: 'pointer',
                fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.06em',
              }}
            >
              RÉINITIALISER LES FILTRES
            </button>
          </div>

          {/* ── Stats zone visible ── */}
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>Résumé zone visible</SectionTitle>
            <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '14px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Listings', value: stats.count },
                { label: 'Prix médian', value: stats.medianPrice ? `$${stats.medianPrice}` : '—' },
                { label: 'Rev. médian', value: stats.medianRevenue ? `$${stats.medianRevenue.toLocaleString()}` : '—' },
                { label: 'Occ. moyenne', value: stats.avgOccupancy ? `${stats.avgOccupancy}%` : '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 3 }}>{label.toUpperCase()}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Sidebar dynamique ── */}
          <div style={{ marginBottom: 8 }}>
            <SectionTitle>Détails</SectionTitle>
            <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '14px 12px' }}>
              <SidebarPanel content={sidebar} onFilterBedrooms={filterOnlyBedroom} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapboxMap
          listings={listings}
          filters={filters}
          layers={layers}
          onSidebarChange={setSidebar}
          onStatsChange={handleStats}
        />
      </div>
    </div>
  )
}
