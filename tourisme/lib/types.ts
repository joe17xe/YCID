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

/** Une porte d'entrée vers le village : d'où l'on vient, et ce que ça
 *  coûte en kilomètres et en minutes. Les deux sont des paramètres —
 *  la route change, le code non. */
export interface AccesDepuis {
  ville: I18nText
  distance_km?: number | null
  duree_minutes?: number | null
  note?: I18nText | null
}

export interface Acces {
  /** Où l'on arrive vraiment : la place du village, pas le centroïde. */
  arrivee?: { nom: I18nText; geom: Position } | null
  depuis: AccesDepuis[]
  stationnement?: I18nText | null
  transports?: I18nText | null
}

export interface Presentation {
  pourquoi?: I18nText | null
  region?: I18nText | null
}

export interface Territoire {
  /** Renseigné en mode Supabase seulement — le dépôt d'une demande en
   *  a besoin. Absent en mode fichiers, où il n'y a rien à insérer. */
  id?: string | null
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
  presentation?: Presentation | null
  acces?: Acces | null
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

/** Une photo de galerie. Le crédit est un champ, pas une note : une
 *  image appartient à quelqu'un, et on l'écrit. */
export interface Photo {
  src: string
  credit?: string | null
  legende?: I18nText | null
}

export interface Poi {
  slug: string
  nom: I18nText
  type: PoiType
  services?: Service[]
  /** Ne sert que si l'on a prévenu — l'information qui évite la porte close. */
  sur_reservation?: boolean
  geom: Position
  panneau_no?: number | null
  texte?: I18nText | null
  /** Couverture. Vide, c'est la première de la galerie qui sert. */
  photo?: string | null
  photos?: Photo[]
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
/** Ce que le kiosque propose de faire faire — décidé au village, jamais
 *  écrit dans le code. Une formule peut s'appuyer sur des parcours
 *  existants (« parcours_slugs ») ou sur aucun (visite, groupes). */
export type FormuleCategorie = 'visite' | 'randonnee' | 'aventure' | 'journee' | 'groupe'

export interface Formule {
  /** Renseigné en mode Supabase seulement : il relie une demande à la
   *  formule demandée dans le registre du kiosque. */
  id?: string | null
  slug: string
  nom: I18nText
  accroche?: I18nText | null
  description?: I18nText | null
  categorie: FormuleCategorie
  duree_minutes?: number | null
  participants_min?: number | null
  participants_max?: number | null
  /** null = tarif à confirmer au kiosque : l'état de départ assumé */
  prix_montant?: number | null
  prix_devise: string
  prix_unite: 'personne' | 'groupe'
  inclus?: I18nText | null
  niveau?: Difficulte | null
  saison?: I18nText | null
  langues: Locale[]
  photo?: string | null
  statut: 'brouillon' | 'publie'
  ordre: number
  parcours_slugs: string[]
}

/** Une demande déposée depuis l'app. Elle part au kiosque : c'est là
 *  qu'un guide la confirme — l'app ne promet rien toute seule. */
export interface Demande {
  formule_slug?: string | null
  formule_nom?: string | null
  nom: string
  telephone: string
  email?: string | null
  date_souhaitee?: string | null
  participants?: number | null
  langue: Locale
  message?: string | null
}
