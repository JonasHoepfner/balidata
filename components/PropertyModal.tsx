'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AddressAutocomplete, type PlaceResult } from '@/components/AddressAutocomplete'

// ── Types ──────────────────────────────────────────────────────────────────

export type PropertyFormData = {
  title: string
  property_type: string
  bedrooms: number | null
  zone: string
  address: string
  current_price_night: number | null
  acquisition_price: number | null
  lease_type: string
  lease_duration: number | null
  weekly_alerts: boolean
  latitude?: number | null
  longitude?: number | null
}

export type PropertyModalProps = {
  mode: 'create' | 'edit'
  initial?: Partial<PropertyFormData> & { id?: string }
  onClose: () => void
  onSaved: () => void
}

// ── Zone groups ────────────────────────────────────────────────────────────

const ZONE_GROUPS = [
  {
    group: 'CANGGU',
    zones: ['Berawa', 'Batu Bolong', 'Echo Beach', 'Pererenan', 'Seseh', 'Cemagi', 'Umalas'],
  },
  {
    group: 'SEMINYAK',
    zones: ['Seminyak', 'Kerobokan', 'Kuta', 'Legian'],
  },
  {
    group: 'BUKIT',
    zones: ['Uluwatu', 'Bingin', 'Padang Padang', 'Ungasan'],
  },
]

const PROPERTY_TYPES = ['Villa', 'Apartment', 'Guesthouse', 'Hotel'] as const
const LEASE_TYPES = ['Leasehold', 'Freehold'] as const

// ── Shared styles ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0A0A0A', border: '1px solid #232323',
  borderRadius: 7, padding: '10px 12px', color: '#E8E0D4',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--font-outfit)',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 9, fontWeight: 500, letterSpacing: '0.1em',
  textTransform: 'uppercase', color: '#4A4540', marginBottom: 7,
  fontFamily: 'var(--font-dm-mono)',
}

function FieldGroup({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={labelStyle}>{label}</div>
      {children}
    </div>
  )
}

function PriceInput({ value, onChange, placeholder }: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
}) {
  const [display, setDisplay] = useState(
    value != null ? value.toLocaleString('en-US') : ''
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (!raw) { setDisplay(''); onChange(null); return }
    const num = parseInt(raw, 10)
    setDisplay(num.toLocaleString('en-US'))
    onChange(num)
  }

  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#4A4540', pointerEvents: 'none',
      }}>$</span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder ?? '0'}
        style={{ ...inputStyle, paddingLeft: 24 }}
      />
    </div>
  )
}

function SelectButton({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '9px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(196,168,130,0.12)' : '#111',
        color: active ? '#C4A882' : '#555',
        fontFamily: 'var(--font-outfit)', fontSize: 13,
        outline: active ? '1px solid rgba(196,168,130,0.4)' : '1px solid #1E1E1E',
        transition: 'all 0.15s', fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export default function PropertyModal({ mode, initial, onClose, onSaved }: PropertyModalProps) {
  const [form, setForm] = useState<PropertyFormData>({
    title: initial?.title ?? '',
    property_type: initial?.property_type ?? '',
    bedrooms: initial?.bedrooms ?? null,
    zone: initial?.zone ?? '',
    address: initial?.address ?? '',
    current_price_night: initial?.current_price_night ?? null,
    acquisition_price: initial?.acquisition_price ?? null,
    lease_type: initial?.lease_type ?? '',
    lease_duration: initial?.lease_duration ?? null,
    weekly_alerts: initial?.weekly_alerts ?? true,
    latitude: initial?.latitude ?? null,
    longitude: initial?.longitude ?? null,
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function set<K extends keyof PropertyFormData>(k: K, v: PropertyFormData[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Le nom de la propriété est requis.'); return }
    if (!form.current_price_night) { setError('Le prix par nuit est requis.'); return }
    setSaving(true)
    setError(null)
    try {
      const url = mode === 'edit' && initial?.id
        ? `/api/properties/${initial.id}`
        : '/api/properties'
      const method = mode === 'edit' ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          property_type: form.property_type.toLowerCase(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur lors de la sauvegarde.'); return }
      onSaved()
      onClose()
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        background: '#111', border: '1px solid #2A2A2A', borderRadius: 14,
        padding: '36px 32px', width: '100%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <style>{`
          .pm-scroll::-webkit-scrollbar { width: 4px }
          .pm-scroll::-webkit-scrollbar-track { background: #0A0A0A }
          .pm-scroll::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 2px }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 26, fontWeight: 600, color: '#F0EAE2' }}>
            {mode === 'edit' ? 'Edit property' : 'Add a property'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Property name */}
          <FieldGroup label="Property name *">
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="ex. Villa Serenity"
              style={inputStyle}
              required
            />
          </FieldGroup>

          {/* Type */}
          <FieldGroup label="Type">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PROPERTY_TYPES.map(t => (
                <SelectButton
                  key={t} label={t}
                  active={form.property_type.toLowerCase() === t.toLowerCase()}
                  onClick={() => set('property_type', t)}
                />
              ))}
            </div>
          </FieldGroup>

          {/* Bedrooms */}
          <FieldGroup label="Bedrooms">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <SelectButton
                  key={n} label={n === 5 ? '5+' : String(n)}
                  active={form.bedrooms === n}
                  onClick={() => set('bedrooms', n)}
                />
              ))}
            </div>
          </FieldGroup>

          {/* Zone */}
          <FieldGroup label="Zone">
            {ZONE_GROUPS.map(g => (
              <div key={g.group} style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#3A3530', letterSpacing: '0.1em', marginBottom: 6 }}>{g.group}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {g.zones.map(z => (
                    <button
                      key={z} type="button"
                      onClick={() => set('zone', z)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: form.zone === z ? 'rgba(196,168,130,0.12)' : '#161616',
                        color: form.zone === z ? '#C4A882' : '#555',
                        fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.04em',
                        outline: form.zone === z ? '1px solid rgba(196,168,130,0.4)' : '1px solid transparent',
                        transition: 'all 0.12s',
                      }}
                    >
                      {z}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </FieldGroup>

          {/* Address */}
          <FieldGroup label="Address (optional)">
            <AddressAutocomplete
              value={form.address}
              onChange={v => set('address', v)}
              onSelect={useCallback((place: PlaceResult) => {
                setForm(f => ({ ...f, address: place.label, latitude: place.lat, longitude: place.lng }))
              }, [])}
            />
          </FieldGroup>

          {/* Current nightly rate */}
          <FieldGroup label={<>CURRENT NIGHTLY RATE <span style={{ color: '#4A4540', fontWeight: 400 }}>$ USD</span></>}>
            <PriceInput
              value={form.current_price_night}
              onChange={v => set('current_price_night', v)}
              placeholder="0"
            />
          </FieldGroup>

          {/* Acquisition price */}
          <FieldGroup label={<>ACQUISITION PRICE <span style={{ color: '#4A4540', fontWeight: 400 }}>$ USD</span></>}>
            <PriceInput
              value={form.acquisition_price}
              onChange={v => set('acquisition_price', v)}
              placeholder="0"
            />
          </FieldGroup>

          {/* Lease type */}
          <FieldGroup label="Lease type">
            <div style={{ display: 'flex', gap: 8 }}>
              {LEASE_TYPES.map(t => (
                <SelectButton
                  key={t} label={t}
                  active={form.lease_type === t}
                  onClick={() => set('lease_type', t)}
                />
              ))}
            </div>
          </FieldGroup>

          {/* Lease duration — only for Leasehold */}
          {form.lease_type === 'Leasehold' && (
            <FieldGroup label="Lease duration (years)">
              <input
                type="number"
                value={form.lease_duration ?? ''}
                onChange={e => set('lease_duration', e.target.value ? Number(e.target.value) : null)}
                placeholder="27 ans"
                min={1}
                max={100}
                style={inputStyle}
              />
            </FieldGroup>
          )}

          {/* Weekly alerts */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0A0A', border: '1px solid #1E1E1E', borderRadius: 8, padding: '14px 16px', marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C8BFB5', marginBottom: 2 }}>Weekly email alerts</div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#4A4540' }}>Receive weekly market insights by email</div>
            </div>
            <div
              onClick={() => set('weekly_alerts', !form.weekly_alerts)}
              style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer', background: form.weekly_alerts ? '#C4A882' : '#2A2A2A', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: 3, left: form.weekly_alerts ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: form.weekly_alerts ? '#0A0A0A' : '#555', transition: 'left 0.2s' }} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#F87171' }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#7A7168', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ flex: 2, padding: '12px', borderRadius: 50, border: 'none', cursor: saving ? 'default' : 'pointer', background: saving ? '#2A2A2A' : 'linear-gradient(135deg, #C4A882, #8B6F47)', color: saving ? '#555' : '#0A0A0A', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)', transition: 'all 0.2s' }}
            >
              {saving ? 'Saving…' : 'Save property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
