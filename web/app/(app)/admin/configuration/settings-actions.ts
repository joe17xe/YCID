'use server'

import { revalidatePath } from 'next/cache'
import { EMAIL_RE } from '@/lib/email'
import { createClient } from '@/lib/supabase/server'
import { adminClient } from '@/lib/supabase/admin'
import { AI_PROVIDERS, getAiConfig } from '@/lib/ai-settings'
import { chatComplete } from '@/lib/llm'
import { isUserAdmin } from '@/lib/permissions'
import { verifyEmailSettings, sendMail, renderMail, getEmailSettings, isUsable, unusableReason, recordSendOutcome } from '@/lib/mailer'

const HEX = /^#[0-9A-Fa-f]{6}$/

interface BrandInput {
  brandName: string
  tagline: string
  accentColor: string
  accentSoftColor: string
  logoUrl: string | null
  faviconUrl: string | null
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
      favicon_url: input.faviconUrl,
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
    usageContext: { feature: 'test' },
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
    if (email && !EMAIL_RE.test(email)) return { ok: false, error: 'Adresse email de contact invalide.' }

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
  replyTo: string
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

    // Le nom du serveur est un NOM DE MACHINE, pas un bloc de
    // configuration. Contrôlé même envoi désactivé : le 27/07, tout le
    // pavé « SMTP_HOST=… SMTP_PORT=… SMTP_PASS=… » a été collé dans ce
    // champ. La base l'a accepté sans broncher, l'écran l'a réaffiché
    // comme si de rien n'était, et il a fallu une requête SQL pour
    // s'en apercevoir. Une valeur qu'aucun résolveur DNS ne peut
    // traiter n'a pas à être enregistrée.
    if (host && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) {
      return {
        ok: false,
        error: host.includes('=') || /\s/.test(host)
          ? 'Le champ « Serveur SMTP » n’attend que le nom du serveur, par exemple smtp.hostinger.com — pas le bloc de configuration complet. Le port, l’identifiant et le mot de passe ont chacun leur champ.'
          : `« ${host} » n’est pas un nom de serveur valide.`,
      }
    }

    // Les contrôles ne s'appliquent qu'à l'envoi ACTIVÉ : on doit pouvoir
    // enregistrer une configuration partielle et l'activer plus tard.
    if (input.enabled) {
      if (!host) return { ok: false, error: 'Le serveur SMTP est obligatoire pour activer l’envoi.' }
      if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: 'Port invalide (1 à 65535).' }
      if (!EMAIL_RE.test(fromEmail)) return { ok: false, error: 'Adresse d’expéditeur invalide.' }
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
      reply_to: (input.replyTo ?? '').trim() || null,
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

// Le seul essai qui prouve quelque chose : un message réel, soumis au
// relais, sous l'expéditeur configuré.
//
// `verify()` s'authentifie et referme. Il ne dit rien du cas le plus
// fréquent en production : un relais qui accepte l'identifiant
// `joe@ezrya.fr` et refuse d'expédier sous `cem.notif@ezrya.fr`. Le
// test affichait alors « connexion réussie » pendant que rien
// n'arrivait — un vert qui oriente le soupçon vers le destinataire.
//
// Le destinataire est l'administrateur lui-même : on n'écrit à personne
// d'autre pour vérifier une configuration.
export async function sendTestEmail(): Promise<{ ok: boolean; error?: string; to?: string }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const settings = await getEmailSettings()
    if (!isUsable(settings)) return { ok: false, error: unusableReason(settings) ?? 'Configuration incomplète.' }

    const admin = adminClient()
    if (!admin) return { ok: false, error: 'Non configuré : SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur.' }
    const { data: me } = await admin.from('profiles').select('email').eq('id', ctx.user.id).maybeSingle()
    const to = (me?.email ?? '').trim()
    if (!to) return { ok: false, error: 'Votre compte n’a pas d’adresse email : impossible de vous écrire.' }

    const { text, html } = renderMail(
      'Test d’envoi — Solid’Pilot',
      [
        'Si vous lisez ce message, la chaîne complète fonctionne : authentification, expéditeur accepté par le relais, et remise.',
        `Expéditeur : ${settings.from_name} <${settings.from_email}>. Réponse dirigée vers ${settings.reply_to || settings.from_email}.`,
        'Vérifiez aussi le dossier « indésirables » : un message remis et classé en spam se comporte, pour le destinataire, comme un message perdu.',
      ],
      settings.site_url ? { href: settings.site_url.replace(/\/+$/, ''), label: 'Ouvrir Solid’Pilot' } : undefined,
    )
    const err = await sendMail({ to, subject: 'Test d’envoi — Solid’Pilot', text, html })
    await recordSendOutcome(to, err)
    revalidatePath('/admin/configuration')
    return err ? { ok: false, error: err } : { ok: true, to }
  } catch (e) {
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ============================================================
// Circuit de validation (0042)
// ============================================================
// La chaîne posée par la 0041 ne se réglait qu'en SQL. Un circuit qu'on
// ne peut pas modifier depuis l'application n'est pas paramétrable.

export async function updateValidationSettings(input: { coordinatorOrgId: string; minAmount: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const min = Number((input.minAmount ?? '0').replace(',', '.'))
    if (!Number.isFinite(min) || min < 0) return { ok: false, error: 'Le seuil doit être un nombre positif ou zéro.' }

    const admin = adminClient()
    if (!admin) return { ok: false, error: 'Non configuré : SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur.' }

    const orgId = (input.coordinatorOrgId ?? '').trim() || null
    const { data: before } = await admin.from('platform_settings')
      .select('coordinator_org_id, coordinator_min_amount').eq('id', true).maybeSingle()

    const { error } = await admin.from('platform_settings').update({
      coordinator_org_id: orgId,
      coordinator_min_amount: min,
      updated_at: new Date().toISOString(), updated_by: ctx.user.id,
    }).eq('id', true)
    if (error) {
      console.error('[updateValidationSettings] échec:', { code: error.code, message: error.message })
      const missing = /coordinator_min_amount|coordinator_org_id|does not exist/i.test(error.message)
      return { ok: false, error: missing ? 'Appliquez les migrations 0041 et 0042 dans le SQL Editor Supabase.' : `Échec de l'enregistrement : ${error.message}` }
    }

    // Changer le circuit de validation d'un programme n'est pas un
    // réglage d'affichage : la trace est portée au journal, sans projet
    // rattaché puisque le réglage est global.
    if (before && (before.coordinator_org_id !== orgId || Number(before.coordinator_min_amount) !== min)) {
      const { data: orgs } = await admin.from('organizations').select('id, name')
        .in('id', [before.coordinator_org_id, orgId].filter(Boolean) as string[])
      const nameOf = (id: string | null) => id ? (orgs?.find(o => o.id === id)?.name ?? id) : 'aucune'
      await admin.from('audit_log').insert({
        project_id: null, entity: 'platform_settings', entity_id: null,
        label: 'Circuit de validation', action: 'modifie', user_id: ctx.user.id,
        comment: `Coordinateur : ${nameOf(before.coordinator_org_id)} → ${nameOf(orgId)} ; seuil : ${before.coordinator_min_amount} € → ${min} €`,
      })
    }

    revalidatePath('/admin/configuration')
    return { ok: true }
  } catch (e) {
    console.error('[updateValidationSettings] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// Tarifs et budget IA (0043). Séparé de updateAiSettings : changer un
// prix n'est pas changer de fournisseur, et mélanger les deux ferait
// perdre la clé API à qui vient corriger un tarif.
export async function updateAiPricing(input: { priceIn: string; priceOut: string; monthlyBudget: string; currency: string }): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const num = (v: string) => Number((v ?? '0').replace(',', '.'))
    const [pin, pout, budget] = [num(input.priceIn), num(input.priceOut), num(input.monthlyBudget)]
    if ([pin, pout, budget].some(n => !Number.isFinite(n) || n < 0)) {
      return { ok: false, error: 'Les tarifs et le budget doivent être des nombres positifs ou zéro.' }
    }
    const currency = (input.currency ?? 'EUR').trim().toUpperCase().slice(0, 4) || 'EUR'

    const admin = adminClient()
    if (!admin) return { ok: false, error: 'Non configuré : SUPABASE_SERVICE_ROLE_KEY manquante sur le serveur.' }

    const { error } = await admin.from('ai_settings').update({
      price_input_per_million: pin, price_output_per_million: pout,
      monthly_budget: budget, currency,
      updated_at: new Date().toISOString(), updated_by: ctx.user.id,
    }).eq('id', true)
    if (error) {
      const missing = /price_input_per_million|monthly_budget|does not exist/i.test(error.message)
      return { ok: false, error: missing ? 'Appliquez la migration 0043_ai_usage.sql dans le SQL Editor Supabase.' : `Échec de l'enregistrement : ${error.message}` }
    }
    revalidatePath('/admin/configuration')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ============================================================
// Données personnelles (0056) — conservation, purge, export RGPD
// ============================================================
// Deux sujets dans un seul écran, et c'est délibéré : ce sont les deux
// obligations que la page /confidentialite annonce (limitation de la
// durée de conservation, art. 5.1.e ; droit d'accès, art. 15 et 20), et
// les séparer inviterait à n'en tenir qu'une.
//
// Tout passe par les fonctions SQL de la 0056. Rien n'est réimplémenté
// ici : la liste de ce qui se purge et la règle « ne pas déverser les
// données d'autrui » vivent dans la base, à un seul endroit. Une seconde
// version côté application dériverait — c'est ce que check-rbac.mjs
// existe pour empêcher ailleurs.

export interface RetentionRow {
  category: string
  label: string
  description: string
  retentionDays: number
  enabled: boolean
  operation: string
  affected: number
}

export interface RetentionRun {
  at: string
  source: string
  totalAffected: number
  byUser: string | null
}

export async function loadRetention(): Promise<{
  ok: boolean; error?: string
  rows?: RetentionRow[]; runs?: RetentionRun[]; lastRunAt?: string | null
}> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }
    const supabase = await createClient()

    const [preview, runs] = await Promise.all([
      supabase.rpc('retention_preview'),
      supabase.from('retention_runs')
        .select('at, source, total_affected, by_user, profiles:by_user(full_name)')
        .order('at', { ascending: false }).limit(5),
    ])
    // Migration non appliquée : on le dit, plutôt que d'afficher un
    // écran vide qui laisserait croire qu'il n'y a rien à purger.
    if (preview.error) {
      return { ok: false, error: `Politique de conservation illisible — la migration 0056 est-elle appliquée ? (${preview.error.message})` }
    }

    const rows = ((preview.data ?? []) as {
      category: string; label: string; description: string
      retention_days: number; enabled: boolean; operation: string; affected: number
    }[]).map(r => ({
      category: r.category, label: r.label, description: r.description,
      retentionDays: Number(r.retention_days), enabled: !!r.enabled,
      operation: r.operation, affected: Number(r.affected),
    }))

    const runRows = ((runs.data ?? []) as {
      at: string; source: string; total_affected: number
      profiles: { full_name: string } | { full_name: string }[] | null
    }[]).map(r => ({
      at: r.at, source: r.source, totalAffected: Number(r.total_affected),
      byUser: (Array.isArray(r.profiles) ? r.profiles[0]?.full_name : r.profiles?.full_name) ?? null,
    }))

    return { ok: true, rows, runs: runRows, lastRunAt: runRows[0]?.at ?? null }
  } catch (e) {
    console.error('[loadRetention] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// Borne haute à 20 ans, borne basse à 30 jours (la contrainte `check`
// de la table pose déjà le plancher — on le double ici pour rendre un
// message en français plutôt qu'une erreur Postgres).
//
// La borne haute n'est pas décorative : au-delà, « conserver » cesse
// d'être une durée et redevient « pour toujours ». Qui veut cela décoche
// la catégorie, ce qui a le mérite de s'afficher comme tel sur la page
// publique au lieu de se déguiser en durée de deux siècles.
const RETENTION_MIN_DAYS = 30
const RETENTION_MAX_DAYS = 7300

export async function updateRetentionPolicy(input: {
  category: string; retentionDays: number; enabled: boolean
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const days = Math.round(Number(input.retentionDays))
    if (!Number.isFinite(days) || days < RETENTION_MIN_DAYS || days > RETENTION_MAX_DAYS) {
      return { ok: false, error: `La durée doit être comprise entre ${RETENTION_MIN_DAYS} et ${RETENTION_MAX_DAYS} jours. Pour ne rien purger, décochez la catégorie.` }
    }

    const supabase = await createClient()
    // L'état AVANT, relevé pour la trace : après l'update, plus rien ne
    // peut dire ce qui a changé.
    const { data: before } = await supabase.from('retention_policies')
      .select('label, retention_days, enabled').eq('category', input.category).maybeSingle()
    if (!before) return { ok: false, error: 'Catégorie inconnue. Les catégories sont fixées par la migration 0056.' }

    const { error } = await supabase.from('retention_policies').update({
      retention_days: days,
      enabled: !!input.enabled,
      updated_at: new Date().toISOString(),
      updated_by: ctx.user.id,
    }).eq('category', input.category)
    if (error) {
      console.error('[updateRetentionPolicy] échec:', { code: error.code, message: error.message })
      return { ok: false, error: `Échec de l'enregistrement : ${error.message}` }
    }

    // Changer une durée de conservation n'est pas un réglage
    // d'affichage : c'est ce que la plateforme annonce aux personnes
    // concernées, et ce qu'elle détruira. La trace est portée au
    // journal, sans projet rattaché puisque le réglage est global —
    // comme le circuit de validation plus haut.
    const changed = Number(before.retention_days) !== days || !!before.enabled !== !!input.enabled
    if (changed) {
      const state = (on: boolean) => on ? 'appliquée' : 'désactivée'
      const { error: auditErr } = await supabase.from('audit_log').insert({
        project_id: null, entity: 'retention_policy', entity_id: null,
        label: before.label, action: 'modifie', user_id: ctx.user.id,
        comment: `Conservation « ${before.label} » : ${before.retention_days} j (${state(!!before.enabled)}) → ${days} j (${state(!!input.enabled)})`,
      })
      if (auditErr) console.error('[audit] trace NON enregistrée:', auditErr.message)
    }

    revalidatePath('/admin/configuration')
    revalidatePath('/confidentialite')
    return { ok: true }
  } catch (e) {
    console.error('[updateRetentionPolicy] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// `dryRun` à vrai : la fonction SQL compte sans rien détruire et
// n'inscrit rien au journal des purges. C'est le bouton « Aperçu ».
export async function runRetentionPurge(dryRun: boolean): Promise<{
  ok: boolean; error?: string; total?: number
  categories?: { categorie: string; libelle: string; operation: string; lignes: number }[]
}> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('retention_purge', { p_dry_run: dryRun })
    if (error) {
      console.error('[runRetentionPurge] échec:', { code: error.code, message: error.message })
      const missing = /retention_purge|PGRST202|schema cache/i.test(`${error.code} ${error.message}`)
      return {
        ok: false,
        error: missing
          ? 'Purge indisponible : appliquez la migration 0056_retention_et_export_rgpd.sql dans le SQL Editor Supabase.'
          : `Purge interrompue — rien n'a été supprimé : ${error.message}`,
      }
    }
    const res = (data ?? {}) as { total?: number; categories?: { categorie: string; libelle: string; operation: string; lignes: number }[] }
    revalidatePath('/admin/configuration')
    return { ok: true, total: Number(res.total ?? 0), categories: res.categories ?? [] }
  } catch (e) {
    console.error('[runRetentionPurge] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

// ------------------------------------------------------------
// Export des données d'une personne (art. 15 et 20)
// ------------------------------------------------------------
// Réservé à l'administrateur : c'est lui qui répond à une demande
// d'exercice de droits, et c'est lui qui RELIT l'export avant de le
// transmettre. L'arbitrage complet est écrit en tête de la 0056.

export interface PersonHit { id: string; fullName: string; email: string }

export async function searchPeople(query: string): Promise<{ ok: boolean; error?: string; people?: PersonHit[] }> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }
    const q = (query ?? '').trim()
    // Deux caractères au minimum : une recherche vide renverrait
    // l'annuaire complet de la plateforme dans un écran dont ce n'est
    // pas l'objet.
    if (q.length < 2) return { ok: true, people: [] }

    const supabase = await createClient()
    // `%` et `,` sont des métacaractères du filtre PostgREST : les
    // laisser passer permettrait de sortir de la clause `or(...)`.
    const safe = q.replace(/[%,()\\]/g, ' ').trim()
    if (!safe) return { ok: true, people: [] }

    const { data, error } = await supabase.from('profiles')
      .select('id, full_name, email')
      .or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`)
      .order('full_name').limit(10)
    if (error) return { ok: false, error: `Recherche impossible : ${error.message}` }
    return {
      ok: true,
      people: ((data ?? []) as { id: string; full_name: string; email: string }[])
        .map(p => ({ id: p.id, fullName: p.full_name || p.email, email: p.email })),
    }
  } catch (e) {
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function exportPersonData(userId: string): Promise<{
  ok: boolean; error?: string; filename?: string; json?: string
}> {
  try {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { ok: false, error: ctx.error }
    if (!userId) return { ok: false, error: 'Aucune personne sélectionnée.' }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('export_person_data', { p_user_id: userId })
    if (error) {
      console.error('[exportPersonData] échec:', { code: error.code, message: error.message })
      const missing = /export_person_data|PGRST202|schema cache/i.test(`${error.code} ${error.message}`)
      return {
        ok: false,
        error: missing
          ? 'Export indisponible : appliquez la migration 0056_retention_et_export_rgpd.sql dans le SQL Editor Supabase.'
          : `Export impossible : ${error.message}`,
      }
    }

    // Le nom du fichier porte l'email et la date : une réponse à une
    // demande d'exercice de droits se classe dans un dossier, et
    // « export.json » ne s'y retrouve pas.
    const { data: me } = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle()
    const slug = (me?.email ?? userId).replace(/[^a-zA-Z0-9._-]/g, '_')
    const day = new Date().toISOString().slice(0, 10)

    return {
      ok: true,
      filename: `donnees-personnelles_${slug}_${day}.json`,
      json: JSON.stringify(data, null, 2),
    }
  } catch (e) {
    console.error('[exportPersonData] exception:', e)
    return { ok: false, error: `Échec : ${e instanceof Error ? e.message : String(e)}` }
  }
}
