import type { Metadata, Viewport } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { getTerritoire } from '@/lib/content'
import { dirFor, tx } from '@/lib/i18n-text'
import SWRegister from '@/components/SWRegister'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const [territoire, locale] = await Promise.all([getTerritoire(), getLocale()])
  const marque = territoire.marque ?? tx(territoire.nom, locale)
  return {
    title: { default: marque, template: `%s · ${marque}` },
    description: tx(territoire.slogan, locale),
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
    appleWebApp: { capable: true, title: marque, statusBarStyle: 'default' },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1e5741' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1d16' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body>
        {/* Polices chargées au runtime avec vraies piles de secours :
            le build ne dépend d'aucun téléchargement. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- app router : le layout racine couvre toutes les pages */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <SWRegister />
      </body>
    </html>
  )
}
