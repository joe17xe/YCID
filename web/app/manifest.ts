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
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
    ],
  }
}
