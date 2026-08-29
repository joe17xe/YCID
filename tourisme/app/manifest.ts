import type { MetadataRoute } from 'next'
import { getTerritoire } from '@/lib/content'
import { tx } from '@/lib/i18n-text'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTerritoire()
  const marque = t.marque ?? tx(t.nom, t.langue_defaut)
  return {
    name: marque,
    short_name: marque,
    description: tx(t.slogan, t.langue_defaut),
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f2e8',
    theme_color: '#1e5741',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
