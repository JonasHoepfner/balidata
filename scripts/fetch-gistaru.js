#!/usr/bin/env node
/**
 * fetch-gistaru.js
 * Récupère les polygones de zonage RDTR de Badung (Canggu/Pererenan/Berawa)
 * Sources tentées dans l'ordre : GISTARU ArcGIS → Overpass OSM → GeoJSON de démo
 */

const https = require('https')
const http  = require('http')
const fs    = require('fs')
const path  = require('path')

const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'zonage-badung.geojson')

// Bounding box Canggu / Pererenan / Berawa
const BBOX = { minLon: 114.9, minLat: -8.7, maxLon: 115.3, maxLat: -8.5 }

// ── HTTP helper ────────────────────────────────────────────────────────────

function get(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { headers: { 'User-Agent': 'BaliData/1.0' } }, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
    })
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)) })
    req.on('error', reject)
  })
}

// ── STEP 1 — Explorer GISTARU ──────────────────────────────────────────────

async function exploreGistaru() {
  console.log('\n━━━ ÉTAPE 1 — Exploration GISTARU ━━━')
  const endpoints = [
    'https://gistaru.atrbpn.go.id/arcgis/rest/services?f=json',
    'https://gistaru.atrbpn.go.id/arcgis/rest/services/RDTR/MapServer?f=json',
    'https://gistaru.atrbpn.go.id/arcgis/rest/services/RDTR/MapServer/layers?f=json',
  ]

  for (const url of endpoints) {
    try {
      console.log(`\n→ GET ${url}`)
      const { status, body } = await get(url, 12000)
      console.log(`  Status: ${status}`)
      if (status === 200) {
        const json = JSON.parse(body)
        if (json.layers) {
          console.log(`  Layers trouvés (${json.layers.length}) :`)
          json.layers.forEach(l => console.log(`    [${l.id}] ${l.name} — type: ${l.type}`))
          return json.layers
        }
        if (json.services) {
          console.log(`  Services : ${json.services.map(s => s.name).join(', ')}`)
        }
        if (json.id !== undefined) {
          console.log(`  MapServer info — layers: ${JSON.stringify(json.layers ?? []).slice(0, 200)}`)
          if (Array.isArray(json.layers)) {
            console.log(`  Layers (${json.layers.length}) :`)
            json.layers.forEach(l => console.log(`    [${l.id}] ${l.name}`))
            return json.layers
          }
        }
      } else {
        console.log(`  Body: ${body.slice(0, 300)}`)
      }
    } catch (err) {
      console.log(`  Erreur: ${err.message}`)
    }
  }
  return null
}

// ── STEP 2 — Requête WFS GISTARU ──────────────────────────────────────────

async function fetchGistaruLayer(layerId) {
  const { minLon, minLat, maxLon, maxLat } = BBOX
  const url = [
    `https://gistaru.atrbpn.go.id/arcgis/rest/services/RDTR/MapServer/${layerId}/query`,
    `?where=1%3D1`,
    `&geometry=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}`,
    `&geometryType=esriGeometryEnvelope`,
    `&spatialRel=esriSpatialRelIntersects`,
    `&outFields=*`,
    `&f=geojson`,
    `&resultRecordCount=500`,
  ].join('')

  console.log(`\n→ Query layer ${layerId}: ...query?where=1%3D1&geometry=${minLon},${minLat},...`)
  try {
    const { status, body } = await get(url, 20000)
    console.log(`  Status: ${status}`)
    if (status === 200) {
      const json = JSON.parse(body)
      if (json.features && json.features.length > 0) {
        return json
      }
      console.log(`  Réponse valide mais 0 features. Body: ${body.slice(0, 200)}`)
    } else {
      console.log(`  Body: ${body.slice(0, 300)}`)
    }
  } catch (err) {
    console.log(`  Erreur: ${err.message}`)
  }
  return null
}

async function tryGistaru() {
  console.log('\n━━━ ÉTAPE 2 — Requête zonage GISTARU ━━━')
  const layers = await exploreGistaru()

  const candidateIds = layers
    ? layers.map(l => l.id)
    : [0, 1, 2, 3, 4, 5]  // fallback blind try

  for (const id of candidateIds.slice(0, 8)) {
    const geojson = await fetchGistaruLayer(id)
    if (geojson) return geojson
  }
  return null
}

// ── STEP 4 — Overpass OSM ─────────────────────────────────────────────────

async function fetchOverpass() {
  console.log('\n━━━ ÉTAPE 4 — Fallback Overpass OSM ━━━')

  // Query landuse polygons in the Canggu area bounding box
  const query = `[out:json][timeout:30];
(
  way["landuse"](${BBOX.minLat},${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon});
  relation["landuse"]["type"="multipolygon"](${BBOX.minLat},${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon});
  way["leisure"](${BBOX.minLat},${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon});
  way["natural"](${BBOX.minLat},${BBOX.minLon},${BBOX.maxLat},${BBOX.maxLon});
);
out geom;`

  const encoded = encodeURIComponent(query)
  const url = `https://overpass-api.de/api/interpreter?data=${encoded}`

  console.log('→ GET Overpass API (landuse Canggu bbox)…')
  try {
    const { status, body } = await get(url, 30000)
    console.log(`  Status: ${status}`)
    if (status !== 200) { console.log(`  Body: ${body.slice(0, 300)}`); return null }

    const json = JSON.parse(body)
    const elements = (json.elements ?? []).filter(e => e.geometry || e.members)
    console.log(`  Éléments OSM reçus: ${elements.length}`)

    if (elements.length === 0) return null

    // Convert OSM ways to GeoJSON polygons
    const features = []
    for (const el of elements) {
      if (el.type === 'way' && el.geometry && el.geometry.length >= 3) {
        const coords = el.geometry.map(p => [p.lon, p.lat])
        // Close ring if needed
        const first = coords[0], last = coords[coords.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first)
        features.push({
          type: 'Feature',
          properties: {
            id: el.id,
            source: 'OpenStreetMap',
            landuse: el.tags?.landuse ?? null,
            leisure: el.tags?.leisure ?? null,
            natural: el.tags?.natural ?? null,
            name: el.tags?.name ?? el.tags?.['name:en'] ?? null,
          },
          geometry: { type: 'Polygon', coordinates: [coords] },
        })
      }
    }

    console.log(`  Features GeoJSON converties: ${features.length}`)
    if (features.length === 0) return null

    return { type: 'FeatureCollection', features }
  } catch (err) {
    console.log(`  Erreur: ${err.message}`)
    return null
  }
}

// ── STEP 5 — GeoJSON de démo ───────────────────────────────────────────────

function makeDemoGeojson() {
  console.log('\n━━━ ÉTAPE 5 — Génération GeoJSON de démo ━━━')
  console.log('  Création de polygones approximatifs basés sur Google Maps…')

  // Real approximate zones visible in Canggu/Pererenan/Berawa area
  const zones = [
    {
      name: 'Canggu Beach Area',
      zone_type: 'Pariwisata',
      zone_code: 'W-1',
      coords: [[115.129, -8.651], [115.146, -8.651], [115.146, -8.663], [115.129, -8.663], [115.129, -8.651]],
    },
    {
      name: 'Berawa Residential',
      zone_type: 'Perumahan',
      zone_code: 'R-2',
      coords: [[115.146, -8.651], [115.163, -8.651], [115.163, -8.667], [115.146, -8.667], [115.146, -8.651]],
    },
    {
      name: 'Pererenan North',
      zone_type: 'Pertanian',
      zone_code: 'P-1',
      coords: [[115.112, -8.641], [115.130, -8.641], [115.130, -8.655], [115.112, -8.655], [115.112, -8.641]],
    },
    {
      name: 'Canggu Commercial Corridor',
      zone_type: 'Perdagangan & Jasa',
      zone_code: 'K-2',
      coords: [[115.130, -8.655], [115.150, -8.655], [115.150, -8.663], [115.130, -8.663], [115.130, -8.655]],
    },
    {
      name: 'Batu Bolong Mixed Use',
      zone_type: 'Campuran',
      zone_code: 'C-1',
      coords: [[115.120, -8.662], [115.135, -8.662], [115.135, -8.673], [115.120, -8.673], [115.120, -8.662]],
    },
    {
      name: 'Echo Beach Tourism',
      zone_type: 'Pariwisata',
      zone_code: 'W-2',
      coords: [[115.105, -8.652], [115.120, -8.652], [115.120, -8.664], [115.105, -8.664], [115.105, -8.652]],
    },
  ]

  const features = zones.map((z, i) => ({
    type: 'Feature',
    properties: {
      id: i + 1,
      source: 'demo',
      name: z.name,
      zone_type: z.zone_type,
      zone_code: z.zone_code,
      kecamatan: 'Kuta Utara',
      kabupaten: 'Badung',
    },
    geometry: { type: 'Polygon', coordinates: [z.coords] },
  }))

  console.log(`  ${features.length} zones de démo générées.`)
  return { type: 'FeatureCollection', features }
}

// ── Report ─────────────────────────────────────────────────────────────────

function printReport(source, geojson) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('RAPPORT FINAL')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Source utilisée  : ${source}`)
  console.log(`Polygones        : ${geojson.features.length}`)

  // Types de zones
  const types = {}
  for (const f of geojson.features) {
    const t = f.properties?.zone_type ?? f.properties?.landuse ?? f.properties?.natural ?? 'inconnu'
    types[t] = (types[t] ?? 0) + 1
  }
  console.log('\nTypes de zones disponibles :')
  for (const [k, v] of Object.entries(types)) {
    console.log(`  ${k}: ${v} polygone(s)`)
  }

  console.log('\nExemple de propriétés (feature[0]) :')
  console.log(JSON.stringify(geojson.features[0]?.properties, null, 2))
  console.log(`\nFichier sauvegardé : ${OUT_PATH}`)
}

// ── Main ───────────────────────────────────────────────────────────────────

;(async () => {
  console.log('BaliData — Extracteur de zonage Badung')
  console.log('========================================')
  console.log(`Bounding box : ${BBOX.minLon},${BBOX.minLat} → ${BBOX.maxLon},${BBOX.maxLat}`)

  let geojson = null
  let source  = null

  // Try GISTARU
  geojson = await tryGistaru()
  if (geojson) { source = 'GISTARU (ArcGIS MapServer)' }

  // Try Overpass
  if (!geojson) {
    geojson = await fetchOverpass()
    if (geojson) { source = 'OpenStreetMap (Overpass API)' }
  }

  // Demo fallback
  if (!geojson) {
    geojson = makeDemoGeojson()
    source  = 'Démo (polygones approximatifs Canggu)'
  }

  // Save
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(geojson, null, 2), 'utf8')

  printReport(source, geojson)
})()
