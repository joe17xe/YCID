'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { AI_PROVIDERS, getAiConfig } from '@/lib/ai-settings'
import { chatComplete } from '@/lib/llm'
import { isUserAdmin } from '@/lib/permissions'
import { verifyEmailSettings } from '@/lib/mailer'

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

// Liste les modèles réellement disponibles chez le fournisseur.
// Évite de deviner un identifiant : les fournisseurs retirent des
// modèles sans préavis (ex. gemini-2.5-flash coupé le 09/07/2026).
export async function listAiModels(input?: { baseUrl?: string; apiKey?: string }): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { ok: false, error: ctx.error }

  const saved = await getAiConfig()
  const baseUrl = (input?.baseUrl?.trim() || saved.baseUrl).replace(/\/+$/, '')
  const apiKey = input?.apiKey?.trim() || saved.apiKey
  if (!apiKey) return { ok: false, error: "Renseignez d'abord une clé API." }
  if (!/^https:\/\/.+/i.test(baseUrl)) return { ok: false, error: "URL de l'API invalide." }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    })
    const raw = await res.text()
    if (!res.ok) {
      let detail = `HTTP ${res.status}`
      try {
        const b = JSON.parse(raw)
        detail = b?.error?.message || b?.message || detail
      } catch { /* non JSON */ }
      return { ok: false, error: `Le fournisseur a répondu : ${detail}` }
    }
    const body = JSON.parse(raw)
    const list: string[] = (body?.data ?? [])
      .map((m: { id?: string }) => m?.id)
      .filter((id: unknown): id is string => typeof id === 'string')
      // Identifiants Gemini préfixés « models/ » : on normalise
      .map((id: string) => id.replace(/^models\//, ''))
      .sort()
    if (!list.length) return { ok: false, error: 'Aucun modèle renvoyé par le fournisseur.' }
    return { ok: true, models: list }
  } catch (e) {
    console.error('[listAiModels] échec:', e)
    return { ok: false, error: `Contact impossible avec le fournisseur : ${e instanceof Error ? e.message : String(e)}` }
  }
}


// ------------------------------------------------------------
// Mentions légales administrables (migration 0025)
// ------------------------------------------------------------
interface LegalInput {
  legalEntity: string
  legalAddress: string
  legalPublisher: string
  legalEmail: string
  legalRetention: string
}

export async function updateLegalSettings(input: LegalInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }
    const entity = (input.legalEntity ?? '').trim()
    if (!entity) return { ok: false, error: "Le nom de l'éditeur est obligatoire." }
    const email = (input.legalEmail ?? '').trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Adresse email de contact invalide.' }

    const supabase = await createClient()
    const { error } = await supabase.from('platform_settings').update({
      legal_entity: entity,
      legal_address: (input.legalAddress ?? '').trim() || null,
      legal_publisher: (input.legalPublisher ?? '').trim() || null,
      legal_email: email || null,
      legal_retention: (input.legalRetention ?? '').trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: ctx.user.id,
    }).eq('id', true)
    if (error) {
      console.error('[updateLegalSettings] échec:', { code: error.code, message: error.message })
      const missing = /legal_|does not exist/i.test(error.message)
      return { ok: false, error: missing ? 'Appliquez la migration 0025_legal_settings.sql dans le SQL Editor Supabase.' : `Échec de l'enregistrement : ${error.message}` }
    }
    revalidatePath('/', 'layout')
    return { ok: true }
  } catch (e) {
    console.error('[updateLegalSettings] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ============================================================
// Email (0040) — SMTP administrable
// ============================================================
// Même principe que la configuration IA : un secret ne se met pas dans
// un fichier sur le serveur, où le changer suppose un accès SSH et un
// redémarrage.

export interface EmailInput {
  enabled: boolean
  host: string
  port: string
  secure: boolean
  username: string
  password: string
  fromName: string
  fromEmail: string
  siteUrl: string
}

export async function updateEmailSettings(input: EmailInput): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const host = (input.host ?? '').trim()
    const fromEmail = (input.fromEmail ?? '').trim()
    const siteUrl = (input.siteUrl ?? '').trim().replace(/\/+$/, '')
    const port = Number(input.port)

    // Les contrôles ne s'appliquent qu'à l'envoi ACTIVÉ : on doit pouvoir
    // enregistrer une configuration partielle et l'activer plus tard.
    if (input.enabled) {
      if (!host) return { ok: false, error: 'Le serveur SMTP est obligatoire pour activer l’envoi.' }
      if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: 'Port invalide (1 à 65535).' }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) return { ok: false, error: 'Adresse d’expéditeur invalide.' }
      if (siteUrl && !/^https?:\/\/.+/i.test(siteUrl)) return { ok: false, error: 'L’adresse de l’application doit commencer par http:// ou https://' }
    }

    const admin = adminClient()
    if (!admin) return { ok: false, error: 'Non configuré : SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur.' }

    const values: Record<string, unknown> = {
      enabled: !!input.enabled,
      host: host || null,
      port: Number.isInteger(port) && port > 0 ? port : 587,
      secure: !!input.secure,
      username: (input.username ?? '').trim() || null,
      from_name: (input.fromName ?? '').trim() || 'Solid\'Pilot',
      from_email: fromEmail || null,
      site_url: siteUrl || null,
      updated_at: new Date().toISOString(), updated_by: ctx.user.id,
    }
    // Mot de passe vide = on conserve celui déjà enregistré. Le
    // formulaire ne le renvoie jamais au navigateur : sans cette règle,
    // le premier enregistrement l'effacerait.
    const pwd = (input.password ?? '').trim()
    if (pwd) values.password = pwd

    const { error } = await admin.from('email_settings').update(values).eq('id', true)
    if (error) {
      console.error('[updateEmailSettings] échec:', { code: error.code, message: error.message })
      const missing = /email_settings|does not exist/i.test(error.message)
      return { ok: false, error: missing ? 'Appliquez la migration 0040_email_settings.sql dans le SQL Editor Supabase.' : `Échec de l'enregistrement : ${error.message}` }
    }
    revalidatePath('/admin/configuration')
    return { ok: true }
  } catch (e) {
    console.error('[updateEmailSettings] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// Vérifie la connexion SANS écrire à personne, et garde la trace du
// résultat : un envoi qui cesse de fonctionner — mot de passe changé,
// quota atteint — ne doit pas se découvrir le jour où quelqu'un s'étonne
// de n'avoir rien reçu.
export async function testEmailConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const err = await verifyEmailSettings()
    const admin = adminClient()
    if (admin) {
      await admin.from('email_settings').update({
        last_test_at: new Date().toISOString(),
        last_test_ok: !err,
        last_test_error: err,
      }).eq('id', true)
    }
    revalidatePath('/admin/configuration')
    return err ? { ok: false, error: err } : { ok: true }
  } catch (e) {
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}
