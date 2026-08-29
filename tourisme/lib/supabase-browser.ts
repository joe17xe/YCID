'use client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

/** Client navigateur (anon key) — RLS au pouvoir. Null en mode fichiers. */
export function supabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!client) client = createClient(url, key)
  return client
}

/** Détecte l'ordre d'une paire collée (« 33.53, 35.57 » façon Google
 *  Maps, ou l'inverse) et refuse ce qui sort du Liban — une coordonnée
 *  fausse égare un randonneur. Latitudes 33–34.75, longitudes 35.05–36.7 :
 *  les plages sont disjointes, l'ordre se déduit. */
export function parseCoordonnees(texte: string): { lon: number; lat: number } | null {
  const m = texte.trim().match(/(-?\d+(?:[.,]\d+)?)[\s;,]+(-?\d+(?:[.,]\d+)?)/)
  if (!m) return null
  const a = parseFloat(m[1].replace(',', '.'))
  const b = parseFloat(m[2].replace(',', '.'))
  const estLat = (v: number) => v >= 33 && v <= 34.75
  const estLon = (v: number) => v >= 35.05 && v <= 36.7
  if (estLat(a) && estLon(b)) return { lat: a, lon: b }
  if (estLon(a) && estLat(b)) return { lon: a, lat: b }
  return null
}
