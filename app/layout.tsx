// CANONICAL: root layout for FamComply. Owns fonts, global metadata, and viewport.
import type { Metadata, Viewport } from 'next'
import { Outfit, Source_Sans_3 } from 'next/font/google'
import './globals.css'

const displayFont = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['500', '600', '700', '800'],
})

const bodyFont = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'FamComply: license renewals in the right order',
    template: '%s | FamComply',
  },
  description:
    'FamComply turns your state and license type into a sequenced renewal timeline for family child care: CPR, first aid, background checks, training hours, inspection prep, and the license itself, with reminders before every deadline.',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'FamComply: license renewals in the right order',
    description:
      'A sequenced renewal timeline for family child care providers, built from your state and license type, with reminders before every deadline.',
    siteName: 'FamComply',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'FamComply: sequenced license renewal timelines for family child care providers',
      },
    ],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen bg-white text-slate-900 antialiased">{children}</body>
    </html>
  )
}
