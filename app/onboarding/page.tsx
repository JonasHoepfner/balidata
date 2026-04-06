'use client'

import { useState, useRef, useEffect } from 'react'

// ── Data ───────────────────────────────────────────────────────────────────

const PROFILES = [
  { key: 'investisseur',          label: 'Investisseur' },
  { key: 'proprietaire',          label: 'Propriétaire' },
  { key: 'developpeur',           label: 'Développeur immobilier' },
  { key: 'conseiller_financier',  label: 'Conseiller financier' },
]

type Country = { flag: string; name: string } | { separator: true }

const COUNTRIES: Country[] = [
  { flag: '🇨🇭', name: 'Suisse' },
  { flag: '🇫🇷', name: 'France' },
  { flag: '🇧🇪', name: 'Belgique' },
  { flag: '🇱🇺', name: 'Luxembourg' },
  { separator: true },
  { flag: '🇦🇫', name: 'Afghanistan' },
  { flag: '🇿🇦', name: 'Afrique du Sud' },
  { flag: '🇦🇱', name: 'Albanie' },
  { flag: '🇩🇿', name: 'Algérie' },
  { flag: '🇩🇪', name: 'Allemagne' },
  { flag: '🇦🇩', name: 'Andorre' },
  { flag: '🇦🇴', name: 'Angola' },
  { flag: '🇦🇬', name: 'Antigua-et-Barbuda' },
  { flag: '🇸🇦', name: 'Arabie saoudite' },
  { flag: '🇦🇷', name: 'Argentine' },
  { flag: '🇦🇲', name: 'Arménie' },
  { flag: '🇦🇺', name: 'Australie' },
  { flag: '🇦🇹', name: 'Autriche' },
  { flag: '🇦🇿', name: 'Azerbaïdjan' },
  { flag: '🇧🇸', name: 'Bahamas' },
  { flag: '🇧🇭', name: 'Bahreïn' },
  { flag: '🇧🇩', name: 'Bangladesh' },
  { flag: '🇧🇧', name: 'Barbade' },
  { flag: '🇧🇾', name: 'Biélorussie' },
  { flag: '🇧🇿', name: 'Belize' },
  { flag: '🇧🇯', name: 'Bénin' },
  { flag: '🇧🇹', name: 'Bhoutan' },
  { flag: '🇧🇴', name: 'Bolivie' },
  { flag: '🇧🇦', name: 'Bosnie-Herzégovine' },
  { flag: '🇧🇼', name: 'Botswana' },
  { flag: '🇧🇷', name: 'Brésil' },
  { flag: '🇧🇳', name: 'Brunei' },
  { flag: '🇧🇬', name: 'Bulgarie' },
  { flag: '🇧🇫', name: 'Burkina Faso' },
  { flag: '🇧🇮', name: 'Burundi' },
  { flag: '🇨🇻', name: 'Cap-Vert' },
  { flag: '🇰🇭', name: 'Cambodge' },
  { flag: '🇨🇲', name: 'Cameroun' },
  { flag: '🇨🇦', name: 'Canada' },
  { flag: '🇨🇫', name: 'République centrafricaine' },
  { flag: '🇨🇱', name: 'Chili' },
  { flag: '🇨🇳', name: 'Chine' },
  { flag: '🇨🇾', name: 'Chypre' },
  { flag: '🇨🇴', name: 'Colombie' },
  { flag: '🇰🇲', name: 'Comores' },
  { flag: '🇨🇬', name: 'Congo' },
  { flag: '🇨🇩', name: 'Congo (RDC)' },
  { flag: '🇰🇵', name: 'Corée du Nord' },
  { flag: '🇰🇷', name: 'Corée du Sud' },
  { flag: '🇨🇷', name: 'Costa Rica' },
  { flag: '🇨🇮', name: "Côte d'Ivoire" },
  { flag: '🇭🇷', name: 'Croatie' },
  { flag: '🇨🇺', name: 'Cuba' },
  { flag: '🇩🇰', name: 'Danemark' },
  { flag: '🇩🇯', name: 'Djibouti' },
  { flag: '🇩🇲', name: 'Dominique' },
  { flag: '🇪🇬', name: 'Égypte' },
  { flag: '🇦🇪', name: 'Émirats arabes unis' },
  { flag: '🇪🇨', name: 'Équateur' },
  { flag: '🇪🇷', name: 'Érythrée' },
  { flag: '🇪🇸', name: 'Espagne' },
  { flag: '🇪🇪', name: 'Estonie' },
  { flag: '🇸🇿', name: 'Eswatini' },
  { flag: '🇺🇸', name: 'États-Unis' },
  { flag: '🇪🇹', name: 'Éthiopie' },
  { flag: '🇫🇯', name: 'Fidji' },
  { flag: '🇫🇮', name: 'Finlande' },
  { flag: '🇬🇦', name: 'Gabon' },
  { flag: '🇬🇲', name: 'Gambie' },
  { flag: '🇬🇪', name: 'Géorgie' },
  { flag: '🇬🇭', name: 'Ghana' },
  { flag: '🇬🇩', name: 'Grenade' },
  { flag: '🇬🇹', name: 'Guatemala' },
  { flag: '🇬🇳', name: 'Guinée' },
  { flag: '🇬🇼', name: 'Guinée-Bissau' },
  { flag: '🇬🇶', name: 'Guinée équatoriale' },
  { flag: '🇬🇾', name: 'Guyana' },
  { flag: '🇭🇹', name: 'Haïti' },
  { flag: '🇭🇳', name: 'Honduras' },
  { flag: '🇭🇺', name: 'Hongrie' },
  { flag: '🇮🇳', name: 'Inde' },
  { flag: '🇮🇩', name: 'Indonésie' },
  { flag: '🇮🇶', name: 'Irak' },
  { flag: '🇮🇷', name: 'Iran' },
  { flag: '🇮🇪', name: 'Irlande' },
  { flag: '🇮🇸', name: 'Islande' },
  { flag: '🇮🇱', name: 'Israël' },
  { flag: '🇮🇹', name: 'Italie' },
  { flag: '🇯🇲', name: 'Jamaïque' },
  { flag: '🇯🇵', name: 'Japon' },
  { flag: '🇯🇴', name: 'Jordanie' },
  { flag: '🇰🇿', name: 'Kazakhstan' },
  { flag: '🇰🇪', name: 'Kenya' },
  { flag: '🇰🇬', name: 'Kirghizistan' },
  { flag: '🇰🇮', name: 'Kiribati' },
  { flag: '🇽🇰', name: 'Kosovo' },
  { flag: '🇰🇼', name: 'Koweït' },
  { flag: '🇱🇦', name: 'Laos' },
  { flag: '🇱🇸', name: 'Lesotho' },
  { flag: '🇱🇻', name: 'Lettonie' },
  { flag: '🇱🇧', name: 'Liban' },
  { flag: '🇱🇷', name: 'Liberia' },
  { flag: '🇱🇾', name: 'Libye' },
  { flag: '🇱🇮', name: 'Liechtenstein' },
  { flag: '🇱🇹', name: 'Lituanie' },
  { flag: '🇲🇬', name: 'Madagascar' },
  { flag: '🇲🇼', name: 'Malawi' },
  { flag: '🇲🇾', name: 'Malaisie' },
  { flag: '🇲🇻', name: 'Maldives' },
  { flag: '🇲🇱', name: 'Mali' },
  { flag: '🇲🇹', name: 'Malte' },
  { flag: '🇲🇦', name: 'Maroc' },
  { flag: '🇲🇭', name: 'Marshall' },
  { flag: '🇲🇺', name: 'Maurice' },
  { flag: '🇲🇷', name: 'Mauritanie' },
  { flag: '🇲🇽', name: 'Mexique' },
  { flag: '🇫🇲', name: 'Micronésie' },
  { flag: '🇲🇩', name: 'Moldavie' },
  { flag: '🇲🇨', name: 'Monaco' },
  { flag: '🇲🇳', name: 'Mongolie' },
  { flag: '🇲🇪', name: 'Monténégro' },
  { flag: '🇲🇿', name: 'Mozambique' },
  { flag: '🇲🇲', name: 'Myanmar' },
  { flag: '🇳🇦', name: 'Namibie' },
  { flag: '🇳🇷', name: 'Nauru' },
  { flag: '🇳🇵', name: 'Népal' },
  { flag: '🇳🇮', name: 'Nicaragua' },
  { flag: '🇳🇪', name: 'Niger' },
  { flag: '🇳🇬', name: 'Nigéria' },
  { flag: '🇳🇴', name: 'Norvège' },
  { flag: '🇳🇿', name: 'Nouvelle-Zélande' },
  { flag: '🇴🇲', name: 'Oman' },
  { flag: '🇺🇬', name: 'Ouganda' },
  { flag: '🇺🇿', name: 'Ouzbékistan' },
  { flag: '🇵🇰', name: 'Pakistan' },
  { flag: '🇵🇼', name: 'Palaos' },
  { flag: '🇵🇸', name: 'Palestine' },
  { flag: '🇵🇦', name: 'Panama' },
  { flag: '🇵🇬', name: 'Papouasie-Nouvelle-Guinée' },
  { flag: '🇵🇾', name: 'Paraguay' },
  { flag: '🇳🇱', name: 'Pays-Bas' },
  { flag: '🇵🇪', name: 'Pérou' },
  { flag: '🇵🇭', name: 'Philippines' },
  { flag: '🇵🇱', name: 'Pologne' },
  { flag: '🇵🇹', name: 'Portugal' },
  { flag: '🇶🇦', name: 'Qatar' },
  { flag: '🇷🇴', name: 'Roumanie' },
  { flag: '🇬🇧', name: 'Royaume-Uni' },
  { flag: '🇷🇺', name: 'Russie' },
  { flag: '🇷🇼', name: 'Rwanda' },
  { flag: '🇰🇳', name: 'Saint-Kitts-et-Nevis' },
  { flag: '🇱🇨', name: 'Sainte-Lucie' },
  { flag: '🇻🇨', name: 'Saint-Vincent-et-les-Grenadines' },
  { flag: '🇸🇧', name: 'Salomon' },
  { flag: '🇸🇻', name: 'Salvador' },
  { flag: '🇼🇸', name: 'Samoa' },
  { flag: '🇸🇲', name: 'Saint-Marin' },
  { flag: '🇸🇹', name: 'Sao Tomé-et-Principe' },
  { flag: '🇸🇳', name: 'Sénégal' },
  { flag: '🇷🇸', name: 'Serbie' },
  { flag: '🇸🇨', name: 'Seychelles' },
  { flag: '🇸🇱', name: 'Sierra Leone' },
  { flag: '🇸🇬', name: 'Singapour' },
  { flag: '🇸🇰', name: 'Slovaquie' },
  { flag: '🇸🇮', name: 'Slovénie' },
  { flag: '🇸🇴', name: 'Somalie' },
  { flag: '🇸🇩', name: 'Soudan' },
  { flag: '🇸🇸', name: 'Soudan du Sud' },
  { flag: '🇱🇰', name: 'Sri Lanka' },
  { flag: '🇸🇪', name: 'Suède' },
  { flag: '🇸🇷', name: 'Suriname' },
  { flag: '🇸🇾', name: 'Syrie' },
  { flag: '🇹🇯', name: 'Tadjikistan' },
  { flag: '🇹🇿', name: 'Tanzanie' },
  { flag: '🇹🇩', name: 'Tchad' },
  { flag: '🇨🇿', name: 'Tchéquie' },
  { flag: '🇹🇭', name: 'Thaïlande' },
  { flag: '🇹🇱', name: 'Timor oriental' },
  { flag: '🇹🇬', name: 'Togo' },
  { flag: '🇹🇴', name: 'Tonga' },
  { flag: '🇹🇹', name: 'Trinité-et-Tobago' },
  { flag: '🇹🇳', name: 'Tunisie' },
  { flag: '🇹🇲', name: 'Turkménistan' },
  { flag: '🇹🇷', name: 'Turquie' },
  { flag: '🇹🇻', name: 'Tuvalu' },
  { flag: '🇺🇦', name: 'Ukraine' },
  { flag: '🇺🇾', name: 'Uruguay' },
  { flag: '🇻🇺', name: 'Vanuatu' },
  { flag: '🇻🇪', name: 'Venezuela' },
  { flag: '🇻🇳', name: 'Viêt Nam' },
  { flag: '🇾🇪', name: 'Yémen' },
  { flag: '🇿🇲', name: 'Zambie' },
  { flag: '🇿🇼', name: 'Zimbabwe' },
]

// ── Styles ─────────────────────────────────────────────────────────────────

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

// ── CountryPicker ──────────────────────────────────────────────────────────

function CountryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setQuery('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const q = query.toLowerCase().trim()

  // Filter — separators only shown when no query
  const filtered: Country[] = q
    ? COUNTRIES.filter((c): c is { flag: string; name: string } =>
        !('separator' in c) && c.name.toLowerCase().includes(q)
      )
    : COUNTRIES

  // Find selected country for display
  const selected = COUNTRIES.find(
    (c): c is { flag: string; name: string } => !('separator' in c) && c.name === value
  )

  function select(name: string) {
    onChange(name)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger input */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0D0D0D', border: `1px solid ${open ? '#3A3530' : '#2A2A2A'}`,
          borderRadius: open ? '6px 6px 0 0' : 6,
          padding: '11px 14px', cursor: 'text',
          transition: 'border-color 0.15s',
        }}
        onClick={() => { setOpen(true) }}
      >
        {/* Search icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
          <circle cx="6" cy="6" r="4.5" stroke="#C4A882" strokeWidth="1.4"/>
          <path d="M10 10L13 13" stroke="#C4A882" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>

        {open ? (
          <input
            autoFocus
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un pays..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#E8E0D4', fontSize: 14, fontFamily: 'var(--font-outfit)',
              padding: 0,
            }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: 14, fontFamily: 'var(--font-outfit)', color: selected ? '#E8E0D4' : '#4A4540' }}>
            {selected ? `${selected.flag}  ${selected.name}` : 'Rechercher un pays...'}
          </span>
        )}

        {/* Chevron */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{ flexShrink: 0, opacity: 0.35, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M2 4L6 8L10 4" stroke="#C4A882" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#111', border: '1px solid #2A2A2A', borderTop: 'none',
            borderRadius: '0 0 6px 6px',
            maxHeight: 220, overflowY: 'auto',
            // Scrollbar styling via class (injected below)
          }}
          className="country-dropdown"
        >
          {filtered.length === 0 && (
            <div style={{ padding: '12px 14px', fontSize: 13, color: '#4A4540', fontFamily: 'var(--font-outfit)' }}>
              Aucun résultat
            </div>
          )}
          {filtered.map((c, i) => {
            if ('separator' in c) {
              return (
                <div key={`sep-${i}`} style={{ padding: '4px 14px', color: '#2A2A2A', fontSize: 11, userSelect: 'none', letterSpacing: '0.05em' }}>
                  ──────────
                </div>
              )
            }
            const isSelected = c.name === value
            const isHovered  = hovered === c.name
            return (
              <div
                key={c.name}
                onMouseEnter={() => setHovered(c.name)}
                onMouseLeave={() => setHovered(null)}
                onMouseDown={() => select(c.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', cursor: 'pointer',
                  background: isSelected ? '#1A1400' : isHovered ? '#1A1A1A' : 'transparent',
                  color: isSelected ? '#C4A882' : '#C8BFB5',
                  fontSize: 13, fontFamily: 'var(--font-outfit)',
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{c.flag}</span>
                <span>{c.name}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Inline scrollbar styles */}
      <style>{`
        .country-dropdown::-webkit-scrollbar { width: 4px; }
        .country-dropdown::-webkit-scrollbar-track { background: transparent; }
        .country-dropdown::-webkit-scrollbar-thumb { background: #2A2A2A; border-radius: 2px; }
        .country-dropdown::-webkit-scrollbar-thumb:hover { background: #3A3530; }
      `}</style>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

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
              <CountryPicker value={country} onChange={setCountry} />
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
