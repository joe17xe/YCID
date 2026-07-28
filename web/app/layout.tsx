import type { Metadata, Viewport } from 'next'
import { Sora, Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale } from 'next-intl/server'
import { getPlatformSettings } from '@/lib/settings'
import './globals.css'

const sora = Sora({ variable: '--font-sora', subsets: ['latin'], weight: ['400','600','700'] })
const inter = Inter({ variable: '--font-inter', subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPlatformSettings()
  // L'icône d'onglet suit la marque (0049) : favicon dédié, sinon le
  // logo, sinon le fichier du dépôt. Les fichiers statiques vivent dans
  // public/ et non app/ — la convention app/favicon.ico émettrait sa
  // balise EN PLUS de celle-ci, et le navigateur choisirait lui-même.
  const icon = s.faviconUrl || s.logoUrl || '/favicon.ico'
  return {
    title: `${s.brandName} — YCID`,
    description: s.tagline,
    icons: {
      icon,
      apple: s.faviconUrl || s.logoUrl || '/apple-icon.png',
    },
  }
}

// Couleur de la barre du navigateur mobile = couleur d'accent de la marque
export async function generateViewport(): Promise<Viewport> {
  const s = await getPlatformSettings()
  return { themeColor: s.accentColor }
}

// Applique les préférences d'apparence avant le premier rendu (pas de flash)
const appearanceInit = `try{var p=JSON.parse(localStorage.getItem('sp-appearance')||'{}');var h=document.documentElement;if(p.textSize)h.setAttribute('data-textsize',p.textSize);if(p.contrast)h.setAttribute('data-contrast','high');if(p.motion)h.setAttribute('data-motion','reduced');}catch(e){}`

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, settings] = await Promise.all([getLocale(), getPlatformSettings()])
  // Les couleurs de marque sont injectées comme variables CSS : tous les
  // styles inline en var(--brand-accent, …) les reprennent automatiquement.
  const brandVars = {
    background: '#F5F6F4',
    '--brand-accent': settings.accentColor,
    '--brand-accent-soft': settings.accentSoftColor,
  } as React.CSSProperties
  return (
    <html lang={locale} className="h-full">
      <body className={[sora.variable, inter.variable, 'antialiased min-h-full flex flex-col'].join(' ')} style={brandVars}>
        <script dangerouslySetInnerHTML={{ __html: appearanceInit }} />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
