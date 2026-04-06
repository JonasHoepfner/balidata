'use client'

import { useEffect, useState } from 'react'

const PROFILES = [
  { key: 'investisseur',         label: 'Investisseur' },
  { key: 'proprietaire',         label: 'Propriétaire' },
  { key: 'developpeur',          label: 'Développeur immobilier' },
  { key: 'conseiller_financier', label: 'Conseiller financier' },
]

const COUNTRIES = ['Suisse', 'France', 'Belgique', 'Luxembourg', 'Autres']

const inputBase: React.CSSProperties = {
  width: '100%', background: '#0A0A0A', border: '1px solid #232323',
  borderRadius: 8, padding: '12px 14px', color: '#E8E0D4',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--font-outfit)',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: 'var(--font-dm-mono)', fontSize: 9,
  fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase',
  color: '#4A4540', marginBottom: 8,
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 20px', fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4ADE80', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {message}
    </div>
  )
}

export default function ProfilPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [email, setEmail]         = useState('')
  const [profile, setProfile]     = useState('')
  const [country, setCountry]     = useState('France')
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      setFirstName(d.firstName ?? '')
      setLastName(d.lastName ?? '')
      setEmail(d.email ?? '')
      setProfile(d.avatarType ?? '')
      setCountry(d.country ?? 'France')
      setLoading(false)
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), avatar_type: profile, country }),
    })
    setSaving(false)
    if (res.ok) {
      setToast('Profil mis à jour')
    }
  }

  return (
    <div style={{ padding: '48px 48px', fontFamily: 'var(--font-outfit)', maxWidth: 560 }}>

      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 4 }}>Mon profil</h1>
        <p style={{ fontSize: 14, color: '#6A6158' }}>Mettez à jour vos informations personnelles.</p>
      </div>

      {loading ? (
        <div style={{ color: '#2A2A2A', fontSize: 13 }}>Chargement…</div>
      ) : (
        <form onSubmit={handleSave}>
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Prénom / Nom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Prénom</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputBase} required />
              </div>
              <div>
                <label style={labelStyle}>Nom</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} style={inputBase} required />
              </div>
            </div>

            {/* Email — read only */}
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email" value={email} readOnly disabled
                style={{ ...inputBase, color: '#4A4540', cursor: 'not-allowed', opacity: 0.6 }}
              />
            </div>

            {/* Profil */}
            <div>
              <label style={labelStyle}>Profil</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PROFILES.map(p => {
                  const active = profile === p.key
                  return (
                    <button
                      key={p.key} type="button" onClick={() => setProfile(p.key)}
                      style={{
                        padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        border: active ? '1px solid rgba(196,168,130,0.6)' : '1px solid #232323',
                        background: active ? 'rgba(196,168,130,0.08)' : '#0A0A0A',
                        color: active ? '#C4A882' : '#6A6158',
                        fontFamily: 'var(--font-outfit)', fontSize: 13, fontWeight: active ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Pays */}
            <div>
              <label style={labelStyle}>Pays de résidence</label>
              <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...inputBase, appearance: 'none', cursor: 'pointer' }}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button
              type="submit" disabled={saving}
              style={{
                padding: '13px', borderRadius: 9, border: 'none',
                cursor: saving ? 'not-allowed' : 'pointer',
                background: saving ? '#181818' : 'linear-gradient(135deg, #C4A882, #8B6F47)',
                color: saving ? '#3A3530' : '#0A0A0A',
                fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-outfit)',
              }}
            >
              {saving ? 'Enregistrement…' : 'Sauvegarder'}
            </button>
          </div>
        </form>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
