'use client'

import { useState, useEffect, useRef } from 'react'
import { AnalysisForm } from '@/components/AnalysisForm'
import { useAuthModal } from '@/context/AuthModalContext'

// ── Scroll reveal hook ─────────────────────────────────────────────────────

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target) } }),
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

// ── Checkout helper ────────────────────────────────────────────────────────

async function checkout(plan: 'once' | 'monthly' | 'b2b') {
  const res = await fetch('/api/create-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }) })
  const data = await res.json()
  if (data.error) { alert(data.error); return }
  if (data.url) window.location.href = data.url
}

// ── Scroll helper ──────────────────────────────────────────────────────────

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Reveal({ children, delay, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  return (
    <div data-reveal data-delay={delay ?? undefined} style={style}>
      {children}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// NAV
// ══════════════════════════════════════════════════════════════════════════

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const { open: openModal } = useAuthModal()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  async function handleEssaiGratuit() {
    const res = await fetch('/api/me')
    const me = await res.json()
    if (me.loggedIn && me.isPaid) {
      window.location.href = '/dashboard'
    } else {
      openModal()
    }
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(10,10,10,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid #1A1A1A' : '1px solid transparent',
      transition: 'background 0.3s, border-color 0.3s',
      padding: '0 32px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', gap: 40 }}>
        {/* Logo */}
        <a href="/" style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 15, fontWeight: 500, color: '#C4A882', letterSpacing: '0.12em', textTransform: 'uppercase', flexShrink: 0 }}>
          BALIDATA
        </a>

        {/* Links */}
        <div style={{ display: 'flex', gap: 28, flex: 1, justifyContent: 'center' }}>
          {([['Comment ça marche', 'how'], ['Fonctionnalités', 'features'], ['Tarifs', 'pricing'], ['FAQ', 'faq']] as [string, string][]).map(([label, id]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ fontSize: 13, color: '#7A7168', fontFamily: 'var(--font-outfit)', fontWeight: 500, transition: 'color 0.2s', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#E8E0D4')}
              onMouseLeave={e => (e.currentTarget.style.color = '#7A7168')}>
              {label}
            </button>
          ))}
        </div>

        {/* CTA */}
        <button onClick={handleEssaiGratuit} style={{ flexShrink: 0, padding: '8px 18px', borderRadius: 7, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)', border: 'none', cursor: 'pointer' }}>
          Essai gratuit
        </button>
      </div>
    </nav>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// HERO
// ══════════════════════════════════════════════════════════════════════════

function Hero() {
  return (
    <section style={{ minHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      {/* Subtle radial glow */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 400, background: 'radial-gradient(ellipse, rgba(196,168,130,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 780, position: 'relative' }}>
        <div className="hero-1">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(196,168,130,0.07)', border: '1px solid rgba(196,168,130,0.18)', borderRadius: 20, padding: '5px 14px', marginBottom: 28 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#C4A882', letterSpacing: '0.08em' }}>5 000+ listings trackés en temps réel</span>
          </div>
        </div>

        <h1 className="hero-2" style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(42px, 7vw, 72px)', fontWeight: 600, lineHeight: 1.08, letterSpacing: '-0.02em', color: '#F0EAE2', marginBottom: 24 }}>
          Votre villa à Bali vaut-elle<br />
          <em style={{ color: '#C4A882', fontStyle: 'italic' }}>vraiment</em> ce qu&apos;on vous dit ?
        </h1>

        <p className="hero-3" style={{ fontFamily: 'var(--font-outfit)', fontSize: 18, color: '#7A7168', lineHeight: 1.7, maxWidth: 520, margin: '0 auto 40px', fontWeight: 400 }}>
          Comparez votre tarif Airbnb aux données réelles du marché Bali.
          Verdict instantané, prix médian, comparables GPS, revenu estimé.
        </p>

        <div className="hero-4" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 60 }}>
          <button onClick={() => scrollTo('analyse')} style={{ padding: '14px 28px', borderRadius: 9, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-outfit)', border: 'none', cursor: 'pointer' }}>
            Analyser gratuitement
          </button>
          <button onClick={() => scrollTo('demo')} style={{ padding: '14px 28px', borderRadius: 9, border: '1px solid #2A2A2A', color: '#8A8178', fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-outfit)', background: 'none', cursor: 'pointer' }}>
            Voir un exemple de rapport →
          </button>
        </div>

        {/* Inline stats */}
        <div className="hero-4" style={{ display: 'flex', gap: 0, justifyContent: 'center', borderTop: '1px solid #1A1A1A', paddingTop: 32 }}>
          {[['5 000+', 'listings trackés'], ['47', 'secteurs couverts'], ['< 60s', 'pour un rapport']].map(([val, label], i) => (
            <div key={i} style={{ flex: 1, maxWidth: 180, padding: '0 24px', borderRight: i < 2 ? '1px solid #1A1A1A' : 'none', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 26, color: '#C4A882', marginBottom: 4 }}>{val}</div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#4A4540' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// DEMO REPORT — aperçu rapport style navigateur
// ══════════════════════════════════════════════════════════════════════════

function DemoReport() {
  const monoSm: React.CSSProperties = { fontFamily: 'var(--font-dm-mono)', fontSize: 9, letterSpacing: '0.08em' }
  return (
    <section id="demo" style={{ padding: '80px 24px', background: 'linear-gradient(180deg, #0A0A0A 0%, #0D0D0D 100%)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <Reveal>
          {/* Label */}
          <div style={{ textAlign: 'center', marginBottom: 24, fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            APERÇU DU RAPPORT · PERERENAN · VILLA 2 CHAMBRES
          </div>

          {/* Browser window */}
          <div style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', border: '1px solid #1E1E1E' }}>

            {/* Browser chrome */}
            <div style={{ background: '#1A1A1A', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #232323' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FFBD2E' }} />
                <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28CA41' }} />
              </div>
              <div style={{ flex: 1, background: '#111', borderRadius: 5, padding: '5px 12px', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#444', letterSpacing: '0.04em' }}>
                balidata.vercel.app/rapport/BD-2026-0412
              </div>
            </div>

            {/* Report content */}
            <div style={{ background: '#0A0A0A' }}>

              {/* Header */}
              <div style={{ background: '#0A0A0A', borderBottom: '1px solid #C4A882', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882', letterSpacing: '0.12em', fontWeight: 500 }}>BALIDATA</span>
                <span style={{ ...monoSm, color: '#333' }}>Rapport BD-2026-0412 · Pererenan · 4 avril 2026</span>
              </div>

              {/* Satellite map */}
              <div style={{ position: 'relative', height: 180, overflow: 'hidden' }}>
                {/* CSS satellite placeholder */}
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 55% 45%, #1E2E12 0%, #111A0A 35%, #080C05 70%, #040604 100%)' }} />
                {/* field patches */}
                <div style={{ position: 'absolute', top: '20%', left: '15%', width: '22%', height: '30%', background: 'rgba(60,100,20,0.22)', borderRadius: 2 }} />
                <div style={{ position: 'absolute', top: '55%', left: '25%', width: '18%', height: '20%', background: 'rgba(50,80,15,0.18)', borderRadius: 2 }} />
                <div style={{ position: 'absolute', top: '25%', left: '60%', width: '28%', height: '35%', background: 'rgba(55,90,18,0.2)', borderRadius: 2 }} />
                {/* roads */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 900 180" preserveAspectRatio="none">
                  <path d="M0 95 Q200 88 450 92 Q650 96 900 88" stroke="rgba(180,150,80,0.25)" strokeWidth="3" fill="none" />
                  <path d="M0 130 Q150 128 300 130 Q450 132 900 126" stroke="rgba(140,120,60,0.15)" strokeWidth="2" fill="none" />
                  <path d="M380 0 Q375 60 380 95 Q385 130 380 180" stroke="rgba(160,140,70,0.18)" strokeWidth="2" fill="none" />
                  <path d="M620 0 Q618 45 622 95 Q625 140 620 180" stroke="rgba(120,110,55,0.12)" strokeWidth="1.5" fill="none" />
                </svg>
                {/* radius ring */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: 120, height: 120, borderRadius: '50%', border: '1px dashed rgba(196,168,130,0.3)', transform: 'translate(-50%,-50%)' }} />
                {/* nearby dots */}
                {[{ top: '38%', left: '44%' }, { top: '58%', left: '56%' }, { top: '35%', left: '61%' }].map((p, i) => (
                  <div key={i} style={{ position: 'absolute', top: p.top, left: p.left, width: 7, height: 7, borderRadius: '50%', background: 'rgba(74,222,128,0.7)', border: '1px solid rgba(74,222,128,0.4)', transform: 'translate(-50%,-50%)', boxShadow: '0 0 6px rgba(74,222,128,0.4)' }} />
                ))}
                {/* center pin */}
                <div style={{ position: 'absolute', top: '48%', left: '50%', transform: 'translate(-50%,-100%)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#C4A882', boxShadow: '0 0 0 3px rgba(196,168,130,0.3), 0 0 0 6px rgba(196,168,130,0.12)' }} />
                </div>
                {/* gradient overlay */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(10,10,10,0.9) 100%)' }} />
                {/* badge left */}
                <div style={{ position: 'absolute', bottom: 10, left: 14, background: 'rgba(10,10,10,0.88)', border: '1px solid rgba(196,168,130,0.4)', borderRadius: 5, padding: '5px 10px' }}>
                  <div style={{ ...monoSm, color: '#C4A882', marginBottom: 2 }}>Jl. Pantai Pererenan No.157, Badung</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#555' }}>−8.6430° S · 115.1270° E · Rayon d&apos;analyse : 2 km</div>
                </div>
                {/* badge right */}
                <div style={{ position: 'absolute', bottom: 10, right: 14, background: 'rgba(10,10,10,0.88)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 5, padding: '5px 10px' }}>
                  <span style={{ ...monoSm, color: '#4CAF50' }}>● RÉALISTE</span>
                </div>
              </div>

              {/* Metrics grid — 4 cols */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid #1A1A1A' }}>
                {[
                  { label: 'PRIX MÉDIAN', value: '262 USD/nuit', color: '#C4A882', bg: '#0A0A0A', border: '#1A1A1A' },
                  { label: 'OCCUPATION',  value: '65%',          color: '#4CAF50', bg: '#0A0A0A', border: '#1A1A1A' },
                  { label: 'ROI NET ESTIMÉ', value: '13,97%',    color: '#4CAF50', bg: '#0F1A0F', border: '#2D5A2D' },
                  { label: 'REVENU NET/AN',  value: '34 932 USD',color: '#F0EAE2', bg: '#0A0A0A', border: '#1A1A1A' },
                ].map((m, i) => (
                  <div key={i} style={{ background: m.bg, border: `1px solid ${m.border}`, padding: '16px 20px', borderTop: 'none', borderBottom: 'none', borderLeft: i === 0 ? 'none' : undefined, borderRight: i === 3 ? 'none' : undefined }}>
                    <div style={{ ...monoSm, color: '#4A4540', textTransform: 'uppercase', marginBottom: 8 }}>{m.label}</div>
                    <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 16, color: m.color, fontWeight: 400, lineHeight: 1 }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Comparables + Scenarios — 2 cols */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #1A1A1A' }}>
                {/* Comparables */}
                <div style={{ padding: '14px 20px', borderRight: '1px solid #1A1A1A' }}>
                  <div style={{ ...monoSm, color: '#C4A882', textTransform: 'uppercase', marginBottom: 10 }}>COMPARABLES PERERENAN</div>
                  {[
                    { title: 'Modern 2BR pool villa', dist: '0.6 km', price: '172 USD' },
                    { title: 'Villa Sawah 2BR vue rizières', dist: '1.1 km', price: '218 USD' },
                    { title: 'Serenity 2BR piscine privée', dist: '1.3 km', price: '242 USD' },
                  ].map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 2 ? '1px solid #151515' : 'none' }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#8A8178', marginBottom: 1 }}>{c.title}</div>
                        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#3A3530' }}>{c.dist}</div>
                      </div>
                      <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#C4A882', whiteSpace: 'nowrap' }}>{c.price}</div>
                    </div>
                  ))}
                </div>

                {/* Scenarios */}
                <div style={{ padding: '14px 20px' }}>
                  <div style={{ ...monoSm, color: '#C4A882', textTransform: 'uppercase', marginBottom: 10 }}>SCÉNARIOS DE RENDEMENT</div>
                  {[
                    { label: 'Pessimiste', roi: '8,2%',  bg: '#1A1010', border: '#2A1A16', color: '#F87171' },
                    { label: 'Réaliste',   roi: '13,97%',bg: '#0F1A0F', border: '#2D5A2D', color: '#4CAF50' },
                    { label: 'Optimiste',  roi: '19,8%', bg: '#0A1A14', border: '#1A4A34', color: '#86EFAC' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5, padding: '6px 10px', marginBottom: i < 2 ? 5 : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 11, color: '#6A6158' }}>{s.label}</span>
                      <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 12, color: s.color, fontWeight: 500 }}>{s.roi}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ background: '#1A2E1A', border: '1px solid #2D5A2D', borderRadius: 5, padding: '4px 9px' }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4CAF50' }}>ZONE TOURISME · PONDOK WISATA ✓</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#3A3530', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Potentiel locatif</span>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#4CAF50' }}>7,4 / 10</span>
                </div>
              </div>

            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// START — bande "analyse en temps réel" avec formulaire multi-étapes
// ══════════════════════════════════════════════════════════════════════════

function StartSection() {
  return (
    <section id="analyse" style={{ padding: '80px 24px', background: '#0D0D0D', borderTop: '1px solid #141414' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(196,168,130,0.06)', border: '1px solid rgba(196,168,130,0.14)', borderRadius: 20, padding: '5px 14px', marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', display: 'inline-block' }} />
              <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#C4A882', letterSpacing: '0.08em' }}>Analyse en temps réel</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(28px, 4.5vw, 44px)', fontWeight: 600, color: '#F0EAE2', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 14 }}>
              Lancez votre analyse<br />
              <em style={{ color: '#C4A882', fontStyle: 'italic' }}>en 3 étapes</em>
            </h2>
            <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 15, color: '#6A6158', maxWidth: 440, margin: '0 auto' }}>
              Localisation, caractéristiques du bien, tarif envisagé. Verdict instantané.
            </p>
          </div>
        </Reveal>
        <Reveal delay={1}>
          <div style={{ background: '#111111', border: '1px solid #1E1E1E', borderRadius: 16, padding: '32px' }}>
            <AnalysisForm />
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// HOW IT WORKS
// ══════════════════════════════════════════════════════════════════════════

function HowItWorks() {
  const steps = [
    {
      n: '01',
      tag: '< 1 MINUTE',
      title: 'Décrivez votre bien en quelques secondes',
      desc: 'Adresse, nombre de chambres, prix envisagé. En moins d\'une minute, vous nous donnez les éléments essentiels pour analyser votre bien.',
    },
    {
      n: '02',
      tag: 'DONNÉES RÉELLES',
      title: 'Nous analysons le marché en temps réel',
      desc: 'Nous analysons les biens comparables autour du vôtre : prix, taux d\'occupation et performances réelles, pour construire une base de comparaison fiable et objective.',
    },
    {
      n: '03',
      tag: 'RAPPORT COMPLET',
      title: 'Recevez une analyse claire et exploitable',
      desc: 'Un rapport détaillé et une interface interactive pour comprendre précisément où se situe votre bien sur le marché et prendre des décisions éclairées.',
    },
  ]
  return (
    <section id="how" style={{ padding: '100px 24px', borderTop: '1px solid #141414' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#C4A882', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Comment ça marche</div>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 16 }}>
              Trois étapes pour connaître le vrai potentiel de votre bien.
            </h2>
            <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 15, color: '#6A6158', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
              Fini les estimations approximatives. Chaque analyse repose sur des données réelles Airbnb collectées en temps réel autour de votre bien.
            </p>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
          {steps.map((s, i) => (
            <Reveal key={i} delay={i + 1 as 1 | 2 | 3}>
              <div style={{ padding: '28px 24px', background: '#0E0E0E', border: '1px solid #1A1A1A', borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 32, color: 'rgba(196,168,130,0.2)', lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#C4A882', letterSpacing: '0.1em', background: 'rgba(196,168,130,0.07)', border: '1px solid rgba(196,168,130,0.15)', borderRadius: 10, padding: '3px 8px' }}>{s.tag}</div>
                </div>
                <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 22, fontWeight: 600, color: '#F0EAE2', marginBottom: 12, letterSpacing: '-0.01em' }}>{s.title}</h3>
                <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, color: '#6A6158', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// FEATURES
// ══════════════════════════════════════════════════════════════════════════

function Features() {
  const features = [
    {
      icon: '◈',
      tag: 'SCRAPING EN TEMPS RÉEL',
      title: 'Données Airbnb réelles',
      desc: 'Accédez à des données fiables et actualisées pour comprendre précisément les performances du marché autour de votre bien. Prix par nuit, taux d\'occupation et revenus estimés sont basés uniquement sur des biens comparables réels.',
    },
    {
      icon: '◎',
      tag: 'INTERFACE DASHBOARD',
      title: 'Carte interactive des comparables',
      desc: 'Visualisez instantanément les biens comparables autour du vôtre et comprenez votre positionnement sur le marché. Analysez leur prix, leurs performances et leur localisation pour affiner vos décisions.',
    },
    {
      icon: '◐',
      tag: 'AIDE À LA DÉCISION',
      title: '3 scénarios de rendement',
      desc: 'Anticipez vos performances avec trois scénarios réalistes basés sur le marché. Vous visualisez clairement le potentiel de votre bien dans différentes conditions.',
    },
    {
      icon: '◧',
      tag: 'CONFORMITÉ JURIDIQUE',
      title: 'Analyse de zonage GISTARU',
      desc: 'Vérifiez en quelques secondes la conformité de votre terrain selon les réglementations locales. Un point essentiel pour sécuriser votre investissement et éviter les mauvaises surprises.',
    },
    {
      icon: '◑',
      tag: 'CALENDRIER DE PERFORMANCE',
      title: 'Saisonnalité mois par mois',
      desc: 'Comprenez les variations du marché sur l\'année pour ajuster votre stratégie. Optimisez vos prix et votre taux d\'occupation dès le lancement.',
    },
    {
      icon: '◉',
      tag: 'STRATÉGIE DE SORTIE',
      title: 'Fenêtre d\'exit leasehold',
      desc: 'Identifiez le meilleur moment pour revendre votre bien en fonction de la durée restante du bail et des dynamiques du marché. Maximisez votre valorisation avec une stratégie de sortie optimisée.',
    },
  ]
  return (
    <section id="features" style={{ padding: '100px 24px', borderTop: '1px solid #141414', background: '#0D0D0D' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#C4A882', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Fonctionnalités</div>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em' }}>
              Ce que personne ne vous dit avant d&apos;acheter.
            </h2>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {features.map((f, i) => (
            <Reveal key={i} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <div style={{ padding: '24px 22px', background: '#111111', border: '1px solid #1A1A1A', borderRadius: 12, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 20, color: '#C4A882' }}>{f.icon}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#5A5148', letterSpacing: '0.1em', background: '#191919', border: '1px solid #232323', borderRadius: 8, padding: '3px 7px', whiteSpace: 'nowrap' }}>{f.tag}</div>
                </div>
                <h3 style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, fontWeight: 600, color: '#E8E0D4', marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#5A5148', lineHeight: 1.65, flex: 1 }}>{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// MARKET STATS
// ══════════════════════════════════════════════════════════════════════════

function MarketStats() {
  const stats = [
    { val: '5 000+', label: 'listings Airbnb trackés' },
    { val: '6,3M', label: 'touristes Bali 2025' },
    { val: '65%', label: 'occupation Pererenan' },
    { val: '47', label: 'secteurs couverts' },
  ]
  return (
    <section style={{ padding: '80px 24px', borderTop: '1px solid #141414' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: '#1A1A1A', borderRadius: 14, overflow: 'hidden' }}>
          {stats.map((s, i) => (
            <Reveal key={i} delay={(i + 1) as 1 | 2 | 3 | 4}>
              <div style={{ background: '#0E0E0E', padding: '36px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 'clamp(28px, 3.5vw, 40px)', color: '#C4A882', marginBottom: 8, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#4A4540' }}>{s.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={5}>
          <p style={{ textAlign: 'center', fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#2E2A26', marginTop: 20, letterSpacing: '0.06em' }}>
            Sources : données Airbnb temps réel · BPS Bali 2025 · GISTARU
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PRICING
// ══════════════════════════════════════════════════════════════════════════

function Pricing() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleCheckout(plan: 'once' | 'monthly' | 'b2b') {
    if (plan === 'b2b') { window.location.href = 'mailto:contact@balidata.io'; return }
    setLoading(plan)
    await checkout(plan)
    setLoading(null)
  }

  const plans = [
    {
      key: 'once' as const,
      label: 'Rapport unique',
      price: '$29',
      period: 'paiement unique',
      highlight: false,
      items: ['Rapport PDF complet', 'Données Airbnb temps réel', 'Comparables géolocalisés', '3 scénarios de rendement', 'Zonage GISTARU', 'Saisonnalité 12 mois'],
    },
    {
      key: 'monthly' as const,
      label: 'Investisseur',
      price: '$39',
      period: 'par mois',
      highlight: true,
      badge: 'Recommandé',
      items: ['Rapports illimités', 'Dashboard carte interactive', 'Historique des prix marché', 'Alertes de marché', 'Fenêtre d\'exit leasehold', 'Support prioritaire'],
    },
    {
      key: 'b2b' as const,
      label: 'Partenaire B2B',
      price: '$199',
      period: 'par mois',
      highlight: false,
      items: ['Widget intégrable', 'Marque blanche', 'Accès API complet', 'Rapports en volume', 'SLA garanti 99,9%', 'Account manager dédié'],
    },
  ]

  return (
    <section id="pricing" style={{ padding: '100px 24px', borderTop: '1px solid #141414', background: '#0D0D0D' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#C4A882', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Tarifs</div>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 12 }}>Simple et transparent</h2>
            <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 15, color: '#6A6158' }}>Commencez gratuitement, passez au plan complet quand vous êtes prêt.</p>
          </div>
        </Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }}>
          {plans.map((p, i) => (
            <Reveal key={p.key} delay={(i + 1) as 1 | 2 | 3}>
              <div style={{
                background: p.highlight ? 'linear-gradient(145deg, #141414, #111111)' : '#111111',
                border: p.highlight ? '1px solid rgba(196,168,130,0.35)' : '1px solid #1A1A1A',
                borderRadius: 14, padding: '28px 24px',
                position: 'relative',
                boxShadow: p.highlight ? '0 0 40px rgba(196,168,130,0.07)' : 'none',
              }}>
                {p.badge && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-dm-mono)', padding: '4px 12px', borderRadius: 10, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                    {p.badge}
                  </div>
                )}
                <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, fontWeight: 600, color: '#8A8178', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.label}</div>
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 38, color: '#F0EAE2', lineHeight: 1 }}>{p.price}</span>
                  <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4A4540', marginLeft: 6 }}>{p.period}</span>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {p.items.map(item => (
                    <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#7A7168', fontFamily: 'var(--font-outfit)' }}>
                      <span style={{ color: '#4CAF50', fontSize: 11, marginTop: 2, flexShrink: 0 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleCheckout(p.key)}
                  disabled={loading !== null}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                    cursor: loading !== null ? 'not-allowed' : 'pointer',
                    background: p.highlight ? 'linear-gradient(135deg, #C4A882, #8B6F47)' : '#1A1A1A',
                    color: p.highlight ? '#0A0A0A' : '#8A8178',
                    fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)',
                    transition: 'opacity 0.15s',
                    opacity: loading !== null && loading !== p.key ? 0.5 : 1,
                  }}
                >
                  {loading === p.key ? 'Redirection…' : p.key === 'once' ? 'Obtenir ce rapport' : p.key === 'b2b' ? 'Nous contacter →' : 'S\'abonner'}
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// FAQ
// ══════════════════════════════════════════════════════════════════════════

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  const faqs = [
    { q: 'D\'où viennent les données ?', a: 'Nos données sont collectées directement sur Airbnb Bali via scraping structuré. Le jeu de données couvre 5 000+ annonces actives avec prix, localisation GPS, nombre d\'avis, type de bien et historique de disponibilité.' },
    { q: 'Le rapport garantit-il les revenus ?', a: 'Non. Le rapport fournit une analyse de marché basée sur les données disponibles. Les revenus réels dépendent de nombreux facteurs (gestion, photos, saison, plateforme). Nous indiquons clairement que nos estimations sont des fourchettes, pas des garanties.' },
    { q: 'Quels secteurs sont couverts ?', a: 'Nous couvrons 47 secteurs de Bali incluant : Canggu, Seminyak, Ubud, Sanur, Uluwatu, Pererenan, Berawa, Batu Bolong, Echo Beach, Umalas, Jimbaran, Bukit, Nusa Dua, Kuta, Legian, et de nombreux villages environnants.' },
    { q: 'Puis-je l\'utiliser en tant que propriétaire ?', a: 'Oui. BaliData est conçu aussi bien pour les investisseurs qui évaluent un projet que pour les propriétaires existants qui souhaitent optimiser leur tarification ou valider leur positionnement face au marché.' },
    { q: 'Comment fonctionne l\'essai gratuit ?', a: 'L\'essai gratuit vous donne accès au verdict de positionnement et au nombre de comparables. Les prix exacts (médian, P25/P75), les 3 listings proches et le rapport PDF complet nécessitent un plan payant. Aucune carte bancaire requise pour l\'essai.' },
    { q: 'L\'abonnement peut-il être résilié ?', a: 'Oui, à tout moment depuis votre espace client Stripe. La résiliation prend effet à la fin de la période en cours. Aucune question posée, aucun frais de résiliation.' },
  ]

  return (
    <section id="faq" style={{ padding: '100px 24px', borderTop: '1px solid #141414' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#C4A882', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Questions fréquentes</div>
            <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(30px, 4vw, 44px)', fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em' }}>FAQ</h2>
          </div>
        </Reveal>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {faqs.map((f, i) => (
            <Reveal key={i} delay={((i % 3) + 1) as 1 | 2 | 3}>
              <div style={{ background: '#0E0E0E', borderRadius: i === 0 ? '10px 10px 0 0' : i === faqs.length - 1 ? '0 0 10px 10px' : 0, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: '100%', padding: '18px 22px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, textAlign: 'left' }}
                >
                  <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, fontWeight: 600, color: open === i ? '#C4A882' : '#D0C8C0', transition: 'color 0.2s' }}>{f.q}</span>
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 16, color: '#4A4540', transition: 'transform 0.25s', transform: open === i ? 'rotate(45deg)' : 'none', flexShrink: 0 }}>+</span>
                </button>
                {open === i && (
                  <div style={{ padding: '0 22px 18px' }}>
                    <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#6A6158', lineHeight: 1.75, margin: 0 }}>{f.a}</p>
                  </div>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// CTA FINAL
// ══════════════════════════════════════════════════════════════════════════

function CTAFinal() {
  return (
    <section style={{ padding: '100px 24px', borderTop: '1px solid #141414', background: '#0D0D0D' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
        <Reveal>
          <h2 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 600, color: '#F0EAE2', lineHeight: 1.1, letterSpacing: '-0.02em', marginBottom: 20 }}>
            Ne prenez plus de décision<br />
            <em style={{ color: '#C4A882', fontStyle: 'italic' }}>à l&apos;aveugle</em>
          </h2>
        </Reveal>
        <Reveal delay={1}>
          <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 16, color: '#6A6158', lineHeight: 1.7, marginBottom: 36 }}>
            En 60 secondes, obtenez un verdict clair sur le positionnement réel de votre bien face au marché Airbnb Bali.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => scrollTo('analyse')} style={{ display: 'inline-block', padding: '15px 36px', borderRadius: 10, background: 'linear-gradient(135deg, #C4A882, #8B6F47)', color: '#0A0A0A', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-outfit)', border: 'none', cursor: 'pointer' }}>
              Analyser gratuitement
            </button>
            <button onClick={() => scrollTo('pricing')} style={{ display: 'inline-block', padding: '15px 36px', borderRadius: 10, border: '1px solid #2A2A2A', color: '#8A8178', fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-outfit)', background: 'none', cursor: 'pointer' }}>
              Voir les tarifs
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// FOOTER
// ══════════════════════════════════════════════════════════════════════════

function Footer() {
  return (
    <footer style={{ padding: '32px 24px', borderTop: '1px solid #141414' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 13, color: '#C4A882', letterSpacing: '0.12em' }}>BALIDATA</span>
        <div style={{ display: 'flex', gap: 24 }}>
          {[['Mentions légales', '#'], ['Confidentialité', '#'], ['Contact', 'mailto:contact@balidata.io']].map(([label, href]) => (
            <a key={label} href={href} style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#3A3530', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#7A7168')}
              onMouseLeave={e => (e.currentTarget.style.color = '#3A3530')}>
              {label}
            </a>
          ))}
        </div>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#2A2520' }}>© 2025 BaliData</span>
      </div>
    </footer>
  )
}

// ══════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════

export default function Home() {
  useScrollReveal()
  const mainRef = useRef<HTMLDivElement>(null)
  const { open: openModal } = useAuthModal()

  // Trigger 1 — open modal at 30% scroll, once per session
  useEffect(() => {
    if (sessionStorage.getItem('authModalShown')) return

    async function checkAndMaybeOpen() {
      const res = await fetch('/api/me')
      const me = await res.json()
      if (me.loggedIn) return // already logged in

      const handler = () => {
        const scrollRatio = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
        if (scrollRatio >= 0.30) {
          window.removeEventListener('scroll', handler)
          sessionStorage.setItem('authModalShown', 'true')
          openModal()
        }
      }
      window.addEventListener('scroll', handler, { passive: true })
      return () => window.removeEventListener('scroll', handler)
    }

    let cleanup: (() => void) | undefined
    checkAndMaybeOpen().then(fn => { cleanup = fn })
    return () => cleanup?.()
  }, [openModal])

  return (
    <div ref={mainRef} style={{ background: '#0A0A0A', minHeight: '100vh' }}>
      <Nav />
      <Hero />
      <DemoReport />
      <StartSection />
      <HowItWorks />
      <Features />
      <MarketStats />
      <Pricing />
      <FAQ />
      <CTAFinal />
      <Footer />
    </div>
  )
}
