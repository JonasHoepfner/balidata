import Link from 'next/link'

export default function SuccessPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      color: '#E8E0D5',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid #161616', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6,
          background: 'linear-gradient(135deg, #C4A882, #8B6F47)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: '#0A0A0A', fontWeight: 900,
        }}>◆</div>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: '#F0EAE2' }}>BaliData</span>
        <span style={{ fontSize: 11, color: '#C4A882', marginLeft: 2, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Analytics</span>
      </header>

      {/* Content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          {/* Icon */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px',
            fontSize: 26,
          }}>
            ✓
          </div>

          <h1 style={{
            fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em',
            color: '#F0EAE2', marginBottom: 16, lineHeight: 1.2,
          }}>
            Paiement confirmé
          </h1>

          <p style={{
            fontSize: 16, color: '#7A7168', lineHeight: 1.7,
            marginBottom: 40, maxWidth: 380, margin: '0 auto 40px',
          }}>
            Votre analyse complète est en cours de génération.<br />
            Vous recevrez un email dans les <strong style={{ color: '#C4A882' }}>60 secondes</strong>.
          </p>

          {/* Divider */}
          <div style={{ height: 1, background: '#1A1A1A', marginBottom: 36 }} />

          {/* What's included */}
          <div style={{ marginBottom: 40, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4A4540', marginBottom: 14 }}>
              Ce qui est inclus
            </div>
            {[
              'Prix médian exact et fourchette P25/P75',
              '3 listings les plus proches avec distances',
              'Revenu mensuel estimé (65% d\'occupation)',
              'Verdict de positionnement marché',
            ].map((item) => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #161616', fontSize: 13, color: '#8A8178' }}>
                <span style={{ color: '#4ADE80', fontSize: 11, flexShrink: 0 }}>✓</span>
                {item}
              </div>
            ))}
          </div>

          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '13px 32px', borderRadius: 9,
              background: 'linear-gradient(135deg, #C4A882, #8B6F47)',
              color: '#0A0A0A', fontSize: 14, fontWeight: 800,
              letterSpacing: '-0.01em', textDecoration: 'none',
            }}
          >
            Retour à l&apos;analyse
          </Link>
        </div>
      </div>
    </main>
  )
}
