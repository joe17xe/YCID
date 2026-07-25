'use server'

import { createHash, randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminCreateUser } from '@/lib/supabase/auth-admin'
import { parseRecipients } from '@/lib/recipients'
import { adminClient } from '@/lib/supabase/admin'
import { isUserAdmin } from '@/lib/permissions'

const PLATFORM_ROLES = ['admin', 'ycid', 'user']

// Rôle plateforme de l'utilisateur connecté + garde-fous
async function currentContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié.' as const }
  if (!(await isUserAdmin(supabase, user.id))) return { error: 'Gestion des utilisateurs réservée aux administrateurs.' as const }
  const { data: me } = await supabase.from('profiles').select('platform_role, is_platform_admin').eq('id', user.id).maybeSingle()
  const myRole = me?.platform_role ?? (me?.is_platform_admin ? 'admin' : 'user')
  return { user, myRole }
}

type Result = { ok: boolean; error?: string }

// Extrait un message lisible depuis N'IMPORTE quelle forme d'erreur.
// Ne renvoie JAMAIS "{}" ni "[object Object]" : ces valeurs viennent de
// JSON.stringify() sur un objet Error / une réponse GoTrue vide et masquent
// la vraie cause. On tente successivement message, error_description, msg,
// details, hint, error, puis status/code, avant un dernier recours.
function describeError(e: unknown): string {
  const empty = (s: unknown) => !s || s === '{}' || s === '[object Object]'
  if (typeof e === 'string' && !empty(e)) return e
  if (e && typeof e === 'object') {
    const o = e as Record<string, unknown>
    for (const key of ['message', 'error_description', 'msg', 'details', 'hint', 'error'] as const) {
      const v = o[key]
      if (typeof v === 'string' && !empty(v)) return v
    }
    const parts: string[] = []
    if (o.status != null) parts.push(`HTTP ${String(o.status)}`)
    if (o.code != null) parts.push(`code ${String(o.code)}`)
    if (parts.length) return parts.join(' ')
  }
  try {
    const s = JSON.stringify(e)
    if (!empty(s)) return s
  } catch { /* objet non sérialisable */ }
  return String(e)
}

// Nature de la clé service réellement chargée par le serveur. Ne révèle
// JAMAIS la clé : uniquement son format, ce qui suffit au diagnostic
// (une clé « eyJ… » légale est rejetée par les projets passés aux clés
// asymétriques ES256 ; il faut la clé secrète « sb_secret_… »).
// Empreinte SHA-256 (8 hex) : irréversible, donc sûre à afficher. Elle
// permet de comparer la clé chargée EN MÉMOIRE avec celle du fichier :
//   printf '%s' "$KEY" | sha256sum | cut -c1-8
// Empreintes identiques => même clé ; différentes => l'app utilise une
// autre valeur (env résiduel, fichier modifié après le démarrage…).
function serviceKeyScheme(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) return 'absente'
  const fingerprint = createHash('sha256').update(k).digest('hex').slice(0, 8)
  const format = k.startsWith('sb_secret_') ? 'sb_secret_… (format attendu)'
    : k.startsWith('eyJ') ? 'eyJ… (ANCIENNE clé légale — à remplacer par la clé secrète sb_secret_…)'
    : `format inattendu (« ${k.slice(0, 4)}… »)`
  return `${format}, ${k.length} caractères, empreinte ${fingerprint}`
}

// Quand l'appel à l'API admin échoue de façon opaque (message vide/{}, JWT
// rejeté, clé API invalide), la cause est presque toujours la clé service.
// On ajoute un indice actionnable, avec le format de la clé chargée.
function withKeyHint(message: string): string {
  if (/jwt|kid|signature|api key|clé api|invalid.*key|401|403|^\{?\}?$/i.test(message.trim())) {
    return `${message || 'réponse vide du service'} — clé chargée par le serveur : ${serviceKeyScheme()}. Comparez cette empreinte à celle du fichier : printf '%s' "$KEY" | sha256sum | cut -c1-8 (si elles diffèrent, l'application n'utilise pas la clé de .env.local — redémarrez pm2 à neuf).`
  }
  return message
}

interface UserFormInput {
  fullName: string
  email: string
  role: string
  password: string
  confirmPassword: string
  active: boolean
}

function validate(input: UserFormInput, requirePassword: boolean): string | null {
  if (!input.fullName?.trim()) return 'Le nom complet est obligatoire.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((input.email ?? '').trim())) return 'Adresse email invalide.'
  if (!PLATFORM_ROLES.includes(input.role)) return 'Rôle invalide.'
  if (requirePassword || input.password) {
    if ((input.password ?? '').length < 12) return 'Le mot de passe doit contenir au moins 12 caractères.'
    if (input.password !== input.confirmPassword) return 'La confirmation ne correspond pas au mot de passe.'
  }
  return null
}

export async function createUser(input: UserFormInput): Promise<Result> {
  try {
    const supabase = await createClient()
    const ctx = await currentContext(supabase)
    if ('error' in ctx) return { ok: false, error: ctx.error }
    // Un YCID ne peut pas créer d'Administrateur
    if (ctx.myRole === 'ycid' && input.role === 'admin') {
      return { ok: false, error: "Le rôle YCID ne peut pas créer d'Administrateur." }
    }
    const invalid = validate(input, true)
    if (invalid) return { ok: false, error: invalid }

    const admin = adminClient()
    if (!admin) return { ok: false, error: "Création non configurée : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }

    // Appel direct à l'API Auth admin (voir lib/supabase/auth-admin.ts) :
    // requête identique à celle vérifiée en curl, et remontée du message
    // brut de Supabase en cas de refus.
    const email = input.email.trim().toLowerCase()
    const created = await adminCreateUser({ email, password: input.password, fullName: input.fullName.trim() })
    if (!created.ok || !created.userId) {
      return { ok: false, error: created.error ?? 'Échec de la création.' }
    }

    // Le trigger crée la ligne profiles ; on complète rôle + statut.
    // Si les colonnes platform_role/active manquent (migration 0017 non
    // appliquée), l'erreur remonte au lieu d'être silencieusement ignorée.
    const { error: pErr } = await admin.from('profiles').update({
      full_name: input.fullName.trim(),
      platform_role: input.role,
      is_platform_admin: input.role !== 'user',
      active: !!input.active,
    }).eq('id', created.userId)
    if (pErr) {
      console.error('[createUser] compte créé mais mise à jour du profil échouée:', { userId: created.userId, code: pErr.code, message: pErr.message, details: pErr.details, hint: pErr.hint, pErr })
      const missingColumn = /column .* does not exist|platform_role|active/i.test(`${pErr.message} ${pErr.details ?? ''}`)
      const suffix = missingColumn ? ' Appliquez la migration 0017 dans le SQL Editor Supabase.' : ''
      return { ok: false, error: `Compte créé mais profil non enregistré : ${describeError(pErr)}.${suffix}` }
    }

    revalidatePath('/admin/utilisateurs')
    return { ok: true }
  } catch (e) {
    console.error('[createUser] exception non gérée:', e)
    return { ok: false, error: `Échec de la création : ${withKeyHint(describeError(e))}` }
  }
}

export async function updateUser(userId: string, input: UserFormInput): Promise<Result> {
  try {
    const supabase = await createClient()
    const ctx = await currentContext(supabase)
    if ('error' in ctx) return { ok: false, error: ctx.error }

    const { data: target } = await supabase.from('profiles').select('platform_role, email').eq('id', userId).maybeSingle()
    if (!target) return { ok: false, error: 'Utilisateur introuvable.' }
    // Un YCID ne peut ni modifier un Administrateur, ni promouvoir en Administrateur
    if (ctx.myRole === 'ycid' && (target.platform_role === 'admin' || input.role === 'admin')) {
      return { ok: false, error: "Le rôle YCID ne peut pas modifier ni créer un Administrateur." }
    }
    const invalid = validate(input, false)
    if (invalid) return { ok: false, error: invalid }

    const admin = adminClient()
    if (!admin) return { ok: false, error: "Modification non configurée : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }

    const email = input.email.trim().toLowerCase()
    // Auth : email et/ou mot de passe
    const authUpdate: { email?: string; password?: string } = {}
    if (email !== (target.email ?? '').toLowerCase()) authUpdate.email = email
    if (input.password) authUpdate.password = input.password
    if (Object.keys(authUpdate).length) {
      const { error } = await admin.auth.admin.updateUserById(userId, authUpdate)
      if (error) {
        console.error('[updateUser] échec auth.admin.updateUserById:', { userId, status: (error as { status?: number }).status, message: error.message, error })
        if ((error as { status?: number }).status === 422 || /already|exist|registered|duplicate/i.test(error.message)) {
          return { ok: false, error: 'Un utilisateur avec cet email existe déjà.' }
        }
        return { ok: false, error: `Échec (authentification) : ${withKeyHint(describeError(error))}` }
      }
    }
    // Profil : nom, email, rôle, statut
    const { error: pErr } = await admin.from('profiles').update({
      full_name: input.fullName.trim(),
      email,
      platform_role: input.role,
      is_platform_admin: input.role !== 'user',
      active: !!input.active,
    }).eq('id', userId)
    if (pErr) {
      console.error('[updateUser] échec mise à jour profil:', { userId, code: pErr.code, message: pErr.message, details: pErr.details, hint: pErr.hint, pErr })
      return { ok: false, error: `Échec (profil) : ${describeError(pErr)}` }
    }

    revalidatePath('/admin/utilisateurs')
    return { ok: true }
  } catch (e) {
    console.error('[updateUser] exception non gérée:', e)
    return { ok: false, error: `Échec de la modification : ${withKeyHint(describeError(e))}` }
  }
}

export async function deleteUser(userId: string): Promise<Result> {
  try {
    const supabase = await createClient()
    const ctx = await currentContext(supabase)
    if ('error' in ctx) return { ok: false, error: ctx.error }
    if (ctx.user.id === userId) return { ok: false, error: 'Vous ne pouvez pas supprimer votre propre compte.' }

    const { data: target } = await supabase.from('profiles').select('platform_role').eq('id', userId).maybeSingle()
    if (!target) return { ok: false, error: 'Utilisateur introuvable.' }
    if (ctx.myRole === 'ycid' && target.platform_role === 'admin') {
      return { ok: false, error: "Le rôle YCID ne peut pas supprimer un Administrateur." }
    }
    // Ne pas supprimer le dernier administrateur
    if (target.platform_role === 'admin') {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('platform_role', 'admin')
      if ((count ?? 0) <= 1) return { ok: false, error: 'Impossible de supprimer le dernier Administrateur.' }
    }

    const admin = adminClient()
    if (!admin) return { ok: false, error: "Suppression non configurée : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) {
      console.error('[deleteUser] échec auth.admin.deleteUser:', { userId, status: (error as { status?: number }).status, message: error.message, error })
      return { ok: false, error: `Échec de la suppression : ${withKeyHint(describeError(error))}` }
    }

    revalidatePath('/admin/utilisateurs')
    return { ok: true }
  } catch (e) {
    console.error('[deleteUser] exception non gérée:', e)
    return { ok: false, error: `Échec de la suppression : ${withKeyHint(describeError(e))}` }
  }
}

// Variantes qui redirigent (utilisées par les pages formulaire créer/éditer)
export async function createUserAndRedirect(input: UserFormInput): Promise<Result> {
  const res = await createUser(input)
  if (res.ok) redirect('/admin/utilisateurs')
  return res
}

export async function updateUserAndRedirect(userId: string, input: UserFormInput): Promise<Result> {
  const res = await updateUser(userId, input)
  if (res.ok) redirect('/admin/utilisateurs')
  return res
}

// ============================================================
// PR 35 — Import en masse d'utilisateurs
// ============================================================
// Créer les comptes un par un depuis une liste d'adresses (en-tête de
// courriel, tableau, liste de diffusion) est fastidieux et source
// d'erreurs. On accepte un collage brut et on en extrait les adresses.

export interface BulkLine {
  email: string
  fullName: string
  status: 'cree' | 'existe' | 'echec'
  password?: string
  error?: string
}

export async function createUsersBulk(raw: string, role: string): Promise<{ ok: boolean; error?: string; lines?: BulkLine[] }> {
  try {
    const supabase = await createClient()
    const ctx = await currentContext(supabase)
    if ('error' in ctx) return { ok: false, error: ctx.error }
    if (!PLATFORM_ROLES.includes(role)) return { ok: false, error: 'Rôle invalide.' }
    if (ctx.myRole === 'ycid' && role === 'admin') {
      return { ok: false, error: "Le rôle YCID ne peut pas créer d'Administrateur." }
    }

    const recipients = parseRecipients(raw ?? '')
    if (!recipients.length) return { ok: false, error: 'Aucune adresse email détectée dans le texte collé.' }
    if (recipients.length > 50) return { ok: false, error: `${recipients.length} adresses détectées : limitez-vous à 50 par import.` }

    const admin = adminClient()
    if (!admin) return { ok: false, error: "Import non configuré : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur." }

    // Comptes déjà présents : on les signale sans les écraser
    const { data: existing } = await admin.from('profiles').select('email')
    const known = new Set((existing ?? []).map((p: { email: string | null }) => (p.email ?? '').toLowerCase()))

    const lines: BulkLine[] = []
    for (const r of recipients) {
      if (known.has(r.email)) {
        lines.push({ ...r, status: 'existe' })
        continue
      }
      const password = randomBytes(12).toString('base64url')
      const created = await adminCreateUser({ email: r.email, password, fullName: r.fullName })
      if (!created.ok || !created.userId) {
        lines.push({ ...r, status: created.status === 422 ? 'existe' : 'echec', error: created.error })
        continue
      }
      const { error: pErr } = await admin.from('profiles').update({
        full_name: r.fullName, platform_role: role,
        is_platform_admin: role !== 'user', active: true,
      }).eq('id', created.userId)
      if (pErr) console.error('[createUsersBulk] profil non complété:', { email: r.email, message: pErr.message })
      lines.push({ ...r, status: 'cree', password })
    }

    revalidatePath('/admin/utilisateurs')
    return { ok: true, lines }
  } catch (e) {
    console.error('[createUsersBulk] exception:', e)
    return { ok: false, error: `Échec de l'import : ${e instanceof Error ? e.message : String(e)}` }
  }
}
