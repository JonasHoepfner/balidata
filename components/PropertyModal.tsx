'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { AddressAutocomplete, type PlaceResult } from '@/components/AddressAutocomplete'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

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
  initial?: Partial<PropertyFormData> & { id?: string; images?: string[] }
  onClose: () => void
  onSaved: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────

const ZONE_GROUPS = [
  { group: 'CANGGU',   zones: ['Berawa', 'Batu Bolong', 'Echo Beach', 'Pererenan', 'Seseh', 'Cemagi', 'Umalas'] },
  { group: 'SEMINYAK', zones: ['Seminyak', 'Kerobokan', 'Kuta', 'Legian'] },
  { group: 'BUKIT',    zones: ['Uluwatu', 'Bingin', 'Padang Padang', 'Ungasan'] },
]

const PROPERTY_TYPES = ['Villa', 'Apartment', 'Guesthouse', 'Hotel'] as const
const LEASE_TYPES    = ['Leasehold', 'Freehold'] as const
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const MAX_IMAGES     = 5
const MAX_SIZE_MB    = 5

// ── Shared styles ─────────────────────────────────────────────────────────

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

// ── Sub-components ─────────────────────────────────────────────────────────

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
  const [display, setDisplay] = useState(value != null ? value.toLocaleString('en-US') : '')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (!raw) { setDisplay(''); onChange(null); return }
    const num = parseInt(raw, 10)
    setDisplay(num.toLocaleString('en-US'))
    onChange(num)
  }

  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#4A4540', pointerEvents: 'none' }}>$</span>
      <input type="text" inputMode="numeric" value={display} onChange={handleChange} placeholder={placeholder ?? '0'} style={{ ...inputStyle, paddingLeft: 24 }} />
    </div>
  )
}

function SelectButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '9px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', background: active ? 'rgba(196,168,130,0.12)' : '#111', color: active ? '#C4A882' : '#555', fontFamily: 'var(--font-outfit)', fontSize: 13, outline: active ? '1px solid rgba(196,168,130,0.4)' : '1px solid #1E1E1E', transition: 'all 0.15s', fontWeight: active ? 600 : 400 }}>
      {label}
    </button>
  )
}

function IconCamera() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'block', margin: '0 auto 8px' }}>
      <path d="M9 3H15L17 5H21C21.55 5 22 5.45 22 6V18C22 18.55 21.55 19 21 19H3C2.45 19 2 18.55 2 18V6C2 5.45 2.45 5 3 5H7L9 3Z" stroke="#333" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <circle cx="12" cy="12" r="3.5" stroke="#333" strokeWidth="1.5" fill="none"/>
    </svg>
  )
}

// ── Photo upload section ──────────────────────────────────────────────────

type PhotoSectionProps = {
  files: File[]
  existingUrls: string[]
  onFilesChange: (files: File[]) => void
  onRemoveExisting: (url: string) => void
  uploadError: string | null
}

function PhotoSection({ files, existingUrls, onFilesChange, onRemoveExisting, uploadError }: PhotoSectionProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const totalCount = existingUrls.length + files.length

  function validate(incoming: File[]): { valid: File[]; error: string | null } {
    const valid: File[] = []
    for (const f of incoming) {
      if (!ACCEPTED_TYPES.includes(f.type)) continue
      if (f.size > MAX_SIZE_MB * 1024 * 1024) continue
      valid.push(f)
    }
    const room = MAX_IMAGES - totalCount
    return { valid: valid.slice(0, room), error: null }
  }

  function addFiles(incoming: File[]) {
    const { valid } = validate(incoming)
    if (!valid.length) return
    onFilesChange([...files, ...valid])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function removeNew(idx: number) {
    onFilesChange(files.filter((_, i) => i !== idx))
  }

  const previews = files.map(f => URL.createObjectURL(f))

  return (
    <FieldGroup label="Property Photos">
      {/* Drop zone — only show if under limit */}
      {totalCount < MAX_IMAGES && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            background: '#0D0D0D',
            border: `1px dashed ${dragging ? '#C4A882' : '#2A2A2A'}`,
            borderRadius: 8, padding: '28px 16px', cursor: 'pointer',
            textAlign: 'center', transition: 'border-color 0.15s',
            marginBottom: (existingUrls.length + files.length) > 0 ? 12 : 0,
          }}
        >
          <IconCamera />
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#555', marginBottom: 4 }}>
            Drag photos here or click to upload
          </div>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#333' }}>
            JPG, PNG, WEBP · Max {MAX_IMAGES} photos · {MAX_SIZE_MB}MB each
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(',')} multiple style={{ display: 'none' }} onChange={handleInputChange} />
        </div>
      )}

      {/* Preview grid */}
      {(existingUrls.length + files.length) > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {existingUrls.map(url => (
            <div key={url} style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#0A0A0A' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={() => onRemoveExisting(url)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>
          ))}
          {previews.map((src, i) => (
            <div key={src} style={{ position: 'relative', aspectRatio: '1', borderRadius: 6, overflow: 'hidden', background: '#0A0A0A' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button type="button" onClick={() => removeNew(i)} style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {uploadError && (
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#F87171', marginTop: 6 }}>{uploadError}</div>
      )}
    </FieldGroup>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function PropertyModal({ mode, initial, onClose, onSaved }: PropertyModalProps) {
  const [form, setForm] = useState<PropertyFormData>({
    title:               initial?.title               ?? '',
    property_type:       initial?.property_type       ?? '',
    bedrooms:            initial?.bedrooms             ?? null,
    zone:                initial?.zone                 ?? '',
    address:             initial?.address              ?? '',
    current_price_night: initial?.current_price_night ?? null,
    acquisition_price:   initial?.acquisition_price   ?? null,
    lease_type:          initial?.lease_type           ?? '',
    lease_duration:      initial?.lease_duration       ?? null,
    weekly_alerts:       initial?.weekly_alerts        ?? true,
    latitude:            initial?.latitude             ?? null,
    longitude:           initial?.longitude            ?? null,
  })

  // Images state
  const [newFiles,      setNewFiles]      = useState<File[]>([])
  const [existingUrls,  setExistingUrls]  = useState<string[]>(initial?.images ?? [])
  const [uploadError,   setUploadError]   = useState<string | null>(null)

  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
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

  const handleAddressSelect = useCallback((place: PlaceResult) => {
    setForm(f => ({ ...f, address: place.label, latitude: place.lat, longitude: place.lng }))
  }, [])

  // ── Upload helper ──────────────────────────────────────────────────────

  async function uploadImages(propertyId: string): Promise<string[]> {
    if (!newFiles.length) return []
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return []

    const urls: string[] = []
    for (const file of newFiles) {
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path = `${session.user.id}/${propertyId}/${name}`
      const { error: upErr } = await supabase.storage
        .from('property-images')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) { setUploadError(`Upload failed: ${upErr.message}`); continue }
      const { data } = supabase.storage.from('property-images').getPublicUrl(path)
      urls.push(data.publicUrl)
    }
    return urls
  }

  // ── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim())       { setError('Le nom de la propriété est requis.'); return }
    if (!form.current_price_night) { setError('Le prix par nuit est requis.'); return }
    setSaving(true)
    setError(null)
    setUploadError(null)

    try {
      const url    = mode === 'edit' && initial?.id ? `/api/properties/${initial.id}` : '/api/properties'
      const method = mode === 'edit' ? 'PATCH' : 'POST'

      const res  = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, property_type: form.property_type.toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur lors de la sauvegarde.'); return }

      const propertyId: string = data.property?.id ?? initial?.id
      if (propertyId && newFiles.length > 0) {
        const newUrls   = await uploadImages(propertyId)
        const allImages = [...existingUrls, ...newUrls]
        if (allImages.length > 0) {
          await fetch(`/api/properties/${propertyId}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ images: allImages }),
          })
        }
      } else if (propertyId && existingUrls.length !== (initial?.images?.length ?? 0)) {
        // Some existing images were removed
        await fetch(`/api/properties/${propertyId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ images: existingUrls }),
        })
      }

      onSaved()
      onClose()
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
    >
      <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 14, padding: '36px 32px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>

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
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="ex. Villa Serenity" style={inputStyle} required />
          </FieldGroup>

          {/* Photos */}
          <PhotoSection
            files={newFiles}
            existingUrls={existingUrls}
            onFilesChange={setNewFiles}
            onRemoveExisting={url => setExistingUrls(u => u.filter(x => x !== url))}
            uploadError={uploadError}
          />

          {/* Type */}
          <FieldGroup label="Type">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PROPERTY_TYPES.map(t => (
                <SelectButton key={t} label={t} active={form.property_type.toLowerCase() === t.toLowerCase()} onClick={() => set('property_type', t)} />
              ))}
            </div>
          </FieldGroup>

          {/* Bedrooms */}
          <FieldGroup label="Bedrooms">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <SelectButton key={n} label={n === 5 ? '5+' : String(n)} active={form.bedrooms === n} onClick={() => set('bedrooms', n)} />
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
                    <button key={z} type="button" onClick={() => set('zone', z)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: form.zone === z ? 'rgba(196,168,130,0.12)' : '#161616', color: form.zone === z ? '#C4A882' : '#555', fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.04em', outline: form.zone === z ? '1px solid rgba(196,168,130,0.4)' : '1px solid transparent', transition: 'all 0.12s' }}>
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
              onSelect={handleAddressSelect}
            />
          </FieldGroup>

          {/* Current nightly rate */}
          <FieldGroup label="Current nightly rate — USD *">
            <PriceInput value={form.current_price_night} onChange={v => set('current_price_night', v)} placeholder="0" />
          </FieldGroup>

          {/* Acquisition price */}
          <FieldGroup label="Acquisition price — USD (optional)">
            <PriceInput value={form.acquisition_price} onChange={v => set('acquisition_price', v)} placeholder="0" />
          </FieldGroup>

          {/* Lease type */}
          <FieldGroup label="Lease type">
            <div style={{ display: 'flex', gap: 8 }}>
              {LEASE_TYPES.map(t => (
                <SelectButton key={t} label={t} active={form.lease_type === t} onClick={() => set('lease_type', t)} />
              ))}
            </div>
          </FieldGroup>

          {/* Lease duration */}
          {form.lease_type === 'Leasehold' && (
            <FieldGroup label="Lease duration (years)">
              <input type="number" value={form.lease_duration ?? ''} onChange={e => set('lease_duration', e.target.value ? Number(e.target.value) : null)} placeholder="27 ans" min={1} max={100} style={inputStyle} />
            </FieldGroup>
          )}

          {/* Weekly alerts */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0A0A0A', border: '1px solid #1E1E1E', borderRadius: 8, padding: '14px 16px', marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C8BFB5', marginBottom: 2 }}>Weekly email alerts</div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#4A4540' }}>Receive weekly market insights by email</div>
            </div>
            <div onClick={() => set('weekly_alerts', !form.weekly_alerts)} style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer', background: form.weekly_alerts ? '#C4A882' : '#2A2A2A', transition: 'background 0.2s', flexShrink: 0 }}>
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
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#7A7168', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: 50, border: 'none', cursor: saving ? 'default' : 'pointer', background: saving ? '#2A2A2A' : 'linear-gradient(135deg, #C4A882, #8B6F47)', color: saving ? '#555' : '#0A0A0A', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)', transition: 'all 0.2s' }}>
              {saving ? 'Saving…' : 'Save property'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
