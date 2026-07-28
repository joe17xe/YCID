import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export interface PlatformSettings {
  brandName: string
  tagline: string
  accentColor: string
  accentSoftColor: string
  logoUrl: string | null
  faviconUrl: string | null
  // Mentions légales (migration 0025) — publiques par nature
  legalEntity: string
  legalAddress: string
  legalPublisher: string
  legalEmail: string
  legalRetention: string
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  brandName: "Solid'Pilot",
  tagline: 'Pilotage de projets de solidarité internationale',
  accentColor: '#0E6B5C',
  accentSoftColor: '#E4F0EC',
  logoUrl: null,
  faviconUrl: null,
  legalEntity: 'YCID — Yvelines Coopération Internationale et Développement',
  legalAddress: '',
  legalPublisher: '',
  legalEmail: '',
  legalRetention: '',
}

// Lecture des réglages de marque, mémorisée par requête (React cache).
// Repli sur les valeurs par défaut si la table n'existe pas encore
// (migration 0018 non appliquée) — l'application reste fonctionnelle.
export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('platform_settings')
      .select('brand_name, tagline, accent_color, accent_soft_color, logo_url, favicon_url, legal_entity, legal_address, legal_publisher, legal_email, legal_retention')
      .maybeSingle()
    if (error || !data) return DEFAULT_SETTINGS
    return {
      brandName: data.brand_name || DEFAULT_SETTINGS.brandName,
      tagline: data.tagline || DEFAULT_SETTINGS.tagline,
      accentColor: data.accent_color || DEFAULT_SETTINGS.accentColor,
      accentSoftColor: data.accent_soft_color || DEFAULT_SETTINGS.accentSoftColor,
      logoUrl: data.logo_url || null,
      faviconUrl: data.favicon_url || null,
      legalEntity: data.legal_entity || DEFAULT_SETTINGS.legalEntity,
      legalAddress: data.legal_address || '',
      legalPublisher: data.legal_publisher || '',
      legalEmail: data.legal_email || '',
      legalRetention: data.legal_retention || '',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
})
