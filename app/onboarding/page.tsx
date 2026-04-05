'use client'

import { useState } from 'react'

const PROFILES = [
  { key: 'investisseur',          label: 'Investisseur' },
  { key: 'proprietaire',          label: 'Propriétaire' },
  { key: 'developpeur',           label: 'Développeur immobilier' },
  { key: 'conseiller_financier',  label: 'Conseiller financier' },
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

export default function OnboardingPage() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [profile, setProfile]     = useState('')
  const [country, setCountry]     = useState('France')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !profile) {
      setError('Veuillez remplir tous les champs obligatoires.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const patchRes = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim(), avatar_type: profile, country }),
      })
      if (!patchRes.ok) {
        const d = await patchRes.json()
        setError(d.error ?? 'Erreur lors de la sauvegarde.')
        return
      }

      const meRes = await fetch('/api/me')
      const me = await meRes.json()
      window.location.href = me.isPaid ? '/dashboard' : '/pricing'
    } catch {
      setError('Une erreur est survenue.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 15, color: '#C4A882', letterSpacing: '0.14em' }}>BALIDATA</span>
        </div>

        <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 16, padding: '40px 36px' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', textAlign: 'center', marginBottom: 10, lineHeight: 1.15 }}>
            Bienvenue sur BaliData
          </h1>
          <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, color: '#6A6158', textAlign: 'center', marginBottom: 36, lineHeight: 1.6 }}>
            Quelques informations pour personnaliser votre expérience.
          </p>

          <form onSubmit={handleSubmit}>

            {/* Prénom / Nom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Prénom *</label>
                <input
                  type="text" required value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jonas" style={inputBase}
                />
              </div>
              <div>
                <label style={labelStyle}>Nom *</label>
                <input
                  type="text" required value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Hoepfner" style={inputBase}
                />
              </div>
            </div>

            {/* Profil */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Profil *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PROFILES.map(p => {
                  const active = profile === p.key
                  return (
                    <button
                      key={p.key} type="button"
                      onClick={() => setProfile(p.key)}
                      style={{
                        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                        border: active ? '1px solid rgba(196,168,130,0.6)' : '1px solid #232323',
                        background: active ? 'rgba(196,168,130,0.08)' : '#0A0A0A',
                        color: active ? '#C4A882' : '#6A6158',
                        fontFamily: 'var(--font-outfit)', fontSize: 13, fontWeight: active ? 600 : 400,
                        transition: 'all 0.15s', textAlign: 'left',
                      }}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Pays */}
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Pays de résidence</label>
              <select
                value={country} onChange={e => setCountry(e.target.value)}
                style={{ ...inputBase, appearance: 'none', cursor: 'pointer' }}
              >
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {error && (
              <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 12, fontFamily: 'var(--font-outfit)', marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 9, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#181818' : 'linear-gradient(135deg, #C4A882, #8B6F47)',
                color: loading ? '#3A3530' : '#0A0A0A',
                fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-outfit)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Enregistrement…' : 'Commencer →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
