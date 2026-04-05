import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Mono, Outfit } from 'next/font/google'
import { Providers } from '@/components/Providers'
import './globals.css'

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
})

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'BaliData — Analyse de marché Airbnb Bali',
  description: 'Comparez votre tarif Airbnb aux données réelles du marché Bali. Verdict instantané, prix médian, P25/P75, revenu mensuel estimé.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${cormorant.variable} ${dmMono.variable} ${outfit.variable}`}
    >
      <body style={{ margin: 0, background: '#0A0A0A', color: '#E8E0D4' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
