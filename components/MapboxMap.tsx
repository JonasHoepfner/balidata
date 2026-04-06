'use client'

import { useEffect, useRef, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// ── Types ──────────────────────────────────────────────────────────────────

export type Listing = {
  id: number
  latitude: number
  longitude: number
  price_per_night: number
  bedrooms: number
  occupancy_rate: number
  monthly_revenue: number
  title: string
  zone: string
}

export type ZonageFeature = {
  properties: {
    zone_type: string
    zone_label: string
    str_compatible: boolean
    name?: string
  }
}

export type SidebarContent =
  | { type: 'zone'; feature: ZonageFeature }
  | { type: 'estimate'; lng: number; lat: number; estimatedRevenue: number | null }
  | null

export type Filters = {
  bedrooms: number[]
  priceMin: number
  priceMax: number
}

export type Layers = {
  heatmap: boolean
  listings: boolean
  zonage: boolean
}

interface Props {
  listings: Listing[]
  filters: Filters
  layers: Layers
  onListingClick: (listing: Listing) => void
  onSidebarChange: (content: SidebarContent) => void
  onStatsChange: (stats: { count: number; medianPrice: number; medianRevenue: number; avgOccupancy: number }) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────

function median(arr: number[]) {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function buildFilter(filters: Filters): mapboxgl.Expression {
  const conditions: mapboxgl.Expression[] = [['==', ['get', 'type'], 'listing']]
  if (filters.bedrooms.length > 0) {
    conditions.push(['in', ['get', 'bedrooms'], ['literal', filters.bedrooms]])
  }
  if (filters.priceMin > 0) {
    conditions.push(['>=', ['get', 'price_per_night'], filters.priceMin])
  }
  if (filters.priceMax > 0) {
    conditions.push(['<=', ['get', 'price_per_night'], filters.priceMax])
  }
  return ['all', ...conditions] as mapboxgl.Expression
}

function listingsToGeoJSON(listings: Listing[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: listings.map(l => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [l.longitude, l.latitude] },
      properties: {
        type: 'listing',
        id: l.id,
        title: l.title,
        zone: l.zone,
        price_per_night: l.price_per_night,
        bedrooms: l.bedrooms,
        occupancy_rate: l.occupancy_rate,
        monthly_revenue: l.monthly_revenue,
      },
    })),
  }
}

// ── Zone color expression ──────────────────────────────────────────────────
// Uses Mapbox match expression on zone_type property

const ZONE_COLOR_EXPR: mapboxgl.Expression = [
  'match', ['get', 'zone_type'],
  ['farmland', 'orchard', 'meadow', 'grass', 'greenfield'], '#4CAF50',
  ['commercial', 'retail'], '#FF8C00',
  ['brownfield', 'construction'], '#888888',
  'beach', '#4A9FE8',
  'residential', '#FFD700',
  '#666666',
] as mapboxgl.Expression

// ── Component ──────────────────────────────────────────────────────────────

export default function MapboxMap({ listings, filters, layers, onListingClick, onSidebarChange, onStatsChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<mapboxgl.Map | null>(null)
  const initialized  = useRef(false)

  const onListingRef  = useRef(onListingClick)
  const onSidebarRef  = useRef(onSidebarChange)
  const onStatsRef    = useRef(onStatsChange)
  const listingsRef   = useRef(listings)
  useEffect(() => { onListingRef.current  = onListingClick  }, [onListingClick])
  useEffect(() => { onSidebarRef.current  = onSidebarChange }, [onSidebarChange])
  useEffect(() => { onStatsRef.current    = onStatsChange   }, [onStatsChange])
  useEffect(() => { listingsRef.current   = listings        }, [listings])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const recalcStats = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const bounds = map.getBounds()
    if (!bounds) return

    const visible = listingsRef.current.filter(l => {
      const inBounds = l.longitude >= bounds.getWest() && l.longitude <= bounds.getEast()
        && l.latitude >= bounds.getSouth() && l.latitude <= bounds.getNorth()
      if (!inBounds) return false
      if (filters.bedrooms.length > 0 && !filters.bedrooms.includes(l.bedrooms)) return false
      if (filters.priceMin > 0 && l.price_per_night < filters.priceMin) return false
      if (filters.priceMax > 0 && l.price_per_night > filters.priceMax) return false
      return true
    })

    onStatsRef.current({
      count: visible.length,
      medianPrice:   median(visible.map(l => l.price_per_night)),
      medianRevenue: median(visible.map(l => l.monthly_revenue)),
      avgOccupancy:  visible.length > 0
        ? Math.round(visible.reduce((s, l) => s + l.occupancy_rate, 0) / visible.length * 100)
        : 0,
    })
  }, [filters])

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || initialized.current) return
    initialized.current = true

    const token = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? ''
    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${token}`,
      center: [115.1366, -8.6478],
      zoom: 13,
      attributionControl: false,
    })
    mapRef.current = map

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('moveend', recalcStats)

    map.on('load', () => {
      const geojsonData = listingsToGeoJSON(listingsRef.current)

      // Sources
      map.addSource('listings', { type: 'geojson', data: geojsonData })
      map.addSource('zonage', { type: 'geojson', data: '/data/zonage-canggu.geojson' })

      // ── Zonage fill ───────────────────────────────────────────────────
      map.addLayer({
        id: 'zonage-fill',
        type: 'fill',
        source: 'zonage',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': ZONE_COLOR_EXPR,
          'fill-opacity': 0.25,
        },
      })

      // ── Zonage outline ────────────────────────────────────────────────
      map.addLayer({
        id: 'zonage-line',
        type: 'line',
        source: 'zonage',
        layout: { visibility: 'none' },
        paint: {
          'line-color': ZONE_COLOR_EXPR,
          'line-opacity': 0.6,
          'line-width': 1,
        },
      })

      // ── Heatmap — adaptive radius & intensity by zoom ─────────────────
      map.addLayer({
        id: 'listings-heat',
        type: 'heatmap',
        source: 'listings',
        layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'monthly_revenue'], 0, 0, 10000, 1],
          'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            11, 15,
            13, 25,
            15, 40,
            17, 60,
          ],
          'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'],
            11, 0.4,
            13, 0.6,
            15, 0.9,
            17, 1.2,
          ],
          'heatmap-opacity': 0.7,
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,   'rgba(10,10,40,0)',
            0.2, '#1a237e',
            0.5, '#C4A882',
            0.8, '#66BB6A',
            1,   '#4CAF50',
          ],
        },
      })

      // ── Listing circles ───────────────────────────────────────────────
      map.addLayer({
        id: 'listings-circle',
        type: 'circle',
        source: 'listings',
        layout: { visibility: 'visible' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 15, 9],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'monthly_revenue'],
            0,     '#e53935',
            3000,  '#FF9800',
            5000,  '#FDD835',
            7000,  '#66BB6A',
            10000, '#4CAF50',
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.9,
        },
      })

      // ── Hover ring ────────────────────────────────────────────────────
      map.addLayer({
        id: 'listings-circle-hover',
        type: 'circle',
        source: 'listings',
        layout: { visibility: 'visible' },
        filter: ['==', ['get', 'id'], -1],
        paint: {
          'circle-radius': 14,
          'circle-color': 'transparent',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#C4A882',
        },
      })

      // ── Hover interactions ────────────────────────────────────────────
      map.on('mouseenter', 'listings-circle', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'listings-circle', () => {
        map.getCanvas().style.cursor = ''
        map.setFilter('listings-circle-hover', ['==', ['get', 'id'], -1])
      })
      map.on('mousemove', 'listings-circle', e => {
        if (!e.features?.length) return
        map.setFilter('listings-circle-hover', ['==', ['get', 'id'], e.features[0].properties?.id ?? -1])
      })

      // ── Listing click → modal ─────────────────────────────────────────
      map.on('click', 'listings-circle', e => {
        if (!e.features?.length) return
        const p = e.features[0].properties
        if (!p) return
        const geom = e.features[0].geometry as GeoJSON.Point
        onListingRef.current({
          id:              p.id,
          latitude:        geom.coordinates[1],
          longitude:       geom.coordinates[0],
          price_per_night: p.price_per_night,
          bedrooms:        p.bedrooms,
          occupancy_rate:  p.occupancy_rate,
          monthly_revenue: p.monthly_revenue,
          title:           p.title,
          zone:            p.zone,
        })
      })

      // ── Zonage interactions ───────────────────────────────────────────
      map.on('mouseenter', 'zonage-fill', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'zonage-fill', () => { map.getCanvas().style.cursor = '' })
      map.on('click', 'zonage-fill', e => {
        if (!e.features?.length) return
        const p = e.features[0].properties
        if (!p) return
        const strTypes = ['commercial', 'retail', 'beach']
        const strCompatible = strTypes.includes(p.zone_type)
        onSidebarRef.current({
          type: 'zone',
          feature: { properties: { zone_type: p.zone_type, zone_label: p.zone_label ?? p.zone_type, str_compatible: strCompatible, name: p.name } },
        })
      })

      // ── Empty click → estimate ────────────────────────────────────────
      map.on('click', e => {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['listings-circle', 'zonage-fill'] })
        if (hit.length > 0) return
        const { lng, lat } = e.lngLat
        const nearby2BR = listingsRef.current.filter(l =>
          l.bedrooms === 2 && haversineKm(lat, lng, l.latitude, l.longitude) <= 1
        )
        const est = nearby2BR.length > 0
          ? Math.round(nearby2BR.reduce((s, l) => s + l.monthly_revenue, 0) / nearby2BR.length)
          : null
        onSidebarRef.current({ type: 'estimate', lng, lat, estimatedRevenue: est })
      })

      recalcStats()
    })

    return () => { map.remove(); mapRef.current = null; initialized.current = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync layers ───────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const set = (id: string, vis: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis ? 'visible' : 'none')
    }
    set('listings-heat',         layers.heatmap)
    set('listings-circle',       layers.listings)
    set('listings-circle-hover', layers.listings)
    set('zonage-fill',           layers.zonage)
    set('zonage-line',           layers.zonage)
  }, [layers])

  // ── Sync filters ──────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    if (map.getLayer('listings-circle')) map.setFilter('listings-circle', buildFilter(filters))
    if (map.getLayer('listings-heat'))   map.setFilter('listings-heat',   buildFilter(filters))
    recalcStats()
  }, [filters, recalcStats])

  // ── Sync data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const src = map.getSource('listings') as mapboxgl.GeoJSONSource | undefined
    if (src) src.setData(listingsToGeoJSON(listings))
    recalcStats()
  }, [listings, recalcStats])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
