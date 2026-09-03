// Le vocabulaire de données — aligné sur Geotrek (itinéraire, POI,
// événement) pour rendre une migration future indolore. Les formes
// sont IDENTIQUES en mode fichiers (content/*.json) et en mode
// Supabase : la couche contenu (lib/content.ts) garantit l'équivalence.

export type Locale = 'ar' | 'fr' | 'en'

/** Texte multilingue : {"fr": "…", "ar": "…", "en": "…"} */
export type I18nText = Partial<Record<Locale, string>>

export type LineString = { type: 'LineString'; coordinates: [number, number][] }
/** [longitude, latitude] — l'ordre GeoJSON */
export type Position = [number, number]

export interface EtatAcces {
  niveau: 'ouvert' | 'prudence' | 'ferme'
  message: I18nText
  date: string
}

export interface Urgence {
  nom: I18nText
  tel: string
}

export interface Territoire {
  slug: string
  nom: I18nText
  /** Le nom commercial, paramétrable (« Visit Azour » en nom de travail) */
  marque?: string | null
  slogan?: I18nText | null
  actif: boolean
  langues: Locale[]
  langue_defaut: Locale
  photo_accueil?: string | null
  contact_tel?: string | null
  contact_whatsapp?: string | null
  contact_email?: string | null
  urgences: Urgence[]
  etat_acces?: EtatAcces | null
  centre: Position
  zoom_defaut: number
}

export type ParcoursType = 'boucle' | 'lineaire' | 'guide'
export type Difficulte = 'facile' | 'modere' | 'difficile'
export type StatutPublication = 'brouillon' | 'publie' | 'ferme'

export interface Parcours {
  slug: string
  nom: I18nText
  accroche?: I18nText | null
  description?: I18nText | null
  type: ParcoursType
  difficulte: Difficulte
  acces_guide: boolean
  trace: LineString | null
  trace_statut: 'provisoire' | 'verifie'
  distance_m: number | null
  denivele_pos_m: number | null
  denivele_neg_m: number | null
  duree_min_minutes: number | null
  duree_max_minutes: number | null
  saison?: I18nText | null
  dangers?: I18nText | null
  acces?: I18nText | null
  depart: Position | null
  photo?: string | null
  statut: StatutPublication
  ordre: number
  version: number
  /** slugs de POI, dans l'ordre des panneaux */
  etapes: string[]
}

export type PoiType =
  | 'depart' | 'belvedere' | 'patrimoine' | 'panneau' | 'eau' | 'ombre'
  | 'hebergement' | 'restaurant' | 'guide' | 'camping' | 'urgence' | 'nature' | 'autre'

/** Ce qu'on trouve sur place, indépendamment du type du lieu :
 *  une maison d'hôtes peut servir le petit-déjeuner, un hôtel avoir
 *  une table. C'est cette liste qui construit la section restauration. */
export type Service = 'petit_dejeuner' | 'restaurant' | 'bar' | 'epicerie' | 'eau'

export interface Poi {
  slug: string
  nom: I18nText
  type: PoiType
  services?: Service[]
  geom: Position
  panneau_no?: number | null
  texte?: I18nText | null
  photo?: string | null
  audio_url?: string | null
  contact?: { tel?: string; whatsapp?: string; site?: string } | null
  statut: 'brouillon' | 'publie'
  ordre: number
}

export interface Evenement {
  slug: string
  nom: I18nText
  description?: I18nText | null
  date_debut?: string | null
  date_fin?: string | null
  recurrent: boolean
  lien?: string | null
  photo?: string | null
  statut: 'brouillon' | 'publie'
}
