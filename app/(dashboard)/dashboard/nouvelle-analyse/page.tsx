'use client'

import { AnalysisForm } from '@/components/AnalysisForm'

export default function NouvelleAnalysePage() {
  return (
    <div style={{ padding: '48px 48px', fontFamily: 'var(--font-outfit)' }}>

      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Nouvelle analyse
        </h1>
        <p style={{ fontSize: 14, color: '#6A6158' }}>
          Renseignez votre bien pour obtenir votre rapport de marché.
        </p>
      </div>

      <div style={{ maxWidth: 560 }}>
        <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 12, padding: '28px 28px' }}>
          <AnalysisForm directCheckout />
        </div>
      </div>
    </div>
  )
}
