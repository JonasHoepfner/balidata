'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.105 17.64 11.845 17.64 9.2Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

function translateAuthError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (msg.includes('already registered') || msg.includes('already been registered')) return 'Un compte existe déjà avec cet email. Connectez-vous.'
  if (msg.includes('Email not confirmed')) return 'Confirmez votre email avant de vous connecter.'
  if (msg.includes('Password should be at least')) return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Trop de tentatives. Réessayez dans quelques minutes.'
  return msg
}

async function redirectAfterLogin() {
  const res = await fetch('/api/me')
  const me = await res.json()
  if (!me.firstName) {
    window.location.href = '/onboarding'
  } else if (me.isPaid) {
    window.location.href = '/dashboard'
  } else {
    window.location.href = '/pricing'
  }
}

// ── Shared styles ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#0A0A0A', border: '1px solid #232323',
  borderRadius: 8, padding: '12px 14px', color: '#E8E0D4',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  fontFamily: 'var(--font-outfit)',
}

// ── Mode toggle ────────────────────────────────────────────────────────────

function ModeToggle({ mode, onChange }: { mode: 'magic' | 'password'; onChange: (m: 'magic' | 'password') => void }) {
  const btn = (label: string, val: 'magic' | 'password') => (
    <button
      type="button"
      onClick={() => onChange(val)}
      style={{
        flex: 1, padding: '7px 0', borderRadius: 6, border: 'none',
        background: mode === val ? '#1E1E1E' : 'transparent',
        color: mode === val ? '#C4A882' : '#4A4540',
        fontFamily: 'var(--font-dm-mono)', fontSize: 10, letterSpacing: '0.06em',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: 3, marginBottom: 16 }}>
      {btn('LIEN MAGIQUE', 'magic')}
      {btn('MOT DE PASSE', 'password')}
    </div>
  )
}

// ── Password form ──────────────────────────────────────────────────────────

function PasswordForm() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [sent, setSent]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (isSignUp && password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }

    setLoading(true)
    const supabase = createSupabaseBrowserClient()

    if (isSignUp) {
      const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password })
      setLoading(false)
      if (authError) { setError(translateAuthError(authError.message)); return }
      if (data.session) {
        await redirectAfterLogin()
      } else {
        setSent(true)
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setLoading(false)
      if (authError) { setError(translateAuthError(authError.message)); return }
      await redirectAfterLogin()
    }
  }

  if (sent) {
    return (
      <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 22, color: '#4ADE80', marginBottom: 8 }}>✓</div>
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, color: '#4ADE80', fontWeight: 600, marginBottom: 6 }}>Vérifiez votre boîte mail.</div>
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#5A7A60' }}>Cliquez sur le lien pour confirmer votre compte.</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 12 }}>
        <input type="email" required placeholder="vous@exemple.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <input type="password" required placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
      </div>
      {isSignUp && (
        <div style={{ marginBottom: 12 }}>
          <input type="password" required placeholder="Confirmer le mot de passe" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} />
        </div>
      )}

      {error && (
        <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 12, fontFamily: 'var(--font-outfit)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button
        type="submit" disabled={loading}
        style={{
          width: '100%', padding: '13px', borderRadius: 50, border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#181818' : 'linear-gradient(135deg, #C4A882, #8B6F47)',
          color: loading ? '#3A3530' : '#0A0A0A',
          fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.01em',
          transition: 'all 0.2s', marginBottom: 12,
        }}
      >
        {loading ? '…' : isSignUp ? 'Créer mon compte →' : 'Se connecter →'}
      </button>

      <p style={{ textAlign: 'center', fontSize: 12, color: '#4A4540', fontFamily: 'var(--font-outfit)', margin: 0 }}>
        {isSignUp ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
        <button
          type="button"
          onClick={() => { setIsSignUp(v => !v); setError(null); setPassword(''); setConfirm('') }}
          style={{ background: 'none', border: 'none', color: '#C4A882', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-outfit)', textDecoration: 'underline' }}
        >
          {isSignUp ? 'Se connecter' : 'Créer un compte'}
        </button>
      </p>
    </form>
  )
}

// ── Magic link form ────────────────────────────────────────────────────────

function MagicLinkForm() {
  const [email, setEmail]     = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: baseUrl + '/auth/callback' },
    })
    setLoading(false)
    if (authError) setError(translateAuthError(authError.message))
    else setSent(true)
  }

  if (sent) {
    return (
      <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: 10, padding: '18px 20px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 18, color: '#4ADE80', marginBottom: 8 }}>✓</div>
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, color: '#4ADE80', fontWeight: 600, marginBottom: 6 }}>Vérifiez votre boîte mail.</div>
        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#5A7A60' }}>Le lien est valable 10 minutes.</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: 12 }}>
        <input
          type="email" required placeholder="vous@exemple.com"
          value={email} onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '10px 14px', color: '#F87171', fontSize: 12, fontFamily: 'var(--font-outfit)', marginBottom: 12 }}>
          {error}
        </div>
      )}
      <button
        type="submit" disabled={loading}
        style={{
          width: '100%', padding: '13px', borderRadius: 50, border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#181818' : 'linear-gradient(135deg, #C4A882, #8B6F47)',
          color: loading ? '#3A3530' : '#0A0A0A',
          fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.01em',
          transition: 'all 0.2s',
        }}
      >
        {loading ? 'Envoi en cours…' : 'Recevoir mon lien →'}
      </button>
    </form>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [mode, setMode]               = useState<'magic' | 'password'>('magic')
  const [googleLoading, setGoogleLoading] = useState(false)

  async function handleGoogle() {
    setGoogleLoading(true)
    const supabase = createSupabaseBrowserClient()
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: baseUrl + '/auth/callback' },
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <a href="/" style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 16, fontWeight: 500, color: '#C4A882', letterSpacing: '0.14em', textTransform: 'uppercase', textDecoration: 'none' }}>
            BALIDATA
          </a>
        </div>

        <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 16, padding: '36px 32px' }}>
          <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 10, textAlign: 'center', lineHeight: 1.15 }}>
            Accéder à mon espace
          </h1>
          <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, color: '#6A6158', textAlign: 'center', marginBottom: 28, lineHeight: 1.6 }}>
            Connectez-vous pour accéder à votre rapport.
          </p>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: '100%', padding: '12px 16px',
              borderRadius: 50, border: '1px solid #D1D5DB',
              background: googleLoading ? '#F3F4F6' : '#FFFFFF',
              color: '#1F2937',
              fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-outfit)',
              cursor: googleLoading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'opacity 0.15s',
              opacity: googleLoading ? 0.7 : 1,
            }}
          >
            <GoogleIcon />
            {googleLoading ? 'Redirection…' : 'Continuer avec Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 16px' }}>
            <div style={{ flex: 1, height: 1, background: '#1E1E1E' }} />
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#3A3530', letterSpacing: '0.08em' }}>ou</span>
            <div style={{ flex: 1, height: 1, background: '#1E1E1E' }} />
          </div>

          {/* Mode toggle */}
          <ModeToggle mode={mode} onChange={m => setMode(m)} />

          {mode === 'magic' ? <MagicLinkForm /> : <PasswordForm />}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#2A2520', letterSpacing: '0.06em' }}>
          Connexion sécurisée · Supabase Auth
        </p>
      </div>
    </div>
  )
}
