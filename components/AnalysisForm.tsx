'use client'

import { useState, useCallback } from 'react'
import { AddressAutocomplete, type PlaceResult } from '@/components/AddressAutocomplete'
import { useAuthModal } from '@/context/AuthModalContext'

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

const REGENCIES = [
  { key: 'badung',     label: 'Badung',     active: true  },
  { key: 'gianyar',   label: 'Gianyar',    active: false },
  { key: 'denpasar',  label: 'Denpasar',   active: false },
  { key: 'buleleng',  label: 'Buleleng',   active: false },
  { key: 'tabanan',   label: 'Tabanan',    active: false },
  { key: 'karangasem',label: 'Karangasem', active: false },
  { key: 'klungkung', label: 'Klungkung',  active: false },
  { key: 'bangli',    label: 'Bangli',     active: false },
  { key: 'jembrana',  label: 'Jembrana',   active: false },
]

// Badung zones — grouped
const BADUNG_ZONE_GROUPS = [
  {
    group: 'CANGGU',
    zones: ['Berawa', 'Batu Bolong', 'Echo Beach', 'Nelayan', 'Pererenan', 'Seseh', 'Cemagi', 'Munggu', 'Nyanyi', 'Cepaka', 'Babakan', 'Padonan', 'Kayu Tulang', 'Tumbak Bayuh', 'Buduk', 'Umalas'],
  },
  {
    group: 'SEMINYAK',
    zones: ['Seminyak', 'Kerobokan', 'Kuta', 'Legian'],
  },
  {
    group: 'BUKIT',
    zones: ['Uluwatu', 'Bingin', 'Padang Padang', 'Ungasan', 'Pandawa'],
  },
]

const PROJECT_TYPES = [
  { key: 'villa',       label: 'Villa',       icon: '⌂', desc: 'Maison individuelle' },
  { key: 'appartement', label: 'Appartement', icon: '▦', desc: 'Suite ou appartement' },
]

const VERDICT_CONFIG = {
  realiste:  { label: 'Réaliste',              color: '#4ADE80', bg: 'rgba(74,222,128,0.07)',  border: 'rgba(74,222,128,0.22)',  desc: 'Votre prix est bien positionné par rapport au marché Airbnb Bali.' },
  optimiste: { label: 'Optimiste',             color: '#FB923C', bg: 'rgba(251,146,60,0.07)',  border: 'rgba(251,146,60,0.22)',  desc: 'Votre prix est au-dessus de la médiane, mais reste plausible.' },
  survendu:  { label: 'Survendu',              color: '#F87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.22)', desc: 'Votre prix dépasse significativement les loyers Airbnb du marché local.' },
  no_data:   { label: 'Données insuffisantes', color: '#9CA3AF', bg: 'rgba(156,163,175,0.07)', border: 'rgba(156,163,175,0.22)', desc: 'Aucun comparable Airbnb trouvé pour ces critères.' },
}

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (n: number | null) => n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US')

function formatThousands(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  return parseInt(digits, 10).toLocaleString('en-US')
}

// ── Shared styles ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 500, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: '#4A4540', marginBottom: 7,
  fontFamily: 'var(--font-dm-mono)',
}

const inputBase: React.CSSProperties = {
  width: '100%', background: '#0A0A0A', border: '1px solid #232323',
  borderRadius: 7, padding: '9px 11px', color: '#E8E0D4',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--font-outfit)',
}

// ── StepIndicator ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const labels = ['Localisation', 'Le Bien', 'Tarif & Bail']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
      {labels.map((label, i) => {
        const idx = i + 1
        const done = idx < current
        const active = idx === current
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? '#C4A882' : active ? 'linear-gradient(135deg, #C4A882, #8B6F47)' : '#1A1A1A',
                border: done || active ? 'none' : '1px solid #2A2A2A',
                fontFamily: 'var(--font-dm-mono)', fontSize: 10, fontWeight: 600,
                color: done || active ? '#0A0A0A' : '#3A3530',
                transition: 'all 0.25s', flexShrink: 0,
              }}>
                {done ? '✓' : idx}
              </div>
              <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 9, color: active ? '#C4A882' : done ? '#6A6158' : '#3A3530', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div style={{ flex: 1, height: 1, background: done ? '#C4A882' : '#1E1E1E', marginBottom: 14, marginLeft: 4, marginRight: 4, transition: 'background 0.3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Localisation ───────────────────────────────────────────────────

function Step1({
  selectedRegency, onSelectRegency,
  selectedZone, onSelectZone,
  address, onAddressChange, onAddressSelect, geoCoords, onClearGeo,
  onNext,
}: {
  selectedRegency: string
  onSelectRegency: (k: string) => void
  selectedZone: string
  onSelectZone: (z: string) => void
  address: string
  onAddressChange: (v: string) => void
  onAddressSelect: (p: PlaceResult) => void
  geoCoords: { lat: number; lng: number; label: string } | null
  onClearGeo: () => void
  onNext: () => void
}) {
  return (
    <div>
      {/* Regency grid */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Kabupaten</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {REGENCIES.map(r => (
            <button
              key={r.key}
              type="button"
              disabled={!r.active}
              onClick={() => r.active && onSelectRegency(r.key)}
              style={{
                padding: '7px 6px', borderRadius: 7, border: '1px solid',
                borderColor: selectedRegency === r.key ? 'rgba(196,168,130,0.5)' : r.active ? '#2A2A2A' : '#181818',
                background: selectedRegency === r.key ? 'rgba(196,168,130,0.08)' : r.active ? '#111111' : '#0D0D0D',
                color: selectedRegency === r.key ? '#C4A882' : r.active ? '#7A7168' : '#2E2A26',
                fontSize: 11, fontFamily: 'var(--font-outfit)', fontWeight: 500,
                cursor: r.active ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}
            >
              {r.label}
              {!r.active && <span style={{ fontSize: 8, fontFamily: 'var(--font-dm-mono)', color: '#2A2520', letterSpacing: '0.04em' }}>bientôt</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Zone chips — grouped, horizontally scrollable */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Zone (Badung)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BADUNG_ZONE_GROUPS.map(g => (
            <div key={g.group}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#444', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 5 }}>{g.group}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {g.zones.map(z => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => onSelectZone(z)}
                    style={{
                      padding: '4px 10px', borderRadius: 14, border: '1px solid', flexShrink: 0,
                      borderColor: selectedZone === z ? 'rgba(196,168,130,0.45)' : '#232323',
                      background: selectedZone === z ? 'rgba(196,168,130,0.08)' : 'transparent',
                      color: selectedZone === z ? '#C4A882' : '#6A6158',
                      fontSize: 11, fontFamily: 'var(--font-outfit)', fontWeight: 500,
                      cursor: 'pointer', transition: 'all 0.18s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {z}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: '#1A1A1A' }} />
        <span style={{ fontSize: 9, color: '#3A3530', fontWeight: 600, fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.08em' }}>OU ADRESSE GPS</span>
        <div style={{ flex: 1, height: 1, background: '#1A1A1A' }} />
      </div>

      {/* Address */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Adresse exacte du bien</label>
        <AddressAutocomplete
          value={address}
          onChange={(val) => { onAddressChange(val); if (!val.trim()) onClearGeo() }}
          onSelect={onAddressSelect}
        />
        {geoCoords && (
          <div style={{ marginTop: 6, fontSize: 10, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-outfit)' }}>
            <span style={{ color: '#4ADE80' }}>✓</span>
            <span style={{ color: '#4A5A50', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {geoCoords.label.slice(0, 70)}{geoCoords.label.length > 70 ? '…' : ''}
            </span>
            <button type="button" onClick={onClearGeo} style={{ background: 'none', border: 'none', color: '#5A5148', cursor: 'pointer', fontSize: 10, flexShrink: 0 }}>✕</button>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!selectedZone && !geoCoords}
        style={{
          width: '100%', padding: '11px', borderRadius: 8, border: 'none',
          cursor: (!selectedZone && !geoCoords) ? 'not-allowed' : 'pointer',
          background: (!selectedZone && !geoCoords) ? '#181818' : 'linear-gradient(135deg, #C4A882, #8B6F47)',
          color: (!selectedZone && !geoCoords) ? '#3A3530' : '#0A0A0A',
          fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.01em',
          transition: 'all 0.2s',
        }}
      >
        Suivant →
      </button>
    </div>
  )
}

// ── Step 2: Le Bien ────────────────────────────────────────────────────────

function Step2({
  projectType, onSelectType,
  bedrooms, onBedroomsChange,
  landArea, onLandAreaChange,
  onBack, onNext,
}: {
  projectType: string
  onSelectType: (k: string) => void
  bedrooms: string
  onBedroomsChange: (v: string) => void
  landArea: string
  onLandAreaChange: (v: string) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div>
      {/* Project type — 2 cards, full width */}
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>Type de bien</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PROJECT_TYPES.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => onSelectType(t.key)}
              style={{
                padding: '12px 10px', borderRadius: 9, border: '1px solid',
                borderColor: projectType === t.key ? 'rgba(196,168,130,0.45)' : '#232323',
                background: projectType === t.key ? 'rgba(196,168,130,0.07)' : '#111111',
                cursor: 'pointer', transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 20, color: projectType === t.key ? '#C4A882' : '#4A4540' }}>{t.icon}</span>
              <span style={{ fontSize: 13, fontFamily: 'var(--font-outfit)', fontWeight: 600, color: projectType === t.key ? '#C4A882' : '#8A8178' }}>{t.label}</span>
              <span style={{ fontSize: 10, fontFamily: 'var(--font-outfit)', color: '#3A3530' }}>{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bedrooms + Land area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Chambres</label>
          <div style={{ display: 'flex', gap: 5 }}>
            {['1', '2', '3', '4', '5+'].map(b => (
              <button
                key={b}
                type="button"
                onClick={() => onBedroomsChange(b)}
                style={{
                  flex: 1, padding: '8px 4px', borderRadius: 6, border: '1px solid',
                  borderColor: bedrooms === b ? 'rgba(196,168,130,0.45)' : '#232323',
                  background: bedrooms === b ? 'rgba(196,168,130,0.08)' : '#111111',
                  color: bedrooms === b ? '#C4A882' : '#6A6158',
                  fontSize: 11, fontFamily: 'var(--font-dm-mono)', cursor: 'pointer', transition: 'all 0.18s',
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Terrain (are)</label>
          <input
            type="number"
            min={1}
            placeholder="ex. 3"
            value={landArea}
            onChange={e => onLandAreaChange(e.target.value)}
            style={inputBase}
          />
          <div style={{ marginTop: 4, fontSize: 9, color: '#3A3530', fontFamily: 'var(--font-dm-mono)' }}>1 are = 100 m²</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onBack} style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: 7, border: '1px solid #2A2A2A', background: 'transparent', color: '#6A6158', fontSize: 12, fontFamily: 'var(--font-outfit)', cursor: 'pointer' }}>
          ←
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!projectType || !bedrooms}
          style={{
            flex: 1, padding: '11px', borderRadius: 8, border: 'none',
            cursor: (!projectType || !bedrooms) ? 'not-allowed' : 'pointer',
            background: (!projectType || !bedrooms) ? '#181818' : 'linear-gradient(135deg, #C4A882, #8B6F47)',
            color: (!projectType || !bedrooms) ? '#3A3530' : '#0A0A0A',
            fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.01em',
            transition: 'all 0.2s',
          }}
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Tarif & Bail ───────────────────────────────────────────────────

function Step3({
  priceDisplay, onPriceChange,
  acquisitionDisplay, onAcquisitionChange,
  tenure, onTenureChange,
  leaseDurationRaw, onLeaseDurationChange,
  // recap
  selectedZone, geoCoords, projectType, bedrooms,
  onBack, onSubmit, loading,
}: {
  priceDisplay: string
  onPriceChange: (v: string) => void
  acquisitionDisplay: string
  onAcquisitionChange: (v: string) => void
  tenure: 'leasehold' | 'freehold'
  onTenureChange: (v: 'leasehold' | 'freehold') => void
  leaseDurationRaw: string
  onLeaseDurationChange: (v: string) => void
  selectedZone: string
  geoCoords: { lat: number; lng: number; label: string } | null
  projectType: string
  bedrooms: string
  onBack: () => void
  onSubmit: () => void
  loading: boolean
}) {
  return (
    <div>
      <div style={{ marginBottom: 8, fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Votre bien et votre projet
      </div>

      {/* Ligne 1 : Prix / nuit + Prix d'acquisition */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10, alignItems: 'start' }}>
        <div>
          <label style={labelStyle}>Prix / nuit envisagé (USD)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882', pointerEvents: 'none' }}>$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="250"
              value={priceDisplay}
              onChange={e => onPriceChange(formatThousands(e.target.value))}
              style={{ ...inputBase, paddingLeft: 24, fontSize: 14 }}
            />
          </div>
          <div style={{ marginTop: 4, fontSize: 9, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.4 }}>Comparé aux données Airbnb réelles</div>
        </div>
        <div>
          <label style={labelStyle}>Prix d&apos;acquisition total (USD) <span style={{ color: '#2E2A26' }}>— optionnel</span></label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#5A5148', pointerEvents: 'none' }}>$</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="350,000"
              value={acquisitionDisplay}
              onChange={e => onAcquisitionChange(formatThousands(e.target.value))}
              style={{ ...inputBase, paddingLeft: 24 }}
            />
          </div>
          <div style={{ marginTop: 4, fontSize: 9, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', lineHeight: 1.4 }}>Pour calculer le ROI dans le rapport</div>
        </div>
      </div>

      {/* Ligne 2 : Boutons bail + Durée (si leasehold) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14, alignItems: 'start' }}>
        <div>
          <label style={labelStyle}>Type de bail</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['leasehold', 'freehold'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => onTenureChange(t)}
                style={{
                  flex: 1, padding: '9px 6px', borderRadius: 7, border: '1px solid',
                  borderColor: tenure === t ? 'rgba(196,168,130,0.45)' : '#232323',
                  background: tenure === t ? 'rgba(196,168,130,0.07)' : '#111111',
                  color: tenure === t ? '#C4A882' : '#6A6158',
                  fontSize: 11, fontFamily: 'var(--font-outfit)', fontWeight: tenure === t ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >
                {t === 'leasehold' ? 'Leasehold' : 'Freehold (SHM)'}
              </button>
            ))}
          </div>
        </div>
        <div>
          {tenure === 'leasehold' && (
            <>
              <label style={labelStyle}>Durée du bail</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Ex. 27"
                  value={leaseDurationRaw}
                  onChange={e => onLeaseDurationChange(e.target.value)}
                  style={{ ...inputBase, paddingRight: 34 }}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#5A5148', fontFamily: 'var(--font-dm-mono)', pointerEvents: 'none' }}>ans</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Compact recap — inline */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '10px 12px', background: '#0D0D0D', border: '1px solid #191919', borderRadius: 8, marginBottom: 14 }}>
        {[
          ['Localisation', geoCoords ? geoCoords.label.slice(0, 28) + '…' : selectedZone || '—'],
          ['Type', PROJECT_TYPES.find(t => t.key === projectType)?.label ?? '—'],
          ['Chambres', bedrooms ? `${bedrooms} ch.` : '—'],
          ['Tarif/nuit', priceDisplay ? `$${priceDisplay}` : '—'],
          ['Bail', tenure === 'leasehold' ? `Lease ${leaseDurationRaw || '?'} ans` : 'Freehold'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#3A3530', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</span>
            <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#7A7168' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onBack} style={{ flex: '0 0 auto', padding: '10px 16px', borderRadius: 7, border: '1px solid #2A2A2A', background: 'transparent', color: '#6A6158', fontSize: 12, fontFamily: 'var(--font-outfit)', cursor: 'pointer' }}>
          ←
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          style={{
            flex: 1, padding: '12px', borderRadius: 8, border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading ? '#181818' : 'linear-gradient(135deg, #C4A882, #8B6F47)',
            color: loading ? '#3A3530' : '#0A0A0A',
            fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.01em',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Analyse en cours…' : 'Lancer l\'analyse →'}
        </button>
      </div>
    </div>
  )
}

// ── Results ────────────────────────────────────────────────────────────────

// ── Seasonality & GISTARU helpers ─────────────────────────────────────────

const BALI_SEASONALITY = [
  { month: 'Jan', h: 45 }, { month: 'Fév', h: 40 }, { month: 'Mar', h: 48 },
  { month: 'Avr', h: 58 }, { month: 'Mai', h: 62 }, { month: 'Jui', h: 72 },
  { month: 'Jul', h: 100 }, { month: 'Aoû', h: 95 }, { month: 'Sep', h: 68 },
  { month: 'Oct', h: 62 }, { month: 'Nov', h: 50 }, { month: 'Déc', h: 82 },
]

const GISTARU_TOURISM = new Set([
  'Canggu', 'Pererenan', 'Berawa', 'Batu Bolong', 'Echo Beach', 'Nelayan',
  'Seseh', 'Cemagi', 'Munggu', 'Nyanyi', 'Seminyak', 'Legian', 'Kuta',
  'Uluwatu', 'Bingin', 'Padang Padang', 'Ungasan', 'Pandawa',
])
const GISTARU_MIXED = new Set([
  'Kerobokan', 'Umalas', 'Cepaka', 'Babakan', 'Padonan',
  'Kayu Tulang', 'Tumbak Bayuh', 'Buduk',
])

function getGistaruStatus(zone: string | null) {
  if (!zone) return { label: 'Zone inconnue · Données insuffisantes', color: '#9CA3AF', bg: 'rgba(156,163,175,0.07)', border: 'rgba(156,163,175,0.2)' }
  if (GISTARU_TOURISM.has(zone)) return { label: 'Zone Tourisme · Compatible STR ✓', color: '#4ADE80', bg: 'rgba(74,222,128,0.07)', border: 'rgba(74,222,128,0.2)' }
  if (GISTARU_MIXED.has(zone)) return { label: 'Zone Mixte · Vérification recommandée ⚠', color: '#FB923C', bg: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.2)' }
  return { label: 'Zone Agricole · STR non autorisé ✗', color: '#F87171', bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.2)' }
}

// ── SeasonalityChart ───────────────────────────────────────────────────────

function SeasonalityChart() {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '14px 14px 10px' }}>
      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4540', marginBottom: 12 }}>Saisonnalité mensuelle</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, position: 'relative' }}>
        {BALI_SEASONALITY.map((m, i) => {
          const isHigh = m.h >= 80
          const isMid  = m.h >= 55 && m.h < 80
          const barH   = Math.round((m.h / 100) * 52)
          return (
            <div
              key={m.month}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'default', position: 'relative' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {hovered === i && (
                <div style={{
                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                  background: '#1E1E1E', border: '1px solid #2A2A2A', borderRadius: 5,
                  padding: '4px 7px', whiteSpace: 'nowrap', zIndex: 10, marginBottom: 4,
                  fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#8A8178',
                }}>
                  Valeur disponible dans le rapport complet
                </div>
              )}
              <div style={{
                width: '100%', height: barH,
                background: isHigh ? '#4ADE80' : isMid ? '#86EFAC' : '#1E3A2A',
                borderRadius: '2px 2px 0 0',
                opacity: hovered === i ? 1 : 0.85,
                transition: 'opacity 0.15s',
              }} />
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 7, color: '#3A3530', letterSpacing: 0 }}>{m.month}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Results ────────────────────────────────────────────────────────────────

function Results({ result, onReset, userNightlyPrice, acquisitionPrice, formDataKey, directCheckout }: {
  result: ComparablesResult
  onReset: () => void
  userNightlyPrice: number | null
  acquisitionPrice: number | null
  formDataKey?: string
  directCheckout?: boolean
}) {
  const [stripeLoading, setStripeLoading] = useState(false)
  const { open: openModal } = useAuthModal()
  const verdict = VERDICT_CONFIG[result.verdict]

  const p25 = result.price_p25 ?? 0
  const p75 = result.price_p75 ?? 0
  const range = p75 - p25 || 1

  // Market position of user price
  const posPct = userNightlyPrice != null && p75 > 0
    ? Math.min(100, Math.max(0, ((userNightlyPrice - p25) / range) * 100))
    : result.price_avg != null && p75 > 0
    ? Math.min(100, Math.max(0, ((result.price_avg - p25) / range) * 100))
    : null

  // Pessimiste scenario (revealed)
  const pessPrice = userNightlyPrice ?? result.price_median ?? 0
  const pessBrut  = Math.round(pessPrice * 365 * 0.50)
  const pessNet   = Math.round(pessBrut * 0.65)
  const pessRoi   = acquisitionPrice ? ((pessNet / acquisitionPrice) * 100).toFixed(1) : null

  // GISTARU
  const gistaru = getGistaruStatus(result.zone)

  async function handleCheckout() {
    setStripeLoading(true)
    try {
      if (directCheckout) {
        // Dashboard mode: user is already authenticated, go straight to Stripe
        const res = await fetch('/api/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: 'once' }),
        })
        const data = await res.json()
        if (data.error) { alert(data.error); return }
        if (data.url) window.location.href = data.url
        return
      }

      // Standard flow: check auth first
      const meRes = await fetch('/api/me')
      const me = await meRes.json()

      if (!me.loggedIn) {
        if (formDataKey) sessionStorage.setItem('pendingCheckout', formDataKey)
        openModal()
        return
      }

      if (!me.isPaid) {
        window.location.href = '/pricing'
        return
      }

      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'once' }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      if (data.url) window.location.href = data.url
    } finally {
      setStripeLoading(false)
    }
  }

  const cardBase: React.CSSProperties = { background: '#111111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '13px 14px' }
  const monoLabel: React.CSSProperties = { fontFamily: 'var(--font-dm-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4540', marginBottom: 6 }
  const monoLine: React.CSSProperties = { fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#5A5148', marginBottom: 3 }

  return (
    <div>
      {/* Back */}
      <button type="button" onClick={onReset}
        style={{ background: 'none', border: 'none', color: '#5A5148', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-outfit)', marginBottom: 14, padding: 0 }}>
        ← Nouvelle analyse
      </button>

      {result.insufficient_data_message && (
        <div style={{ background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.2)', borderRadius: 8, padding: '9px 13px', color: '#FB923C', fontSize: 11, marginBottom: 10 }}>
          ⚠ {result.insufficient_data_message}
        </div>
      )}

      {/* ── Verdict ── */}
      <div style={{ background: verdict.bg, border: `1px solid ${verdict.border}`, borderRadius: 12, padding: '18px 20px', textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: verdict.color, opacity: 0.7, marginBottom: 5 }}>Verdict de positionnement Airbnb</div>
        <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 44, fontWeight: 700, color: verdict.color, lineHeight: 1, marginBottom: 5 }}>{verdict.label}</div>
        {result.variance_pct != null && (
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: verdict.color, opacity: 0.85, marginBottom: 5 }}>
            {result.variance_pct > 0 ? '+' : ''}{result.variance_pct.toFixed(1)}% vs médiane du marché Airbnb
          </div>
        )}
        <div style={{ fontSize: 12, color: '#6A6158', fontFamily: 'var(--font-outfit)' }}>{verdict.desc}</div>
      </div>

      {/* ── Key stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        <div style={cardBase}>
          <div style={monoLabel}>Prix médian Airbnb</div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 20, color: '#F0EAE2', lineHeight: 1.1, marginBottom: 2 }}>{fmt(result.price_median)}</div>
          <div style={{ fontSize: 10, color: '#3A3530' }}>par nuit · {result.zone ?? 'GPS'}</div>
        </div>
        <div style={cardBase}>
          <div style={monoLabel}>Taux d&apos;occupation médian</div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 20, color: '#F0EAE2', lineHeight: 1.1, marginBottom: 2 }}>65%</div>
          <div style={{ fontSize: 10, color: '#3A3530' }}>estimation marché Bali</div>
        </div>
        <div style={cardBase}>
          <div style={monoLabel}>Comparables analysés</div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 20, color: '#F0EAE2', lineHeight: 1.1, marginBottom: 2 }}>{result.listings_count}</div>
          <div style={{ fontSize: 10, color: '#3A3530' }}>{result.radius_used != null ? `rayon ${result.radius_used}km` : 'données Airbnb réelles'}</div>
        </div>
      </div>

      {/* ── Market position scale ── */}
      <div style={{ ...cardBase, marginBottom: 10 }}>
        <div style={monoLabel}>Positionnement sur le marché</div>
        <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'linear-gradient(90deg, #4ADE80 0%, #FB923C 60%, #F87171 100%)', marginBottom: 6 }}>
          {posPct != null && (
            <div style={{ position: 'absolute', top: '50%', left: `${posPct}%`, transform: 'translate(-50%,-50%)', width: 14, height: 14, borderRadius: '50%', background: '#C4A882', border: '2px solid #0A0A0A', boxShadow: '0 0 0 2px #C4A882' }} />
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#3A3530', fontFamily: 'var(--font-dm-mono)' }}>
          <span>Entrée de gamme · {fmt(result.price_p25)}</span>
          <span>Médiane · {fmt(result.price_median)}</span>
          <span>Haut de gamme · {fmt(result.price_p75)}</span>
        </div>
      </div>

      {/* ── 1. Revenue cards — bullets for amounts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {/* Net annual */}
        <div style={{ ...cardBase, border: '1px solid rgba(196,168,130,0.18)' }}>
          <div style={monoLabel}>Revenu net annuel estimé</div>
          <div style={monoLine}>Base de calcul : médiane × 30j × 65%</div>
          <div style={monoLine}>Charges déduites (gestion, Airbnb, fiscalité)</div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 18, color: '#C4A882', marginTop: 6 }}>•• ••• USD / an</div>
        </div>
        {/* Gross monthly */}
        <div style={cardBase}>
          <div style={monoLabel}>Revenu brut mensuel estimé</div>
          <div style={monoLine}>Prix médian × occupation × 30 jours</div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 18, color: '#C4A882', marginTop: 6 }}>• ••• USD / mois</div>
        </div>
      </div>

      {/* ── 2. 3 Scenarios — pessimiste revealed ── */}
      <div style={{ ...cardBase, marginBottom: 10 }}>
        <div style={monoLabel}>Scénarios de rendement</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {/* Pessimiste — real data */}
          <div style={{ background: '#0D0D0D', border: '1px solid #232323', borderRadius: 8, padding: '12px 12px' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#5A5148', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Pessimiste</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div>
                <div style={{ fontSize: 8, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', marginBottom: 1 }}>Occupation</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#E8E0D4' }}>50%</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', marginBottom: 1 }}>Tarif / nuit</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#E8E0D4' }}>{userNightlyPrice ? `$${userNightlyPrice.toLocaleString('en-US')}` : fmt(result.price_median)}</div>
              </div>
              <div>
                <div style={{ fontSize: 8, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', marginBottom: 1 }}>Revenu net / an</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#4ADE80' }}>${pessNet.toLocaleString('en-US')}</div>
              </div>
              {pessRoi && (
                <div>
                  <div style={{ fontSize: 8, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', marginBottom: 1 }}>ROI net</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#4ADE80' }}>{pessRoi}%</div>
                </div>
              )}
            </div>
          </div>

          {/* Réaliste — locked amounts */}
          {(['Réaliste', 'Optimiste'] as const).map(label => (
            <div key={label} style={{ background: '#0D0D0D', border: '1px solid #232323', borderRadius: 8, padding: '12px 12px' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#5A5148', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div>
                  <div style={{ fontSize: 8, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', marginBottom: 1 }}>Occupation</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#E8E0D4' }}>{label === 'Réaliste' ? '65%' : '75%'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', marginBottom: 1 }}>Tarif / nuit</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#E8E0D4' }}>{userNightlyPrice ? `$${userNightlyPrice.toLocaleString('en-US')}` : fmt(result.price_median)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', marginBottom: 1 }}>Revenu net / an</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882' }}>••,••• USD</div>
                </div>
                <div>
                  <div style={{ fontSize: 8, color: '#3A3530', fontFamily: 'var(--font-dm-mono)', marginBottom: 1 }}>ROI net</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882' }}>••,•• %</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Comparables — 1 revealed, 2 masked ── */}
      <div style={{ ...cardBase, marginBottom: 10 }}>
        <div style={monoLabel}>3 biens comparables proches</div>
        {result.nearest_listings.length === 0 ? (
          <div style={{ fontSize: 11, color: '#3A3530', fontFamily: 'var(--font-outfit)' }}>Aucun comparable GPS trouvé.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[0, 1, 2].map(i => {
              const l = result.nearest_listings[i]
              if (!l) return null
              const isRevealed = i === 0
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < 2 ? '1px solid #191919' : 'none' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#3A3530', minWidth: 16 }}>#{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-outfit)', fontWeight: 600, color: isRevealed ? '#C4A882' : '#3A3530', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isRevealed ? l.title : '••••••••••••••••'}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 9, color: '#3A3530', fontFamily: 'var(--font-dm-mono)' }}>{l.distance_km} km</span>
                      <span style={{ fontSize: 9, color: isRevealed ? '#5A5148' : '#3A3530', fontFamily: 'var(--font-dm-mono)' }}>
                        {isRevealed ? '65% occupation' : '— occupation'}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: '#F0EAE2', whiteSpace: 'nowrap' }}>
                    {fmt(l.price_per_night_usd)}<span style={{ fontSize: 9, color: '#3A3530' }}>/nuit</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── 4. Seasonality chart ── */}
      <div style={{ marginBottom: 10 }}>
        <SeasonalityChart />
      </div>

      {/* ── 5. GISTARU badge ── */}
      <div style={{ ...cardBase, marginBottom: 16 }}>
        <div style={monoLabel}>Zonage GISTARU</div>
        <div style={{ display: 'inline-block', background: gistaru.bg, border: `1px solid ${gistaru.border}`, borderRadius: 8, padding: '6px 12px', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: gistaru.color, fontWeight: 600 }}>{gistaru.label}</span>
        </div>
        <div style={{ fontSize: 10, color: '#3A3530', fontFamily: 'var(--font-dm-mono)' }}>Analyse complète GISTARU disponible dans le rapport</div>
      </div>

      {/* ── 6. Single CTA banner ── */}
      <div style={{ background: 'linear-gradient(135deg, #C4A882, #8B6F47)', borderRadius: 12, padding: '24px 22px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 20, fontWeight: 700, color: '#0A0A0A', marginBottom: 8 }}>
          Débloquer mon rapport complet
        </div>
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: 'rgba(10,10,10,0.65)', marginBottom: 18, lineHeight: 1.5 }}>
          Scénarios de revenus complets · 3 comparables détaillés · Saisonnalité chiffrée · Analyse GISTARU
        </div>
        <button
          onClick={handleCheckout}
          disabled={stripeLoading}
          style={{
            width: '100%', padding: '13px', borderRadius: 9, border: '2px solid rgba(10,10,10,0.25)',
            cursor: stripeLoading ? 'not-allowed' : 'pointer',
            background: stripeLoading ? 'rgba(10,10,10,0.15)' : 'rgba(10,10,10,0.12)',
            color: stripeLoading ? 'rgba(10,10,10,0.4)' : '#0A0A0A',
            fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.01em',
            transition: 'all 0.2s',
          }}
        >
          {stripeLoading ? 'Redirection…' : 'Obtenir le rapport complet — $29 →'}
        </button>
        <p style={{ fontSize: 9, color: 'rgba(10,10,10,0.4)', marginTop: 10, fontFamily: 'var(--font-dm-mono)' }}>
          Données Airbnb Bali · {result.zone ?? 'GPS'} · Paiement sécurisé via Stripe
        </p>
      </div>
    </div>
  )
}

// ── Main AnalysisForm ──────────────────────────────────────────────────────

export function AnalysisForm({ directCheckout = false }: { directCheckout?: boolean }) {
  const [step, setStep] = useState(1)

  // Step 1
  const [selectedRegency, setSelectedRegency] = useState('badung')
  const [selectedZone, setSelectedZone] = useState('')
  const [address, setAddress] = useState('')
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number; label: string } | null>(null)

  // Step 2
  const [projectType, setProjectType] = useState('villa')
  const [bedrooms, setBedrooms] = useState('2')
  const [landArea, setLandArea] = useState('')

  // Step 3
  const [priceDisplay, setPriceDisplay] = useState('')
  const [acquisitionDisplay, setAcquisitionDisplay] = useState('')
  const [tenure, setTenure] = useState<'leasehold' | 'freehold'>('leasehold')
  const [leaseDurationRaw, setLeaseDurationRaw] = useState('')

  // Result
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComparablesResult | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)

  const handleAddressSelect = useCallback((place: PlaceResult) => {
    setAddress(place.label)
    setGeoCoords(place)
    setSelectedZone('')
  }, [])

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setResult(null)
    setApiError(null)
    try {
      const rawPrice = priceDisplay.replace(/,/g, '')
      const body: Record<string, unknown> = {
        bedrooms: bedrooms === '5+' ? undefined : parseInt(bedrooms),
        price_announced: rawPrice ? parseFloat(rawPrice) : undefined,
      }
      if (geoCoords) {
        body.lat = geoCoords.lat; body.lng = geoCoords.lng; body.radius_km = 1.0
      } else {
        body.zone = selectedZone
      }
      const res = await fetch('/api/comparables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [priceDisplay, bedrooms, geoCoords, selectedZone])

  if (result) {
    const userNightlyPrice = priceDisplay ? parseFloat(priceDisplay.replace(/,/g, '')) : null
    const acquisitionPrice = acquisitionDisplay ? parseFloat(acquisitionDisplay.replace(/,/g, '')) : null
    // Persist form data so it can be recovered after auth redirect
    const formDataKey = `formData_${selectedZone || 'gps'}_${bedrooms}`
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(formDataKey, JSON.stringify({ zone: selectedZone, bedrooms, projectType, priceDisplay }))
    }
    return (
      <Results
        result={result}
        onReset={() => { setResult(null); setStep(1) }}
        userNightlyPrice={isNaN(userNightlyPrice as number) ? null : userNightlyPrice}
        acquisitionPrice={isNaN(acquisitionPrice as number) ? null : acquisitionPrice}
        formDataKey={formDataKey}
        directCheckout={directCheckout}
      />
    )
  }

  return (
    <div>
      <StepIndicator current={step} />

      {apiError && (
        <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 12, marginBottom: 14, fontFamily: 'var(--font-outfit)' }}>
          Erreur : {apiError}
        </div>
      )}

      {step === 1 && (
        <Step1
          selectedRegency={selectedRegency}
          onSelectRegency={setSelectedRegency}
          selectedZone={selectedZone}
          onSelectZone={(z) => { setSelectedZone(z); setGeoCoords(null); setAddress('') }}
          address={address}
          onAddressChange={setAddress}
          onAddressSelect={handleAddressSelect}
          geoCoords={geoCoords}
          onClearGeo={() => { setGeoCoords(null); setAddress('') }}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2
          projectType={projectType}
          onSelectType={setProjectType}
          bedrooms={bedrooms}
          onBedroomsChange={setBedrooms}
          landArea={landArea}
          onLandAreaChange={setLandArea}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3
          priceDisplay={priceDisplay}
          onPriceChange={setPriceDisplay}
          acquisitionDisplay={acquisitionDisplay}
          onAcquisitionChange={setAcquisitionDisplay}
          tenure={tenure}
          onTenureChange={setTenure}
          leaseDurationRaw={leaseDurationRaw}
          onLeaseDurationChange={setLeaseDurationRaw}
          selectedZone={selectedZone}
          geoCoords={geoCoords}
          projectType={projectType}
          bedrooms={bedrooms}
          onBack={() => setStep(2)}
          onSubmit={runAnalysis}
          loading={loading}
        />
      )}
    </div>
  )
}
