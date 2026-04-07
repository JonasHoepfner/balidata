'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const PropertyModal = dynamic(() => import('@/components/PropertyModal'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────────────────

type Metrics = {
  priceMedian: number
  priceP25: number
  priceP75: number
  estMonthlyRevenue: number
  listingsCount: number
  variancePct: number | null
  score: number | null
  estOccupancy: number
}

type Property = {
  id: string
  title: string
  zone: string | null
  property_type: string | null
  bedrooms: number | null
  current_price_night: number | null
  weekly_alerts: boolean
  created_at: string
  images: string[] | null
  metrics: Metrics | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  villa: 'VILLA', apartment: 'APARTMENT', guesthouse: 'GUESTHOUSE', hotel: 'HOTEL',
}

function scoreColor(score: number) {
  if (score >= 70) return '#4ADE80'
  if (score >= 50) return '#FB923C'
  return '#F87171'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 400, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>🏠</div>
      <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 26, fontWeight: 600, color: '#F0EAE2', marginBottom: 10 }}>
        No properties yet
      </h2>
      <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, color: '#4A4540', marginBottom: 28, maxWidth: 360, lineHeight: 1.6 }}>
        Track your properties and get weekly market insights.
      </p>
      <button
        onClick={onAdd}
        style={{ padding: '13px 28px', borderRadius: 50, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-outfit)' }}
      >
        Add your first property →
      </button>
    </div>
  )
}

function PropertyCard({ property, onView }: { property: Property; onView: () => void }) {
  const [hovered, setHovered] = useState(false)
  const m = property.metrics
  const score = m?.score ?? null
  const variance = m?.variancePct ?? null

  const coverImage = property.images?.[0] ?? null

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#111', border: hovered ? '1px solid #C4A882' : '1px solid #1E1E1E',
        borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0,
        transition: 'border-color 200ms', cursor: 'pointer',
      }}
      onClick={onView}
    >
      {/* Cover image / placeholder */}
      <div style={{ height: 160, background: '#161616', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        {coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z" stroke="#2A2A2A" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
              <path d="M9 22V13h6v9" stroke="#2A2A2A" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          {property.property_type && (
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#C4A882', letterSpacing: '0.1em', background: 'rgba(196,168,130,0.08)', border: '1px solid rgba(196,168,130,0.2)', borderRadius: 4, padding: '2px 7px' }}>
              {TYPE_LABELS[property.property_type] ?? property.property_type.toUpperCase()}
            </span>
          )}
          {property.bedrooms && (
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#555', background: '#161616', border: '1px solid #2A2A2A', borderRadius: 4, padding: '2px 7px' }}>
              {property.bedrooms}BR
            </span>
          )}
        </div>
        <div style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600, fontSize: 16, color: '#F0EAE2', marginBottom: 4, lineHeight: 1.3 }}>
          {property.title}
        </div>
        {property.zone && (
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#C4A882', letterSpacing: '0.06em' }}>
            {property.zone}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Prix / nuit', value: property.current_price_night ? `$${property.current_price_night}` : '—' },
          { label: 'Prix médian marché', value: m?.priceMedian ? `$${m.priceMedian}` : '—' },
          { label: 'Revenu mensuel est.', value: m?.estMonthlyRevenue ? `$${m.estMonthlyRevenue.toLocaleString()}` : '—' },
          { label: 'Occupation estimée', value: m?.estOccupancy ? `${m.estOccupancy}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#0A0A0A', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 7, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 4 }}>{label.toUpperCase()}</div>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: '#C4A882' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Score bar */}
      {score != null && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em' }}>PERFORMANCE</div>
            <span style={{ fontFamily: 'var(--font-cormorant)', fontSize: 22, fontWeight: 700, color: scoreColor(score) }}>
              {score}<span style={{ fontSize: 12, color: '#4A4540' }}>/100</span>
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: '#1A1A1A', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: scoreColor(score), borderRadius: 2, transition: 'width 0.5s' }} />
          </div>
        </div>
      )}

      {/* Variance badge */}
      {variance != null && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.04em',
            color: variance >= 0 ? '#4ADE80' : '#FB923C',
            background: variance >= 0 ? 'rgba(74,222,128,0.08)' : 'rgba(251,146,60,0.08)',
            border: `1px solid ${variance >= 0 ? 'rgba(74,222,128,0.25)' : 'rgba(251,146,60,0.25)'}`,
            borderRadius: 5, padding: '3px 8px',
          }}>
            {variance >= 0 ? `+${variance}% above market` : `${variance}% below market`}
          </span>
          {property.weekly_alerts && (
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540' }}>📧 Weekly alerts ON</span>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={e => { e.stopPropagation(); onView() }}
        style={{ width: '100%', padding: '11px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#C4A882', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-outfit)', transition: 'all 0.15s' }}
      >
        View details →
      </button>
      </div>{/* end card body */}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PropertiesPage() {
  const router = useRouter()
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [isAdmin, setIsAdmin]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [propsRes, meRes] = await Promise.all([
      fetch('/api/properties'),
      fetch('/api/me'),
    ])
    const propsData = await propsRes.json()
    const meData    = await meRes.json()
    setProperties(propsData.properties ?? [])
    setIsAdmin(!!meData.isAdmin)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const atLimit = !isAdmin && properties.length >= 3

  if (loading) {
    return (
      <div style={{ padding: '64px 48px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#4A4540', letterSpacing: '0.1em' }}>CHARGEMENT…</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px 48px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 36 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 4 }}>My Properties</h1>
          <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4A4540' }}>
            {properties.length > 0 ? `${properties.length} propert${properties.length > 1 ? 'ies' : 'y'} tracked` : 'Track your STR properties'}
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { if (!atLimit) setShowModal(true) }}
            title={atLimit ? 'Upgrade to Pro for unlimited properties' : undefined}
            style={{
              padding: '12px 22px', borderRadius: 50, border: 'none',
              cursor: atLimit ? 'not-allowed' : 'pointer',
              background: atLimit ? '#1A1A1A' : 'linear-gradient(135deg, #C4A882, #8B6F47)',
              color: atLimit ? '#3A3530' : '#0A0A0A',
              fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)',
              transition: 'opacity 0.2s',
            }}
          >
            Add a property +
          </button>
          {atLimit && (
            <div style={{ position: 'absolute', top: '110%', right: 0, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap', fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#9A9188', zIndex: 10, pointerEvents: 'none', opacity: 0 }} className="limit-tooltip">
              Upgrade to Pro for unlimited properties
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {properties.length === 0 ? (
        <EmptyState onAdd={() => setShowModal(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {properties.map(p => (
            <PropertyCard
              key={p.id}
              property={p}
              onView={() => router.push(`/dashboard/properties/${p.id}`)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PropertyModal
          mode="create"
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  )
}
