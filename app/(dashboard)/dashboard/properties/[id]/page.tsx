'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const PropertyModal = dynamic(() => import('@/components/PropertyModal'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────────────────

type Scores = { localisation: number; demande: number; prix: number; standing: number; potentiel: number }

type Comparable = {
  title: string
  price_per_night_usd: number
  bedrooms: number | null
  airbnb_url: string | null
  distance_km: number | null
}

type Metrics = {
  priceMedian: number
  priceP25: number
  priceP75: number
  reviewsAvg: number
  listingsCount: number
  estMonthlyRevenue: number
  variancePct: number | null
  score: number | null
  estOccupancy: number
  scores: Scores
  comparables: Comparable[]
}

type Recommendations = {
  market_context: string
  pricing: string
  positioning: string
  optimization: string
}

type Property = {
  id: string
  title: string
  zone: string | null
  address: string | null
  property_type: string | null
  bedrooms: number | null
  current_price_night: number | null
  acquisition_price: number | null
  lease_type: string | null
  lease_duration: number | null
  latitude: number | null
  longitude: number | null
  weekly_alerts: boolean
  last_recommendations: Recommendations | null
  images: string[] | null
  created_at: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return '#4ADE80'
  if (s >= 50) return '#FB923C'
  return '#F87171'
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#9A9188' }}>{label}</span>
        <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#C4A882' }}>{value.toFixed(1)}/10</span>
      </div>
      <div style={{ height: 3, borderRadius: 2, background: '#1A1A1A' }}>
        <div style={{ height: '100%', width: `${value * 10}%`, background: '#C4A882', borderRadius: 2 }} />
      </div>
    </div>
  )
}

function PricePositionBar({ price, p25, med, p75 }: { price: number; p25: number; med: number; p75: number }) {
  const lo = Math.max(0, p25 * 0.8)
  const hi = p75 * 1.2
  const rng = hi - lo || 1
  const pct = (v: number) => Math.max(2, Math.min(98, ((v - lo) / rng) * 100))
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'linear-gradient(to right, #4CAF50, #FDD835, #FF9800, #e53935)', marginBottom: 24 }}>
        <div style={{ position: 'absolute', top: '50%', left: `${pct(price)}%`, transform: 'translate(-50%, -50%)', width: 16, height: 16, borderRadius: '50%', background: '#C4A882', border: '2px solid #0A0A0A', zIndex: 2 }} />
        {[{ v: p25, l: `P25 $${p25}` }, { v: med, l: `Méd. $${med}` }, { v: p75, l: `P75 $${p75}` }].map(({ v, l }) => (
          <div key={l} style={{ position: 'absolute', bottom: -20, left: `${pct(v)}%`, transform: 'translateX(-50%)', fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', whiteSpace: 'nowrap' }}>{l}</div>
        ))}
      </div>
    </div>
  )
}

function RecoCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ background: '#0A0A0A', border: '1px solid #1E1E1E', borderRadius: 10, padding: '18px 20px' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, fontWeight: 600, color: '#C4A882', marginBottom: 6 }}>{title}</div>
          <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#7A7168', lineHeight: 1.65 }}>{body}</div>
        </div>
      </div>
    </div>
  )
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 10, padding: '12px 20px', fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#C4A882', zIndex: 2000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      {message}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [property, setProperty] = useState<Property | null>(null)
  const [metrics, setMetrics]   = useState<Metrics | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [alertsSaving, setAlertsSaving] = useState(false)
  const [weeklyAlerts, setWeeklyAlerts] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/properties/${id}`)
    if (!res.ok) { router.push('/dashboard/properties'); return }
    const data = await res.json()
    setProperty(data.property)
    setMetrics(data.metrics ?? null)
    setWeeklyAlerts(data.property?.weekly_alerts ?? true)
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/properties/${id}`, { method: 'DELETE' })
    router.push('/dashboard/properties')
  }

  async function handleGenerateRecos() {
    if (!property) return
    setGenLoading(true)
    const res = await fetch(`/api/properties/${id}/recommend`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        priceMedian: metrics?.priceMedian,
        variancePct: metrics?.variancePct,
        score: metrics?.score,
      }),
    })
    const data = await res.json()
    if (res.ok && data.recommendations) {
      setProperty(p => p ? { ...p, last_recommendations: data.recommendations } : p)
      setToast('Recommandations générées !')
    }
    setGenLoading(false)
  }

  async function handleSaveAlerts() {
    setAlertsSaving(true)
    await fetch(`/api/properties/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ weekly_alerts: weeklyAlerts }),
    })
    setToast('Préférences sauvegardées.')
    setAlertsSaving(false)
  }

  if (loading || !property) {
    return (
      <div style={{ padding: '64px 48px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 11, color: '#4A4540', letterSpacing: '0.1em' }}>CHARGEMENT…</div>
      </div>
    )
  }

  const m = metrics
  const recos = property.last_recommendations
  const score = m?.score ?? null
  const currentPrice = Number(property.current_price_night ?? 0)

  return (
    <div style={{ padding: '40px 48px', maxWidth: 820 }}>

      {/* Image gallery */}
      {property.images && property.images.length > 0 && (
        <div style={{ marginBottom: 28, overflowX: 'auto', display: 'flex', gap: 10, paddingBottom: 4 }}>
          {property.images.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" style={{ width: 240, height: 180, objectFit: 'cover', borderRadius: 8, flexShrink: 0, display: 'block' }} />
          ))}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <button
          onClick={() => router.push('/dashboard/properties')}
          style={{ background: 'none', border: 'none', color: '#555', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-outfit)', marginBottom: 16, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← My Properties
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 32, fontWeight: 600, color: '#F0EAE2', letterSpacing: '-0.02em', marginBottom: 6 }}>
              {property.title}
            </h1>
            {property.zone && (
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#C4A882', letterSpacing: '0.08em' }}>{property.zone}</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => setShowEdit(true)}
              style={{ padding: '9px 20px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#C4A882', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}
            >
              Edit
            </button>
            <button
              onClick={() => setShowDelete(true)}
              style={{ padding: '9px 20px', borderRadius: 50, border: '1px solid rgba(248,113,113,0.25)', background: 'transparent', color: '#F87171', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Section 1 — Overview */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>VUE D&apos;ENSEMBLE</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
          {[
            { label: 'Prix / nuit actuel', value: currentPrice ? `$${currentPrice}` : '—' },
            { label: 'Prix médian zone', value: m?.priceMedian ? `$${m.priceMedian}` : '—' },
            { label: 'Revenu mensuel est.', value: m?.estMonthlyRevenue ? `$${m.estMonthlyRevenue.toLocaleString()}` : '—' },
            { label: 'Occupation estimée', value: m?.estOccupancy ? `${m.estOccupancy}%` : '—' },
            { label: 'Comparables analysés', value: m?.listingsCount ? String(m.listingsCount) : '—' },
            { label: 'Avis moyens zone', value: m?.reviewsAvg ? String(m.reviewsAvg) : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 6 }}>{label.toUpperCase()}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 18, color: '#C4A882' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Score */}
        {score != null && (
          <div style={{ background: '#111', border: '1px solid rgba(196,168,130,0.25)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-cormorant)', fontSize: 64, fontWeight: 700, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
                <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.1em' }}>/100</div>
              </div>
              <div style={{ flex: 1 }}>
                {m?.scores && (
                  <>
                    <ScoreBar label="Localisation"       value={m.scores.localisation} />
                    <ScoreBar label="Demande de la zone" value={m.scores.demande} />
                    <ScoreBar label="Compétitivité prix" value={m.scores.prix} />
                    <ScoreBar label="Standing (avis)"    value={m.scores.standing} />
                    <ScoreBar label="Potentiel locatif"  value={m.scores.potentiel} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Price position bar */}
        {m && currentPrice > 0 && (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 12 }}>POSITIONNEMENT PRIX</div>
            <PricePositionBar price={currentPrice} p25={m.priceP25} med={m.priceMedian} p75={m.priceP75} />
          </div>
        )}
      </section>

      {/* Section 2 — Recommendations */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.14em', textTransform: 'uppercase' }}>RECOMMANDATIONS</div>
          <button
            onClick={handleGenerateRecos}
            disabled={genLoading}
            style={{ padding: '8px 16px', borderRadius: 50, border: '1px solid rgba(196,168,130,0.3)', background: 'transparent', color: genLoading ? '#555' : '#C4A882', fontSize: 11, cursor: genLoading ? 'default' : 'pointer', fontFamily: 'var(--font-dm-mono)', letterSpacing: '0.06em', transition: 'all 0.15s' }}
          >
            {genLoading ? 'Génération…' : recos ? '↺ Refresh' : 'Generate recommendations'}
          </button>
        </div>

        {recos ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <RecoCard icon="💰" title="Pricing"       body={recos.pricing} />
            <RecoCard icon="🎯" title="Positioning"   body={recos.positioning} />
            <RecoCard icon="⚡" title="Optimization"  body={recos.optimization} />
          </div>
        ) : (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '32px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4A4540', marginBottom: 8 }}>
              Aucune recommandation générée pour l&apos;instant.
            </div>
            <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#3A3530' }}>
              Cliquez sur &ldquo;Generate recommendations&rdquo; pour obtenir des conseils personnalisés.
            </div>
          </div>
        )}
      </section>

      {/* Section 3 — Marché local */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>MARCHÉ LOCAL</div>
        {m ? (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '18px 20px' }}>
            {recos?.market_context && (
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#9A9188', lineHeight: 1.65, marginBottom: 14, fontStyle: 'italic' }}>
                &ldquo;{recos.market_context}&rdquo;
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {[
                { label: 'Comparables', value: String(m.listingsCount) },
                { label: 'Médiane',     value: `$${m.priceMedian}` },
                { label: 'P25',         value: `$${m.priceP25}` },
                { label: 'P75',         value: `$${m.priceP75}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 8, color: '#4A4540', letterSpacing: '0.1em', marginBottom: 4 }}>{label.toUpperCase()}</div>
                  <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 16, color: '#C8BFB5' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '20px', fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4A4540' }}>
            Sélectionnez une zone pour voir les données de marché.
          </div>
        )}
      </section>

      {/* Section 4 — Comparables */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>COMPARABLES PROCHES</div>
        {m?.comparables?.length ? (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, overflow: 'hidden' }}>
            {m.comparables.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: i < m.comparables.length - 1 ? '1px solid #1A1A1A' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#9A9188', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.airbnb_url ? (
                      <a href={c.airbnb_url} target="_blank" rel="noopener noreferrer" style={{ color: '#9A9188', textDecoration: 'none' }}>{c.title}</a>
                    ) : c.title}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexShrink: 0, marginLeft: 12 }}>
                  {c.distance_km != null && (
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#4A4540' }}>{c.distance_km.toFixed(1)} km</span>
                  )}
                  <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#C4A882' }}>${c.price_per_night_usd}</span>
                  {c.bedrooms && (
                    <span style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 10, color: '#555' }}>{c.bedrooms}BR</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '20px', fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#4A4540' }}>
            {property.zone ? 'Aucun comparable trouvé dans cette zone.' : 'Sélectionnez une zone pour voir les comparables.'}
          </div>
        )}
      </section>

      {/* Section 5 — Alertes */}
      <section style={{ marginBottom: 40 }}>
        <div style={{ fontFamily: 'var(--font-dm-mono)', fontSize: 9, color: '#4A4540', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>ALERTES</div>
        <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 14, fontWeight: 600, color: '#C8BFB5', marginBottom: 4 }}>Weekly pricing recommendations</div>
              <div style={{ fontFamily: 'var(--font-outfit)', fontSize: 12, color: '#4A4540', lineHeight: 1.5 }}>
                Receive weekly pricing recommendations every Monday morning
              </div>
            </div>
            <div
              onClick={() => setWeeklyAlerts(v => !v)}
              style={{ width: 40, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer', background: weeklyAlerts ? '#C4A882' : '#2A2A2A', transition: 'background 0.2s', flexShrink: 0, marginLeft: 20 }}
            >
              <div style={{ position: 'absolute', top: 3, left: weeklyAlerts ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: weeklyAlerts ? '#0A0A0A' : '#555', transition: 'left 0.2s' }} />
            </div>
          </div>
          <button
            onClick={handleSaveAlerts}
            disabled={alertsSaving}
            style={{ padding: '10px 22px', borderRadius: 50, border: 'none', cursor: alertsSaving ? 'default' : 'pointer', background: alertsSaving ? '#1A1A1A' : 'linear-gradient(135deg, #C4A882, #8B6F47)', color: alertsSaving ? '#555' : '#0A0A0A', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-outfit)' }}
          >
            {alertsSaving ? 'Saving…' : 'Save preferences'}
          </button>
        </div>
      </section>

      {/* Edit Modal */}
      {showEdit && (
        <PropertyModal
          mode="edit"
          initial={{
            id:                  property.id,
            title:               property.title,
            property_type:       property.property_type ?? undefined,
            bedrooms:            property.bedrooms ?? undefined,
            zone:                property.zone ?? undefined,
            address:             property.address ?? undefined,
            current_price_night: property.current_price_night ?? undefined,
            acquisition_price:   property.acquisition_price ?? undefined,
            lease_type:          property.lease_type ?? undefined,
            lease_duration:      property.lease_duration ?? undefined,
            latitude:            property.latitude ?? undefined,
            longitude:           property.longitude ?? undefined,
            weekly_alerts:       property.weekly_alerts,
            images:              property.images ?? [],
          }}
          onClose={() => setShowEdit(false)}
          onSaved={load}
        />
      )}

      {/* Delete confirmation */}
      {showDelete && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setShowDelete(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 14, padding: '32px 28px', maxWidth: 400, width: '100%' }}
          >
            <h3 style={{ fontFamily: 'var(--font-cormorant)', fontSize: 22, fontWeight: 600, color: '#F0EAE2', marginBottom: 12 }}>Supprimer cette propriété ?</h3>
            <p style={{ fontFamily: 'var(--font-outfit)', fontSize: 13, color: '#7A7168', lineHeight: 1.6, marginBottom: 24 }}>
              Cette action est irréversible. Toutes les données et recommandations seront supprimées.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDelete(false)} style={{ flex: 1, padding: '11px', borderRadius: 50, border: '1px solid #2A2A2A', background: 'transparent', color: '#7A7168', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-outfit)' }}>
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ flex: 1, padding: '11px', borderRadius: 50, border: 'none', background: 'rgba(248,113,113,0.15)', color: '#F87171', fontSize: 13, cursor: deleting ? 'default' : 'pointer', fontFamily: 'var(--font-outfit)', fontWeight: 600 }}
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
