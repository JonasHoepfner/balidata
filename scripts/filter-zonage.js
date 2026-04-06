#!/usr/bin/env node
/**
 * filter-zonage.js
 * Filtre zonage-badung.geojson → zonage-canggu.geojson
 * Garde uniquement les zones utiles pour un investisseur STR dans la bbox Canggu/Pererenan
 */

const fs   = require('fs')
const path = require('path')

const IN_PATH  = path.join(__dirname, '..', 'public', 'data', 'zonage-badung.geojson')
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'zonage-canggu.geojson')

// Bbox Canggu / Pererenan / Berawa (resserrée)
const BBOX = { minLon: 115.10, maxLon: 115.20, minLat: -8.70, maxLat: -8.62 }

// Zones conservées + labels + compatibilité STR
const ZONE_CONFIG = {
  residential:  { label: 'Résidentiel',       str_compatible: true  },
  commercial:   { label: 'Commercial',         str_compatible: true  },
  retail:       { label: 'Commerce',           str_compatible: true  },
  farmland:     { label: 'Zone agricole',      str_compatible: false },
  beach:        { label: 'Plage',              str_compatible: true  },
  construction: { label: 'En construction',    str_compatible: true  },
  brownfield:   { label: 'Terrain en friche',  str_compatible: false },
}

// ── Centroid helper (simple bbox center for speed) ─────────────────────────

function bboxOfRing(ring) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }
}

function featureInBbox(feature) {
  const geom = feature.geometry
  if (!geom) return false
  const rings = geom.type === 'Polygon'
    ? geom.coordinates
    : geom.type === 'MultiPolygon'
      ? geom.coordinates.flat(1)
      : null
  if (!rings || rings.length === 0) return false
  const { cx, cy } = bboxOfRing(rings[0])
  return cx >= BBOX.minLon && cx <= BBOX.maxLon && cy >= BBOX.minLat && cy <= BBOX.maxLat
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log('BaliData — Filtre de zonage Canggu')
console.log('====================================')

if (!fs.existsSync(IN_PATH)) {
  console.error(`Fichier source introuvable : ${IN_PATH}`)
  console.error('Lance d\'abord : node scripts/fetch-gistaru.js')
  process.exit(1)
}

console.log(`Lecture de ${IN_PATH}…`)
const raw     = fs.readFileSync(IN_PATH, 'utf8')
const geojson = JSON.parse(raw)
const total   = geojson.features.length
console.log(`Features avant filtrage : ${total}`)

// ── Filter ────────────────────────────────────────────────────────────────

const kept = []
const stats = {}

for (const feature of geojson.features) {
  const p = feature.properties ?? {}
  const type = p.landuse ?? p.leisure ?? p.natural ?? null

  // 1. Zone type must be in allowed list
  const config = type ? ZONE_CONFIG[type] : null
  if (!config) continue

  // 2. Centroid must be inside Canggu bbox
  if (!featureInBbox(feature)) continue

  // 3. Enrich properties
  feature.properties = {
    ...p,
    zone_type:      type,
    zone_label:     config.label,
    str_compatible: config.str_compatible,
  }

  kept.push(feature)
  stats[type] = (stats[type] ?? 0) + 1
}

// ── Save ──────────────────────────────────────────────────────────────────

const result = { type: 'FeatureCollection', features: kept }
const json   = JSON.stringify(result)
fs.writeFileSync(OUT_PATH, json, 'utf8')

const sizeKb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1)
const sizeMb = (Buffer.byteLength(json, 'utf8') / 1024 / 1024).toFixed(2)

// ── Report ────────────────────────────────────────────────────────────────

console.log(`\nBbox appliquée : lon ${BBOX.minLon}–${BBOX.maxLon}, lat ${BBOX.minLat}–${BBOX.maxLat}`)
console.log(`\nFeatures après filtrage : ${kept.length} / ${total} (${((kept.length / total) * 100).toFixed(1)}% conservées)`)
console.log(`Taille fichier résultant : ${sizeKb} KB (${sizeMb} MB)`)
console.log(`\nRépartition par type :`)
for (const [type, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  const cfg = ZONE_CONFIG[type]
  console.log(`  ${type.padEnd(14)} ${String(count).padStart(5)} zone(s)  |  "${cfg.label}"  STR: ${cfg.str_compatible ? '✓' : '✗'}`)
}
console.log(`\nFichier sauvegardé : ${OUT_PATH}`)
