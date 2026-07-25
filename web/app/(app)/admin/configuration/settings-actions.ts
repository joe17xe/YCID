'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { AI_PROVIDERS } from '@/lib/ai-settings'
import { chatComplete } from '@/lib/llm'
import { isUserAdmin } from '@/lib/permissions'

const HEX = /^#[0-9A-Fa-f]{6}$/

interface BrandInput {
  brandName: string
  tagline: string
  accentColor: string
  accentSoftColor: string
  logoUrl: string | null
}

export async function updateBrandSettings(input: BrandInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    if (!(await isUserAdmin(supabase, user.id))) return { ok: false, error: 'Réservé aux administrateurs.' }

    const brandName = (input.brandName ?? '').trim()
    if (!brandName) return { ok: false, error: 'Le nom de la plateforme est obligatoire.' }
    if (!HEX.test(input.accentColor)) return { ok: false, error: "Couleur d'accent invalide (format #RRGGBB)." }
    if (!HEX.test(input.accentSoftColor)) return { ok: false, error: 'Couleur secondaire invalide (format #RRGGBB).' }

    const { error } = await supabase.from('platform_settings').update({
      brand_name: brandName,
      tagline: (input.tagline ?? '').trim(),
      accent_color: input.accentColor,
      accent_soft_color: input.accentSoftColor,
      logo_url: input.logoUrl,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    }).eq('id', true)
    if (error) {
      console.error('[updateBrandSettings] échec:', { code: error.code, message: error.message, details: error.details })
      return { ok: false, error: `Échec de l'enregistrement : ${error.message}` }
    }

    // Rafraîchit la marque partout (layout racine : variables CSS, métadonnées)
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    console.error('[updateBrandSettings] exception:', e)
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `Échec de l'enregistrement : ${message}` }
  }
}

// ============================================================
// PR 31 — Configuration IA administrable
// ============================================================

interface AiInput {
  provider: string
  baseUrl: string
  model: string
  apiKey: string // vide = conserver la clé actuelle
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' as const }
  if (!(await isUserAdmin(supabase, user.id))) return { error: 'Réservé aux administrateurs.' as const }
  return { user }
}

export async function updateAiSettings(input: AiInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const baseUrl = (input.baseUrl ?? '').trim().replace(/\/+$/, '')
    const model = (input.model ?? '').trim()
    if (!/^https:\/\/.+/i.test(baseUrl)) return { ok: false, error: "L'URL de l'API doit commencer par https://" }
    if (!model) return { ok: false, error: 'Le modèle est obligatoire.' }
    if (!AI_PROVIDERS[input.provider]) return { ok: false, error: 'Fournisseur invalide.' }

    const admin = adminClient()
    if (!admin) return { ok: false, error: 'Non configuré : SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur.' }

    const values: Record<string, unknown> = {
      provider: input.provider, base_url: baseUrl, model,
      updated_at: new Date().toISOString(), updated_by: ctx.user.id,
    }
    // Clé vide = on conserve celle déjà enregistrée
    const key = (input.apiKey ?? '').trim()
    if (key) values.api_key = key

    const { error } = await admin.from('ai_settings').update(values).eq('id', true)
    if (error) {
      console.error('[updateAiSettings] échec:', { code: error.code, message: error.message })
      const missing = /ai_settings|does not exist/i.test(error.message)
      return { ok: false, error: missing ? 'Appliquez la migration 0023_ai_settings.sql dans le SQL Editor Supabase.' : `Échec de l'enregistrement : ${error.message}` }
    }
    revalidatePath('/admin/configuration')
    return { ok: true }
  } catch (e) {
    console.error('[updateAiSettings] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// Test de bout en bout : envoie une requête minimale au fournisseur.
export async function testAiConnection(): Promise<{ ok: boolean; error?: string; reply?: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { ok: false, error: ctx.error }
  const res = await chatComplete({
    system: 'Tu réponds en un mot.',
    user: 'Réponds exactement : OK',
    temperature: 0,
    maxTokens: 16,
  })
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, reply: (res.content ?? '').trim().slice(0, 80) }
}
