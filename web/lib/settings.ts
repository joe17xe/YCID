import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface PlatformSettings {
  brandName: string
  tagline: string
  accentColor: string
  accentSoftColor: string
  logoUrl: string | null
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  brandName: "Solid'Pilot",
  tagline: 'Pilotage de projets de solidarité internationale',
  accentColor: '#0E6B5C',
  accentSoftColor: '#E4F0EC',
  logoUrl: null,
}

// Lecture des réglages de marque, mémorisée par requête (React cache).
// Repli sur les valeurs par défaut si la table n'existe pas encore
// (migration 0018 non appliquée) — l'application reste fonctionnelle.
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('platform_settings')
      .select('brand_name, tagline, accent_color, accent_soft_color, logo_url')
      .maybeSingle()
    if (error || !data) return DEFAULT_SETTINGS
    return {
      brandName: data.brand_name || DEFAULT_SETTINGS.brandName,
      tagline: data.tagline || DEFAULT_SETTINGS.tagline,
      accentColor: data.accent_color || DEFAULT_SETTINGS.accentColor,
      accentSoftColor: data.accent_soft_color || DEFAULT_SETTINGS.accentSoftColor,
      logoUrl: data.logo_url || null,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
})
