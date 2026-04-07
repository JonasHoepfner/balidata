# BaliData — Contexte projet pour Claude Code

> Document généré le 2026-04-07. À mettre à jour à chaque sprint majeur.

---

## Stack technique

### Runtime & framework
- **Next.js 16.2.2** — App Router, Server Components, route groups
- **React 19.2.4**
- **TypeScript 5**

### Dépendances production
| Package | Version | Usage |
|---------|---------|-------|
| `@supabase/ssr` | ^0.10.0 | Auth SSR (cookies), Server Components |
| `@supabase/supabase-js` | ^2.101.1 | Client Supabase |
| `stripe` | ^22.0.0 | Paiements, webhooks, portail facturation |
| `@stripe/stripe-js` | ^9.0.1 | (installé, non utilisé côté client pour l'instant) |
| `resend` | ^6.10.0 | Emails transactionnels (confirmation paiement) |
| `mapbox-gl` | ^3.21.0 | Carte interactive (utilisé avec token MapTiler) |
| `@types/mapbox-gl` | ^3.4.1 | Types TypeScript pour mapbox-gl |
| `@googlemaps/js-api-loader` | ^2.0.2 | Autocomplétion adresse (AddressAutocomplete) |
| `@types/google.maps` | ^3.58.1 | Types Google Maps |
| `next` | 16.2.2 | — |

### Dépendances dev
- `typescript`, `eslint`, `eslint-config-next`, `tailwindcss` (installé, non utilisé — tout le style est en CSS inline)

---

## Structure des fichiers

```
app/
├── layout.tsx                          # Root layout : fonts, Providers
├── page.tsx                            # Landing page publique
├── login/page.tsx                      # Page connexion (magic link + mot de passe)
├── onboarding/page.tsx                 # Onboarding post-inscription (prénom/nom/profil/pays)
├── pricing/page.tsx                    # Page tarification (plans once & monthly)
├── success/page.tsx                    # Page succès post-paiement Stripe
├── rapport/[id]/page.tsx               # Rapport d'analyse complet (7 sections)
├── auth/
│   └── callback/route.ts              # Handler OAuth Google + magic link
└── (dashboard)/                        # Route group (pas dans l'URL)
    ├── layout.tsx                      # Layout sidebar dashboard (240px fixe)
    └── dashboard/
        ├── page.tsx                    # Tableau de bord : stats, dernier rapport
        ├── analyses/page.tsx           # Liste des analyses passées
        ├── nouvelle-analyse/page.tsx   # Formulaire nouvelle analyse
        ├── carte/page.tsx              # Carte interactive Mapbox/MapTiler
        ├── abonnement/page.tsx         # Gestion abonnement + historique paiements
        └── profil/page.tsx             # Édition profil utilisateur

app/api/
├── me/route.ts                         # GET — profil complet utilisateur connecté
├── profile/route.ts                    # PATCH — upsert profil (prénom, nom, pays, avatar_type)
├── comparables/route.ts               # POST — stats Airbnb par zone ou GPS + Haversine
├── reports/route.ts                    # GET (liste) + POST (création rapport)
├── reports/[id]/route.ts              # GET — rapport + zone_stats + badungMedian
├── reports/[id]/generate/route.ts     # POST — génération recommandations Claude API
├── billing/route.ts                    # GET — historique factures Stripe + currentPeriodEnd
├── cancel-subscription/route.ts       # POST — annulation fin de période (cancel_at_period_end)
├── create-checkout/route.ts           # POST — session Stripe Checkout (once / monthly / b2b)
├── customer-portal/route.ts           # POST — session Stripe Billing Portal (legacy, conservé)
└── webhook/route.ts                    # POST — Stripe webhook (checkout.session.completed)

components/
├── AuthModal.tsx                       # Modal connexion (Google OAuth + magic link + mot de passe)
├── AnalysisForm.tsx                    # Formulaire analyse : adresse, zone, chambres, prix
├── AddressAutocomplete.tsx            # Input autocomplétion Google Maps Places
├── AnalysisDemo.tsx                    # Démo animée sur la landing (non-interactive)
├── MapboxMap.tsx                       # Carte Mapbox GL JS (heatmap, listings, zonage)
└── Providers.tsx                       # Provider AuthModalContext + AuthModal singleton

lib/
├── supabase.ts                         # supabaseAdmin (service role, server-side uniquement)
├── supabase-browser.ts                # createSupabaseBrowserClient (client components)
└── supabase-server.ts                 # createSupabaseServerClient (Server Components, cookies)

scripts/
├── fetch-gistaru.js                    # Récupère polygones zonage GISTARU ou OSM Overpass
├── filter-zonage.js                    # Filtre zonage-badung → zonage-canggu (bbox + types)
└── generate-demo-listings.js          # Génère 150 listings fictifs réalistes

public/data/
├── demo-listings.json                  # 150 listings démo (36.7 KB)
├── zonage-canggu.geojson              # Polygones filtrés Canggu (2.74 MB, 5033 features)
└── zonage-badung.geojson              # Polygones bruts Badung OSM (13.3 MB, 9277 features)

supabase/migrations/
├── 002_align_schema.sql
├── 003_reports_extend.sql
├── 004_subscribers_profile.sql
└── 005_admin.sql

context/
└── AuthModalContext.tsx               # Context React pour ouvrir/fermer AuthModal
```

---

## Routes API

| Route | Méthode | Auth | Rôle |
|-------|---------|------|------|
| `/api/me` | GET | optionnel | Retourne profil complet : isPaid, isAdmin, plan, firstName, lastName, email, country, avatarType, planCreatedAt |
| `/api/profile` | PATCH | requis | Upsert subscribers : first_name, last_name, avatar_type, country |
| `/api/comparables` | POST | non | Stats marché par zone (GPS Haversine ou zone string) depuis `str_listings`. Auto-expand rayon si < 5 résultats |
| `/api/reports` | GET | requis | Liste des rapports de l'utilisateur (50 derniers) |
| `/api/reports` | POST | requis | Crée un rapport avec toutes les stats d'analyse |
| `/api/reports/[id]` | GET | requis | Rapport + zone_stats + badungMedian. Vérifie user_id ownership (403) |
| `/api/reports/[id]/generate` | POST | requis | Appelle Claude Sonnet 4.6 pour 4 recommandations. Stub si clé placeholder |
| `/api/billing` | GET | requis | Stripe invoices.list + subscriptions.retrieve → currentPeriodEnd, cancelAt, invoices[] |
| `/api/cancel-subscription` | POST | requis | stripe.subscriptions.update(cancel_at_period_end: true) + active=false en DB |
| `/api/create-checkout` | POST | non | Stripe Checkout session : plans `once` ($29), `monthly` ($39), `b2b` ($199) |
| `/api/customer-portal` | POST | requis | Stripe Billing Portal session (legacy, conservé) |
| `/api/webhook` | POST | Stripe sig | checkout.session.completed → insert subscribers + email Resend |
| `/auth/callback` | GET | — | Échange code OAuth → redirect onboarding / pricing / dashboard |

---

## Pages

| Chemin | Protection | Rôle |
|--------|-----------|------|
| `/` | publique | Landing page : hero, AnalysisForm, features, CTA. Trigger AuthModal au scroll 30% |
| `/login` | publique | Connexion : Google OAuth, magic link, email+mot de passe (toggle) |
| `/onboarding` | auth requis | Collecte prénom, nom, profil investisseur, pays. Redirect → /pricing ou /dashboard |
| `/pricing` | auth requis | Plans tarifaires. Checkout Stripe |
| `/success` | publique | Page confirmation post-paiement |
| `/rapport/[id]` | auth requis | Rapport complet 7 sections : identité, KPIs, barre prix, analyse marché, scoring, recommandations Claude, 3 projections |
| `/dashboard` | auth requis | Tableau de bord : bonjour [prénom], 3 stats cards, dernier rapport |
| `/dashboard/analyses` | auth requis | Historique des analyses en table |
| `/dashboard/nouvelle-analyse` | auth requis | AnalysisForm avec directCheckout (skip auth check) |
| `/dashboard/carte` | auth requis | Carte interactive MapTiler : heatmap revenus, listings, zonage OSM, filtres, modal listing, estimation zone |
| `/dashboard/abonnement` | auth requis | Plan actif, historique paiements Stripe, upsell once→monthly, résiliation 2 étapes + sondage |
| `/dashboard/profil` | auth requis | Édition prénom/nom/profil/pays |

---

## Schéma base de données (Supabase)

### Table `subscribers`
| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid PK | — |
| `user_id` | uuid FK → auth.users | — |
| `plan` | text | `'once'` ou `'monthly'` ou `null` |
| `active` | boolean | `true` si abonnement actif |
| `stripe_customer_id` | text | ID client Stripe |
| `stripe_subscription_id` | text | ID abonnement Stripe (monthly) |
| `stripe_session_id` | text unique | ID session checkout |
| `first_name` | text | — |
| `last_name` | text | — |
| `avatar_type` | text | `investisseur` / `proprietaire` / `developpeur` / `conseiller_financier` |
| `country` | text | Pays de résidence |
| `is_admin` | boolean | default false — bypass paywall |
| `created_at` | timestamptz | — |

### Table `reports`
| Colonne | Type | Notes |
|---------|------|-------|
| `id` | uuid PK | — |
| `user_id` | uuid FK → auth.users | — |
| `zone` | text | Ex: "Canggu", "Seminyak" |
| `bedrooms` | integer | — |
| `verdict` | text | `realiste` / `optimiste` / `survendu` / `no_data` |
| `project_type` | text | Type de projet investisseur |
| `price_announced` | numeric | Prix annoncé par le vendeur |
| `developer_price` | numeric | Prix promoteur si neuf |
| `price_median` | numeric | Médiane du marché |
| `price_p25` | numeric | Percentile 25 |
| `price_p75` | numeric | Percentile 75 |
| `price_avg` | numeric | Moyenne |
| `listings_count` | integer | Nombre de comparables |
| `est_monthly_revenue` | numeric | Revenu mensuel estimé |
| `avg_reviews` | numeric | Moyenne des avis |
| `variance_pct` | numeric | Écart prix annoncé vs médian en % |
| `report_content` | jsonb | Recommandations Claude : `{market_context, pricing, positioning, optimization}` |
| `created_at` | timestamptz | — |

### Table `str_listings`
| Colonne | Type | Notes |
|---------|------|-------|
| `airbnb_id` | text | — |
| `title` | text | — |
| `price_per_night_usd` | numeric | — |
| `reviews_count` | integer | — |
| `bedrooms` | integer | — |
| `zone` | text | — |
| `latitude` | numeric | — |
| `longitude` | numeric | — |
| `airbnb_url` | text | — |

> Table principale alimentée par le pipeline Apify (non encore en production).

### Table `zone_stats`
| Colonne | Type | Notes |
|---------|------|-------|
| `zone` | text | — |
| `bedrooms` | integer | — |
| `price_median` | numeric | — |
| `price_p25` | numeric | — |
| `price_p75` | numeric | — |
| (autres colonnes stats) | — | Agrégats pré-calculés par zone+chambres |

> Table de cache pré-agrégé — alimentée par cron job (non encore actif).

---

## Variables d'environnement

Fichier `.env.local` à la racine :

```
NEXT_PUBLIC_SUPABASE_URL          # URL projet Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY     # Clé anonyme Supabase (publique)
SUPABASE_SERVICE_KEY              # Clé service role (serveur uniquement)
STRIPE_SECRET_KEY                 # Clé secrète Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY # Clé publique Stripe
NEXT_PUBLIC_BASE_URL              # URL de base (localhost:3000 en dev, domaine en prod)
NEXT_PUBLIC_GOOGLE_MAPS_KEY       # Clé API Google Maps (Places Autocomplete)
STRIPE_WEBHOOK_SECRET             # Secret webhook Stripe (whsec_...)
RESEND_API_KEY                    # Clé API Resend (emails transactionnels)
ANTHROPIC_API_KEY                 # Clé API Anthropic (Claude Sonnet 4.6)
NEXT_PUBLIC_MAPTILER_KEY          # Clé API MapTiler (carte interactive)
```

---

## Composants

| Composant | Type | Rôle |
|-----------|------|------|
| `AuthModal` | Client | Modal de connexion overlay. Modes : Google OAuth, magic link OTP, email+mot de passe (signup/login). Redirect post-login via `/api/me` |
| `AnalysisForm` | Client | Formulaire principal d'analyse STR. Étapes : adresse (Google Places), zone (Badung, Seminyak…), chambres, prix annoncé, type projet. Prop `directCheckout` pour bypass auth check dans le dashboard |
| `AddressAutocomplete` | Client | Input avec dropdown Google Maps Places API. Retourne `{lat, lng, label}` |
| `AnalysisDemo` | Client | Démo animée (étapes simulées) sur la landing page. Purement visuel |
| `MapboxMap` | Client (`'use client'`, `ssr: false`) | Carte Mapbox GL JS avec token MapTiler. Layers : heatmap revenus (adaptive zoom), cercles listings (couleur par revenu), polygones zonage OSM (couleur par zone_color). Filtres via `map.setFilter()`. Émet `onListingClick` et `onSidebarChange` |
| `Providers` | Client | Wrapper racine qui instancie `AuthModalProvider` + `AuthModal` (singleton global) |

---

## Scripts Node.js

| Script | Commande | Rôle |
|--------|---------|------|
| `fetch-gistaru.js` | `node scripts/fetch-gistaru.js` | Tente GISTARU ArcGIS → fallback Overpass OSM. Récupère 9 277 polygones de zonage Badung. Sauvegarde dans `public/data/zonage-badung.geojson` |
| `filter-zonage.js` | `node scripts/filter-zonage.js` | Lit `zonage-badung.geojson`, filtre sur bbox Canggu + types utiles (residential, commercial, retail, farmland, beach, construction, brownfield). Ajoute `zone_label`, `str_compatible`, `zone_color`. Identifie zones touristiques côtières (lon < 115.135 ET lat > -8.665) → `zone_color: 'tourist'`. Sauvegarde `public/data/zonage-canggu.geojson` |
| `generate-demo-listings.js` | `node scripts/generate-demo-listings.js` | Génère 150 listings fictifs réalistes. Bbox stricte par zone (lon min 115.118 pour éviter la mer). Distribution : Canggu 40%, Berawa 30%, Batu Bolong 20%, Pererenan 10%. Sauvegarde `public/data/demo-listings.json` |

---

## Données statiques

### `public/data/demo-listings.json` (36.7 KB, 150 entrées)
Listings fictifs pour la carte. Chaque entrée :
```json
{
  "id": 1,
  "latitude": -8.651234,
  "longitude": 115.138456,
  "price_per_night": 295,
  "bedrooms": 2,
  "occupancy_rate": 0.58,
  "monthly_revenue": 5133,
  "title": "Rumah Lotus 2BR — Canggu",
  "zone": "Canggu"
}
```

### `public/data/zonage-canggu.geojson` (2.74 MB, 5033 features)
Polygones OSM filtrés. Chaque feature a ces propriétés :
```json
{
  "zone_type": "residential",
  "zone_label": "Résidentiel",
  "str_compatible": false,
  "zone_color": "residential"
}
```
Couleurs par `zone_color` :
- `tourist` → `#FF69B4` rose (STR Autorisé ✓)
- `commercial` → `#FF8C00` orange (STR Autorisé ✓)
- `beach` → `#4A9FE8` bleu (STR Autorisé ✓)
- `residential` → `#FFD700` jaune (STR Conditionnel ⚠)
- `agricultural` → `#4CAF50` vert (STR Restreint ✗)
- `brownfield` → `#888888` gris (STR Restreint ✗)

### `public/data/zonage-badung.geojson` (13.3 MB, 9277 features)
Données brutes OSM — non chargé côté client, source pour filter-zonage.js uniquement.

---

## Ce qui est fonctionnel

- **Auth complète** : Google OAuth, magic link, email+mot de passe (signup/login), redirect post-login intelligent (onboarding → pricing → dashboard)
- **Onboarding** : collecte profil avec sélecteur pays recherchable (150+ pays, emojis drapeaux)
- **Dashboard sidebar** : 5 pages actives, badge admin, logout
- **Analyse STR** : formulaire complet → POST `/api/comparables` → stats Haversine depuis `str_listings`
- **Rapport `/rapport/[id]`** : 7 sections, KPIs, barre prix P25/médiane/P75, scoring, recommandations Claude, 3 projections
- **Recommandations Claude** : appel à `claude-sonnet-4-6` avec contexte marché, stub si clé absente
- **Stripe Checkout** : plans `once` ($29) et `monthly` ($39)
- **Webhook Stripe** : `checkout.session.completed` → insert subscribers + email Resend
- **Email Resend** : template HTML dark envoyé à la confirmation de paiement
- **Gestion abonnement** : historique factures Stripe, annulation fin de période en 2 étapes avec sondage
- **Carte MapTiler** : heatmap adaptive, cercles listings colorés par revenu, polygones zonage OSM colorés, modal listing (static map + KPIs + barre prix + comparables + vue expanded)
- **Filtres carte** : chambres multi-select, prix min/max debounced, stats zone visible, reset comparables
- **Protection routes** : middleware Next.js sur `/dashboard`, `/rapport`, `/pricing`, `/onboarding`
- **Admin bypass** : `is_admin = true` → accès complet sans abonnement
- **TypeScript strict** : `npx tsc --noEmit` sans erreur sur tout le projet

---

## Ce qui est placeholder / non connecté

| Élément | État | Détail |
|---------|------|--------|
| `STRIPE_WEBHOOK_SECRET` | Placeholder `whsec_PLACEHOLDER` | Fonctionne en dev avec `stripe listen --forward-to localhost:3000/api/webhook`. À configurer en prod dans Stripe Dashboard |
| `str_listings` | Table vide | Les rapports d'analyse tombent en `no_data` tant qu'Apify n'a pas alimenté la table |
| `zone_stats` | Table vide | Les rapports utilisent les stats calculées à la volée depuis `str_listings` |
| Données carte | Demo uniquement | `demo-listings.json` est fictif. La carte doit être connectée à `str_listings` via une route API |
| Export PDF rapport | Non implémenté | Mentionné dans les plans tarifaires, pas encore développé |
| `stripe_subscription_id` | Non stocké au webhook | Le webhook insert sans `stripe_subscription_id` → `/api/billing` et `/api/cancel-subscription` ne trouvent pas l'abonnement pour les comptes créés avant ce fix |
| Google OAuth | À activer | Nécessite d'activer le provider Google dans Supabase Dashboard → Settings → Authentication → Providers |
| RLS Supabase | Non configuré | Les 4 tables (reports, subscribers, str_listings, zone_stats) n'ont pas de Row Level Security — toutes les requêtes passent par `supabaseAdmin` (service role) |
| `customer-portal/route.ts` | Legacy | Conservé mais le portail Stripe externe est remplacé par la page abonnement intégrée |
| Alertes marché mensuelles | Non implémenté | Mentionné dans les plans tarifaires |

---

## Prochaines étapes

### 1. Pipeline Apify → Supabase
- Créer un acteur Apify qui scrape les listings Airbnb par zone (Canggu, Seminyak, Ubud, Sanur…)
- Champs à extraire : `airbnb_id`, `title`, `price_per_night_usd`, `reviews_count`, `bedrooms`, `zone`, `latitude`, `longitude`, `airbnb_url`
- Webhook Apify → route Next.js `/api/ingest-listings` → upsert dans `str_listings`
- Recalculer `zone_stats` après chaque ingestion (cron ou trigger Supabase)

### 2. Connecter la carte aux vraies données
- Remplacer `demo-listings.json` par une route `/api/listings?bbox=...` qui lit `str_listings`
- Ajouter pagination et clustering côté Mapbox pour gérer > 1000 points

### 3. Cron job hebdomadaire
- Apify schedule : chaque lundi 6h WIB (minuit UTC)
- Recalcul `zone_stats` : médiane, P25, P75 par zone + bedrooms
- Email digest hebdo aux abonnés monthly via Resend (prix marché, nouvelles zones)

### 4. Fix `stripe_subscription_id`
- Modifier `app/api/webhook/route.ts` : stocker `session.subscription` dans subscribers lors du checkout `subscription` mode
- Nécessite une migration pour s'assurer que la colonne existe

### 5. Export PDF rapport
- Utiliser `puppeteer` ou `@react-pdf/renderer` pour générer un PDF depuis `/rapport/[id]`
- Route `/api/reports/[id]/pdf` → stream PDF
- Bouton "Télécharger PDF" dans le rapport

### 6. Revenue Manager
- Dashboard `/dashboard/revenue` avec calendrier de prix dynamique
- Suggestions de prix par saison (haute : juillet-août, décembre ; basse : janvier-mai)
- Basé sur les données historiques `str_listings`

### 7. RLS Supabase
- Activer Row Level Security sur les 4 tables
- Policy reports : `user_id = auth.uid()`
- Policy subscribers : `user_id = auth.uid()`
- Policy str_listings + zone_stats : lecture publique (ou auth uniquement selon choix)

### 8. Déploiement Vercel
- Variables d'environnement dans `~/Downloads/env-vercel.env` (copie de `.env.local` avec `NEXT_PUBLIC_BASE_URL` en domaine prod)
- Configurer le webhook Stripe avec l'URL de prod
- Activer Google OAuth avec l'URL de callback prod dans Google Cloud Console
