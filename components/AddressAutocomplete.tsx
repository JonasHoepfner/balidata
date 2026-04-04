'use client'

import { useEffect, useRef } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

export type PlaceResult = {
  lat: number
  lng: number
  label: string
}

type Props = {
  value: string
  onChange: (val: string) => void
  onSelect: (place: PlaceResult) => void
  disabled?: boolean
}

// ── Google Maps loader (singleton) ─────────────────────────────────────────

let mapsReady: Promise<void> | null = null

function ensureMaps(): Promise<void> {
  if (mapsReady) return mapsReady
  setOptions({
    key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '',
    v: 'weekly',
  })
  mapsReady = importLibrary('places').then(() => undefined)
  return mapsReady
}

// ── PAC dropdown dark theme ────────────────────────────────────────────────

function injectPacStyles() {
  if (document.getElementById('pac-dark-styles')) return
  const s = document.createElement('style')
  s.id = 'pac-dark-styles'
  s.textContent = `
    .pac-container {
      background: #141414;
      border: 1px solid #2A2A2A;
      border-top: none;
      border-radius: 0 0 10px 10px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      font-family: system-ui, -apple-system, sans-serif;
    }
    .pac-item {
      padding: 10px 14px;
      cursor: pointer;
      border-top: 1px solid #1E1E1E;
      color: #A89880;
      font-size: 13px;
      line-height: 1.4;
    }
    .pac-item:hover, .pac-item-selected { background: #1A1A1A; }
    .pac-item-query { color: #E8E0D5; font-size: 13px; font-weight: 600; }
    .pac-matched { color: #C4A882; }
    .pac-icon, .pac-logo::after { display: none; }
  `
  document.head.appendChild(s)
}

// ── Component ──────────────────────────────────────────────────────────────

export function AddressAutocomplete({ value, onChange, onSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const acRef = useRef<google.maps.places.Autocomplete | null>(null)
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  useEffect(() => {
    let cancelled = false
    ensureMaps().then(() => {
      if (cancelled || !inputRef.current) return
      injectPacStyles()
      acRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'id' },
        fields: ['geometry', 'formatted_address'],
        types: ['geocode', 'establishment'],
      })
      acRef.current.addListener('place_changed', () => {
        const place = acRef.current!.getPlace()
        if (!place.geometry?.location) return
        onSelectRef.current({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          label: place.formatted_address ?? inputRef.current?.value ?? '',
        })
      })
    })
    return () => { cancelled = true }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Rechercher par adresse ou rue à Bali..."
      disabled={disabled}
      autoComplete="off"
      style={{
        width: '100%',
        background: '#0D0D0D',
        border: '1px solid #232323',
        borderRadius: 8,
        padding: '11px 12px',
        color: '#E8E0D5',
        fontSize: 14,
        outline: 'none',
        cursor: disabled ? 'not-allowed' : 'text',
        boxSizing: 'border-box',
        opacity: disabled ? 0.5 : 1,
      }}
    />
  )
}
