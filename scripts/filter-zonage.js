#!/usr/bin/env node
/**
 * filter-zonage.js
 * Filtre zonage-badung.geojson → zonage-canggu.geojson
 * Garde uniquement les zones utiles pour un investisseur STR dans la bbox Canggu/Pererenan
 * V2 : zone touristique rose pour residential côtier, badge STR conditionnel pour residential non côtier
 */

const fs   = require('fs')
const path = require('path')

const IN_PATH  = path.join(__dirname, '..', 'public', 'data', 'zonage-badung.geojson')
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'zonage-canggu.geojson')

// Bbox Canggu / Pererenan / Berawa
const BBOX = { minLon: 115.10, maxLon: 115.20, minLat: -8.70, maxLat: -8.62 }

// Bbox côtière touristique : residential ici → zone touristique rose, STR autorisé
const COASTAL_BBOX = { maxLon: 115.135, minLat: -8.665 }

// Zones conservées : label de base + str_compatible de base (coastal residential overrides below)
const ZONE_CONFIG = {
  residential:  { label: 'Résidentiel',       str_compatible: false, zone_color: 'residential' },
  commercial:   { label: 'Commercial',         str_compatible: true,  zone_color: 'commercial'  },
  retail:       { label: 'Commerce',           str_compatible: true,  zone_color: 'commercial'  },
  farmland:     { label: 'Zone agricole',      str_compatible: false, zone_color: 'agricultural'},
  beach:        { label: 'Plage',              str_compatible: true,  zone_color: 'beach'       },
  construction: { label: 'En construction',    str_compatible: false, zone_color: 'brownfield'  },
  brownfield:   { label: 'Terrain en friche',  str_compatible: false, zone_color: 'brownfield'  },
}

// ── Centroid helper ────────────────────────────────────────────────────────

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

function isCoastalTourist(feature) {
  const geom = feature.geometry
  if (!geom) return false
  const rings = geom.type === 'Polygon'
    ? geom.coordinates
    : geom.type === 'MultiPolygon'
      ? geom.coordinates.flat(1)
      : null
  if (!rings || rings.length === 0) return false
  const { cx, cy } = bboxOfRing(rings[0])
  return cx <= COASTAL_BBOX.maxLon && cy >= COASTAL_BBOX.minLat
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log('BaliData — Filtre de zonage Canggu V2')
console.log('=======================================')

if (!fs.existsSync(IN_PATH)) {
  console.error(`Fichier source introuvable : ${IN_PATH}`)
  console.error("Lance d'abord : node scripts/fetch-gistaru.js")
  process.exit(1)
}

console.log(`Lecture de ${IN_PATH}…`)
const raw     = fs.readFileSync(IN_PATH, 'utf8')
const geojson = JSON.parse(raw)
const total   = geojson.features.length
console.log(`Features avant filtrage : ${total}`)

// ── Filter ────────────────────────────────────────────────────────────────

const kept  = []
const stats = {}
let touristCount = 0

for (const feature of geojson.features) {
  const p    = feature.properties ?? {}
  const type = p.landuse ?? p.leisure ?? p.natural ?? null

  const config = type ? ZONE_CONFIG[type] : null
  if (!config) continue

  if (!featureInBbox(feature)) continue

  // Determine final zone properties
  let zone_label     = config.label
  let str_compatible = config.str_compatible
  let zone_color     = config.zone_color

  if (type === 'residential' && isCoastalTourist(feature)) {
    zone_label     = 'Zone Touristique'
    str_compatible = true
    zone_color     = 'tourist'
    touristCount++
  }

  feature.properties = {
    ...p,
    zone_type:      type,
    zone_label,
    str_compatible,
    zone_color,
  }

  kept.push(feature)
  stats[zone_color] = (stats[zone_color] ?? 0) + 1
}

// ── Save ──────────────────────────────────────────────────────────────────

const result = { type: 'FeatureCollection', features: kept }
const json   = JSON.stringify(result)
fs.writeFileSync(OUT_PATH, json, 'utf8')

const sizeKb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1)
const sizeMb = (Buffer.byteLength(json, 'utf8') / 1024 / 1024).toFixed(2)

// ── Report ────────────────────────────────────────────────────────────────

const COLOR_LABELS = {
  agricultural: 'Zone agricole (vert)',
  residential:  'Résidentiel (jaune)',
  commercial:   'Commercial/Commerce (orange)',
  beach:        'Plage (bleu)',
  brownfield:   'Terrain nu (gris)',
  tourist:      'Zone touristique (rose)',
}

console.log(`\nBbox appliquée : lon ${BBOX.minLon}–${BBOX.maxLon}, lat ${BBOX.minLat}–${BBOX.maxLat}`)
console.log(`Bbox côtière   : lon < ${COASTAL_BBOX.maxLon}, lat > ${COASTAL_BBOX.minLat}`)
console.log(`\nFeatures après filtrage : ${kept.length} / ${total}`)
console.log(`Taille fichier          : ${sizeKb} KB (${sizeMb} MB)`)
console.log(`Zones touristiques      : ${touristCount} (residential côtiers reclassifiés)`)
console.log(`\nRépartition par zone_color :`)
for (const [color, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${(COLOR_LABELS[color] ?? color).padEnd(32)} ${String(count).padStart(5)} zone(s)`)
}
console.log(`\nFichier sauvegardé : ${OUT_PATH}`)
