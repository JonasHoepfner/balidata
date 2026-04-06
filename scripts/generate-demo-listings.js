#!/usr/bin/env node
/**
 * generate-demo-listings.js
 * Génère 150 listings Airbnb fictifs mais réalistes autour de Canggu/Pererenan/Berawa
 */

const fs   = require('fs')
const path = require('path')

const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'demo-listings.json')

// ── Zone definitions ───────────────────────────────────────────────────────
// Chaque zone a une bbox, un poids de densité, et une fourchette de prix

// Bbox corrigée : lon >= 115.125 pour éviter les listings en mer
const ZONES = [
  {
    name: 'Canggu',
    weight: 40,          // ~40% des listings
    lon: [115.130, 115.158],
    lat: [-8.668, -8.638],
    priceRange: [150, 450],
  },
  {
    name: 'Berawa',
    weight: 30,          // ~30%
    lon: [115.152, 115.185],
    lat: [-8.672, -8.640],
    priceRange: [120, 380],
  },
  {
    name: 'Batu Bolong',
    weight: 20,          // ~20%
    lon: [115.130, 115.150],
    lat: [-8.672, -8.655],
    priceRange: [100, 300],
  },
  {
    name: 'Pererenan',
    weight: 10,          // ~10% — plus clairsemé
    lon: [115.125, 115.135],
    lat: [-8.660, -8.630],
    priceRange: [80, 220],
  },
]

// ── Name parts ────────────────────────────────────────────────────────────

const PREFIXES  = ['Villa', 'Casa', 'The', 'Rumah', 'Puri', 'Omah', 'Joglo']
const NAMES     = [
  'Serenity', 'Harmony', 'Lotus', 'Coconut', 'Bamboo', 'Sunset', 'Ricefield',
  'Tropical', 'Paradise', 'Tranquil', 'Azure', 'Saffron', 'Jasmine', 'Frangipani',
  'Lush', 'Bloom', 'Breeze', 'Oasis', 'Verdant', 'Indigo',
]
const SUFFIXES  = ['Retreat', 'Escape', 'Hide', 'Nest', 'Haven', 'Sanctuary', '']

// ── RNG ───────────────────────────────────────────────────────────────────

// Simple deterministic-ish pseudo-random using seed
let seed = 42
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff
  return (seed >>> 0) / 0xffffffff
}
function randBetween(min, max) { return min + rand() * (max - min) }
function randInt(min, max)     { return Math.floor(randBetween(min, max + 1)) }
function pick(arr)             { return arr[Math.floor(rand() * arr.length)] }

// ── Distribution ──────────────────────────────────────────────────────────

function weightedZone() {
  const total = ZONES.reduce((s, z) => s + z.weight, 0)
  let r = rand() * total
  for (const z of ZONES) {
    r -= z.weight
    if (r <= 0) return z
  }
  return ZONES[0]
}

// ── Generate ──────────────────────────────────────────────────────────────

const listings = []

for (let i = 0; i < 150; i++) {
  const zone = weightedZone()

  const latitude    = randBetween(zone.lat[0], zone.lat[1])
  const longitude   = randBetween(zone.lon[0], zone.lon[1])
  const bedrooms    = randInt(1, 5)
  const priceMin    = zone.priceRange[0] + (bedrooms - 1) * 30
  const priceMax    = Math.min(zone.priceRange[1] + (bedrooms - 1) * 40, 500)
  const price       = Math.round(randBetween(priceMin, priceMax) / 5) * 5  // round to $5

  // Occupancy: higher-end listings slightly lower, budget slightly higher
  const baseOcc     = 0.62 + (rand() * 0.23) - (price / 500) * 0.08
  const occupancy   = Math.min(0.85, Math.max(0.45, +baseOcc.toFixed(2)))

  const monthly_revenue = Math.round(price * occupancy * 30)

  // Title
  const prefix  = pick(PREFIXES)
  const name    = pick(NAMES)
  const suffix  = pick(SUFFIXES)
  const br      = `${bedrooms}BR`
  const title   = suffix
    ? `${prefix} ${name} ${br} — ${zone.name}`
    : `${prefix} ${name} ${suffix} ${br} — ${zone.name}`

  listings.push({
    id:               i + 1,
    latitude:         +latitude.toFixed(6),
    longitude:        +longitude.toFixed(6),
    price_per_night:  price,
    bedrooms,
    occupancy_rate:   occupancy,
    monthly_revenue,
    title:            title.replace(/\s+/g, ' ').trim(),
    zone:             zone.name,
  })
}

// ── Save ──────────────────────────────────────────────────────────────────

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
fs.writeFileSync(OUT_PATH, JSON.stringify(listings, null, 2), 'utf8')

// ── Report ────────────────────────────────────────────────────────────────

const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1)

console.log('BaliData — Génération listings démo')
console.log('=====================================')
console.log(`Listings générés : ${listings.length}`)
console.log(`Taille fichier   : ${sizeKb} KB`)

// Per-zone stats
const byZone = {}
for (const l of listings) {
  if (!byZone[l.zone]) byZone[l.zone] = { count: 0, prices: [], revenues: [] }
  byZone[l.zone].count++
  byZone[l.zone].prices.push(l.price_per_night)
  byZone[l.zone].revenues.push(l.monthly_revenue)
}

console.log('\nDistribution par zone :')
for (const [zone, s] of Object.entries(byZone)) {
  const avgPrice   = Math.round(s.prices.reduce((a, b) => a + b, 0) / s.count)
  const avgRevenue = Math.round(s.revenues.reduce((a, b) => a + b, 0) / s.count)
  console.log(`  ${zone.padEnd(12)} ${String(s.count).padStart(3)} listings  |  prix moy: $${avgPrice}/nuit  |  revenu moy: $${avgRevenue}/mois`)
}

console.log('\nExemple (3 premiers listings) :')
listings.slice(0, 3).forEach(l => console.log(`  [${l.id}] ${l.title} — $${l.price_per_night}/nuit, ${Math.round(l.occupancy_rate * 100)}% occ, $${l.monthly_revenue}/mois`))

console.log(`\nFichier : ${OUT_PATH}`)
