import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { RetentionPolicy } from '@/lib/retention'

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

// ============================================================
// Durées de conservation (migration 0056)
// ============================================================
// `legalRetention`, juste au-dessus, est une PHRASE : un texte libre que
// la page de confidentialité réaffiche. Rien ne l'applique. Ce qui suit
// est la politique que le code APPLIQUE réellement, catégorie par
// catégorie — et c'est elle que la page publie désormais.

// Le type et la mise en forme vivent dans `lib/retention.ts`, sans
// dépendance à Supabase : l'écran de configuration les utilise DANS LE
// NAVIGATEUR, et ce fichier-ci est serveur uniquement. Ré-exportés ici
// pour que les pages n'aient qu'un import à écrire.
export type { RetentionPolicy } from '@/lib/retention'
export { formatRetentionDays } from '@/lib/retention'

// Retourne `null` — et non un tableau vide — quand la table n'existe pas
// encore (0056 non appliquée). La distinction est le cœur du sujet : un
// tableau vide se lirait « aucune donnée n'est purgée », et la page
// afficherait une politique de conservation vide comme si c'en était
// une. `null` fait retirer la section entière, c'est-à-dire ne rien
// promettre — la règle du dépôt : soit on livre, soit on retire la
// phrase.
//
// Lecture PUBLIQUE : la policy « Retention policies read » (0056) rend
// la table lisible sans connexion, parce que /confidentialite l'est.
export const getRetentionPolicies = cache(async (): Promise<RetentionPolicy[] | null> => {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('retention_policies')
      .select('category, label, description, retention_days, enabled')
      .order('retention_days')
    if (error || !data || !data.length) return null
    return data.map(r => ({
      category: r.category as string,
      label: r.label as string,
      description: r.description as string,
      retentionDays: Number(r.retention_days),
      enabled: !!r.enabled,
    }))
  } catch {
    return null
  }
})
