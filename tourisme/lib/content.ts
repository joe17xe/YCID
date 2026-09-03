// La couche contenu — la SEULE porte d'accès aux données de l'app.
//
// Deux modes, mêmes formes (lib/types.ts) :
// - « supabase » : la base est là (NEXT_PUBLIC_SUPABASE_URL défini) ;
//   lecture via la vue parcours_publics et les tables, RLS publiques.
// - « fichiers » : sans base, l'app lit content/*.json — le même jeu
//   de données qui génère le seed SQL. C'est le mode démo/développement,
//   et la garantie que l'app tourne même sans infrastructure.
//
// La carte n'affiche que des données : rien ici n'est codé en dur.
import { createClient } from '@supabase/supabase-js'
import type {
  Evenement,
  Formule,
  LineString,
  Parcours,
  Poi,
  Position,
  Territoire,
} from './types'

import territoireJson from '@/content/territoire.json'
import parcoursJson from '@/content/parcours.json'
import poisJson from '@/content/pois.json'
import evenementsJson from '@/content/evenements.json'
import formulesJson from '@/content/formules.json'

export type ContentMode = 'supabase' | 'fichiers'

export function contentMode(): ContentMode {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'fichiers'
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
}

const TERRITOIRE_SLUG = process.env.NEXT_PUBLIC_TERRITOIRE ?? 'azour'

// ————————————————————————————————————————————————— mode fichiers
const fileTerritoire = territoireJson as unknown as Territoire
const fileParcours = (parcoursJson as unknown as Parcours[])
  .filter((p) => p.statut !== 'brouillon')
  .sort((a, b) => a.ordre - b.ordre)
const filePois = (poisJson as unknown as Poi[])
  .filter((p) => p.statut === 'publie')
  .sort((a, b) => a.ordre - b.ordre)
const fileEvenements = (evenementsJson as unknown as Evenement[]).filter(
  (e) => e.statut === 'publie',
)
const fileFormules = (formulesJson as unknown as Formule[])
  .filter((f) => f.statut === 'publie')
  .sort((a, b) => a.ordre - b.ordre)

// ————————————————————————————————————————————————— mode supabase
type DbParcoursRow = {
  slug: string; nom: unknown; accroche: unknown; description: unknown
  type: string; difficulte: string; acces_guide: boolean; trace_statut: string
  distance_m: number | null; denivele_pos_m: number | null; denivele_neg_m: number | null
  duree_min_minutes: number | null; duree_max_minutes: number | null
  saison: unknown; dangers: unknown; acces: unknown; photo: string | null
  statut: string; ordre: number; version: number
  trace_geojson: LineString | null
  depart_geojson: { type: 'Point'; coordinates: Position } | null
}

function mapDbParcours(r: DbParcoursRow, etapes: string[]): Parcours {
  return {
    slug: r.slug,
    nom: r.nom as Parcours['nom'],
    accroche: r.accroche as Parcours['accroche'],
    description: r.description as Parcours['description'],
    type: r.type as Parcours['type'],
    difficulte: r.difficulte as Parcours['difficulte'],
    acces_guide: r.acces_guide,
    trace: r.trace_geojson,
    trace_statut: r.trace_statut as Parcours['trace_statut'],
    distance_m: r.distance_m,
    denivele_pos_m: r.denivele_pos_m,
    denivele_neg_m: r.denivele_neg_m,
    duree_min_minutes: r.duree_min_minutes,
    duree_max_minutes: r.duree_max_minutes,
    saison: r.saison as Parcours['saison'],
    dangers: r.dangers as Parcours['dangers'],
    acces: r.acces as Parcours['acces'],
    depart: r.depart_geojson?.coordinates ?? null,
    photo: r.photo,
    statut: r.statut as Parcours['statut'],
    ordre: r.ordre,
    version: r.version,
    etapes,
  }
}

async function dbTerritoire(): Promise<Territoire> {
  // territoires_publics (migration 0002) expose le centre en GeoJSON —
  // PostgREST renverrait la geometry brute en WKB.
  const { data, error } = await db()
    .from('territoires_publics')
    .select('*')
    .eq('slug', TERRITOIRE_SLUG)
    .single()
  if (error) throw error
  const row = data as unknown as Territoire & { centre_geojson: { coordinates: Position } | null }
  return { ...row, centre: row.centre_geojson?.coordinates ?? fileTerritoire.centre }
}

async function dbParcours(): Promise<Parcours[]> {
  const client = db()
  const [{ data: rows, error }, { data: liens, error: e2 }] = await Promise.all([
    client.from('parcours_publics').select('*').order('ordre'),
    client.from('parcours_pois').select('parcours_id, ordre, parcours:parcours_id(slug), poi:poi_id(slug)').order('ordre'),
  ])
  if (error) throw error
  if (e2) throw e2
  const etapesParSlug = new Map<string, string[]>()
  for (const l of (liens ?? []) as unknown as { parcours: { slug: string }; poi: { slug: string } }[]) {
    const list = etapesParSlug.get(l.parcours.slug) ?? []
    list.push(l.poi.slug)
    etapesParSlug.set(l.parcours.slug, list)
  }
  return ((rows ?? []) as DbParcoursRow[]).map((r) => mapDbParcours(r, etapesParSlug.get(r.slug) ?? []))
}

async function dbPois(): Promise<Poi[]> {
  const { data, error } = await db()
    .from('pois_publics')
    .select('*')
    .order('ordre')
  if (error) throw error
  return ((data ?? []) as unknown as (Omit<Poi, 'geom'> & { geom_geojson: { coordinates: Position } | null })[]).map(
    (r) => ({ ...r, geom: r.geom_geojson?.coordinates ?? [0, 0] }),
  )
}

async function dbFormules(): Promise<Formule[]> {
  // formules_publiques (migration 0005) agrège déjà les parcours
  // rattachés en tableau de slugs : pas de jointure côté app.
  const { data, error } = await db().from('formules_publiques').select('*').order('ordre')
  if (error) throw error
  return ((data ?? []) as unknown as Omit<Formule, 'statut'>[]).map((f) => ({
    ...f,
    parcours_slugs: f.parcours_slugs ?? [],
    statut: 'publie' as const,
  }))
}

async function dbEvenements(): Promise<Evenement[]> {
  const { data, error } = await db()
    .from('evenements')
    .select('slug, nom, description, date_debut, date_fin, recurrent, lien, photo, statut')
    .eq('statut', 'publie')
  if (error) throw error
  return (data ?? []) as unknown as Evenement[]
}

// ————————————————————————————————————————————————— l'API publique
export async function getTerritoire(): Promise<Territoire> {
  if (contentMode() === 'supabase') {
    try { return await dbTerritoire() } catch { return fileTerritoire }
  }
  return fileTerritoire
}

export async function getParcours(): Promise<Parcours[]> {
  if (contentMode() === 'supabase') {
    try { return await dbParcours() } catch { return fileParcours }
  }
  return fileParcours
}

export async function getParcoursBySlug(slug: string): Promise<Parcours | null> {
  return (await getParcours()).find((p) => p.slug === slug) ?? null
}

export async function getPois(): Promise<Poi[]> {
  if (contentMode() === 'supabase') {
    try { return await dbPois() } catch { return filePois }
  }
  return filePois
}

export async function getPoiBySlug(slug: string): Promise<Poi | null> {
  return (await getPois()).find((p) => p.slug === slug) ?? null
}

export async function getFormules(): Promise<Formule[]> {
  if (contentMode() === 'supabase') {
    try { return await dbFormules() } catch { return fileFormules }
  }
  return fileFormules
}

export async function getFormuleBySlug(slug: string): Promise<Formule | null> {
  return (await getFormules()).find((f) => f.slug === slug) ?? null
}

export async function getEvenements(): Promise<Evenement[]> {
  if (contentMode() === 'supabase') {
    try { return await dbEvenements() } catch { return fileEvenements }
  }
  return fileEvenements
}
