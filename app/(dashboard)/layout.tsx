'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Me = {
  loggedIn: boolean
  isAdmin: boolean
  firstName: string | null
  email: string | null
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IconHome() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 6.5L8 2l6 4.5V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill="none"/>
      <path d="M6 15v-5h4v5" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

function IconDocument() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="1.5" width="10" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25" fill="none"/>
      <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.25" fill="none"/>
      <path d="M8 5v6M5 8h6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

function IconMap() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 3.5l4-2 5 2 4-2v11l-4 2-5-2-4 2V3.5Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill="none"/>
      <path d="M5.5 1.5v11M10.5 3.5v11" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

function IconCard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.25" fill="none"/>
      <path d="M1.5 6.5h13" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M4 10h2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

function IconPerson() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.25" fill="none"/>
      <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none"/>
    </svg>
  )
}

// ── NavLink ────────────────────────────────────────────────────────────────

function NavLink({
  href, label, icon, badge, disabled,
}: {
  href: string
  label: string
  icon: React.ReactNode
  badge?: string
  disabled?: boolean
}) {
  const pathname = usePathname()
  const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  if (disabled) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 6, color: '#333', cursor: 'default', userSelect: 'none', borderLeft: '2px solid transparent' }}>
        <span style={{ flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, flex: 1 }}>{label}</span>
        {badge && (
          <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#8B6F47', letterSpacing: '0.08em', background: 'rgba(196,168,130,0.1)', borderRadius: 4, padding: '2px 6px' }}>{badge}</span>
        )}
      </div>
    )
  }

  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', borderRadius: 6, textDecoration: 'none',
        borderLeft: isActive ? '2px solid #C4A882' : '2px solid transparent',
        background: isActive ? '#161616' : 'transparent',
        color: isActive ? '#C4A882' : '#555',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = '#111'; (e.currentTarget as HTMLElement).style.color = '#888' } }}
      onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#555' } }}
    >
      <span style={{ flexShrink: 0 }}>{icon}</span>
      <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, flex: 1 }}>{label}</span>
    </a>
  )
}

function Divider() {
  return <div style={{ height: 1, background: '#1E1E1E', margin: '8px 16px' }} />
}

// ── Layout ─────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(setMe)
  }, [])

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const initial = me?.firstName
    ? me.firstName[0].toUpperCase()
    : me?.email
    ? me.email[0].toUpperCase()
    : '?'

  const displayName = me?.firstName ?? me?.email ?? '…'

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0,
        width: 240, height: '100vh',
        background: '#0A0A0A',
        borderRight: '1px solid #1E1E1E',
        display: 'flex', flexDirection: 'column',
        zIndex: 50,
      }}>

        {/* Logo */}
        <div style={{ padding: '28px 24px', borderBottom: '1px solid #1E1E1E' }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 14, color: '#C4A882', letterSpacing: '3px', fontWeight: 500 }}>
              BALIDATA
            </span>
          </a>
          {me?.isAdmin && (
            <div style={{ marginTop: 6 }}>
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#C4A882', letterSpacing: '0.12em', background: 'rgba(196,168,130,0.1)', border: '1px solid rgba(196,168,130,0.25)', borderRadius: 4, padding: '2px 8px' }}>
                ADMIN
              </span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          <NavLink href="/dashboard"                  label="Tableau de bord"    icon={<IconHome />} />
          <NavLink href="/dashboard/analyses"         label="Mes analyses"       icon={<IconDocument />} />
          <NavLink href="/dashboard/nouvelle-analyse" label="Nouvelle analyse"   icon={<IconPlus />} />
          <NavLink href="/dashboard/carte"            label="Carte du marché"    icon={<IconMap />} badge="Bientôt" disabled />

          <Divider />

          <NavLink href="/dashboard/abonnement"       label="Mon abonnement"     icon={<IconCard />} />
          <NavLink href="/dashboard/profil"           label="Mon profil"         icon={<IconPerson />} />
        </nav>

        {/* User info + logout */}
        <div style={{ borderTop: '1px solid #1E1E1E', padding: '16px 8px 12px' }}>
          {/* Avatar + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-dm-mono)', fontSize: 13, fontWeight: 600, color: '#0A0A0A', flexShrink: 0 }}>
              {initial}
            </div>
            <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', background: 'none', border: 'none', borderRadius: 6, color: '#555', fontSize: 13, fontFamily: 'var(--font-outfit)', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10.5 11l3-3-3-3M13.5 8H6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ marginLeft: 240, flex: 1, minHeight: '100vh', background: '#080808', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
