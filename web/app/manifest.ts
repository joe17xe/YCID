import type { MetadataRoute } from 'next'
import { getPlatformSettings } from '@/lib/settings'

// Manifeste PWA : permet d'« Ajouter à l'écran d'accueil » sur mobile
// (mode application, plein écran). Nom et couleur suivent la marque
// configurée (Admin ▸ Configuration ▸ Marque).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getPlatformSettings()
  return {
    name: s.brandName,
    short_name: s.brandName,
    description: s.tagline,
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#F5F6F4',
    theme_color: s.accentColor,
    // « maskable » évite le carré blanc autour de l'icône sur Android :
    // le système recadre lui-même dans la forme du lanceur.
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
  }
}
