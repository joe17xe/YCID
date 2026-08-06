'use server'

import { createHash, randomBytes } from 'crypto'
import { EMAIL_RE, isUsableEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminCreateUser } from '@/lib/supabase/auth-admin'
import { parseRecipients } from '@/lib/recipients'
import { adminClient } from '@/lib/supabase/admin'
import { canAnonymizeAccounts, isUserAdmin } from '@/lib/permissions'
import {
  anonymizationConfirmationTarget, anonymizationConfirmed,
  asTraceCount, describeTraces, type TraceCount,
} from './anonymisation'

// Deux rôles seulement (0037). Les garde-fous « ycid » plus bas sont
// conservés à dessein : ils protègent encore les bases où la migration
// n'a pas été jouée et où des comptes portent l'ancien rôle.
const PLATFORM_ROLES = ['admin', 'user']

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
  canManageRoadmap?: boolean
  // Rattachement aux organisations (PR 42). C'est LE lien qui porte le
  // périmètre : un membre d'YCID voit les projets où YCID figure. Il
  // n'avait aucun écran — `memberships` était lue trois fois, écrite
  // zéro fois, donc désespérément vide.
  organizationIds?: string[]
}

// Remplace le rattachement d'un compte par la liste fournie. Un
// remplacement plutôt qu'un ajout : le formulaire montre l'état complet,
// décocher doit donc retirer.
async function syncMemberships(userId: string, orgIds: string[] | undefined) {
  if (!orgIds) return null
  const admin = adminClient()
  if (!admin) return "Rattachement non configuré : ajoutez SUPABASE_SERVICE_ROLE_KEY au serveur."
  const { error: delErr } = await admin.from('memberships').delete().eq('user_id', userId)
  if (delErr) return `Rattachement non mis à jour : ${delErr.message}`
  if (!orgIds.length) return null
  const { error: insErr } = await admin.from('memberships')
    .insert(orgIds.map(org_id => ({ user_id: userId, org_id, role: 'membre' })))
  if (insErr) return `Rattachement non mis à jour : ${insErr.message}`
  return null
}

function validate(input: UserFormInput, requirePassword: boolean): string | null {
  if (!input.fullName?.trim()) return 'Le nom complet est obligatoire.'
  if (!EMAIL_RE.test((input.email ?? '').trim())) return 'Adresse email invalide.'
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
      is_platform_admin: input.role === 'admin',
      can_manage_roadmap: !!input.canManageRoadmap,
      active: !!input.active,
    }).eq('id', created.userId)
    if (pErr) {
      console.error('[createUser] compte créé mais mise à jour du profil échouée:', { userId: created.userId, code: pErr.code, message: pErr.message, details: pErr.details, hint: pErr.hint, pErr })
      const missingColumn = /column .* does not exist|platform_role|active/i.test(`${pErr.message} ${pErr.details ?? ''}`)
      const suffix = missingColumn ? ' Appliquez la migration 0017 dans le SQL Editor Supabase.' : ''
      return { ok: false, error: `Compte créé mais profil non enregistré : ${describeError(pErr)}.${suffix}` }
    }

    const orgErr = await syncMemberships(created.userId, input.organizationIds)
    if (orgErr) return { ok: false, error: `Compte créé, mais ${orgErr.charAt(0).toLowerCase()}${orgErr.slice(1)}` }

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

    const { data: target } = await supabase.from('profiles').select('platform_role, email, anonymized_at').eq('id', userId).maybeSingle()
    if (!target) return { ok: false, error: 'Utilisateur introuvable.' }
    // Une anonymisation qu'on peut défaire n'est pas une anonymisation.
    // Sans ce refus, « Modifier » suffirait à réattribuer un nom et une
    // adresse réelle à une pierre tombale — donc à RE-IDENTIFIER toutes
    // les traces qu'on venait d'anonymiser, en trois clics et sans que
    // rien ne le signale. L'écran masque déjà le bouton (page.tsx) ;
    // ceci est le verrou, l'autre n'est que la politesse.
    if (target.anonymized_at) {
      return {
        ok: false,
        error: "Ce compte a été anonymisé : son identité ne peut plus être modifiée. "
          + "L'effacement RGPD est irréversible par construction — voir la migration 0055.",
      }
    }
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
      is_platform_admin: input.role === 'admin',
      can_manage_roadmap: !!input.canManageRoadmap,
      active: !!input.active,
    }).eq('id', userId)
    if (pErr) {
      console.error('[updateUser] échec mise à jour profil:', { userId, code: pErr.code, message: pErr.message, details: pErr.details, hint: pErr.hint, pErr })
      return { ok: false, error: `Échec (profil) : ${describeError(pErr)}` }
    }

    const orgErr = await syncMemberships(userId, input.organizationIds)
    if (orgErr) return { ok: false, error: orgErr }

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

    const { data: target } = await supabase.from('profiles').select('platform_role, anonymized_at').eq('id', userId).maybeSingle()
    if (!target) return { ok: false, error: 'Utilisateur introuvable.' }
    if (ctx.myRole === 'ycid' && target.platform_role === 'admin') {
      return { ok: false, error: "Le rôle YCID ne peut pas supprimer un Administrateur." }
    }
    // Ne pas supprimer le dernier administrateur
    if (target.platform_role === 'admin') {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('platform_role', 'admin')
      if ((count ?? 0) <= 1) return { ok: false, error: 'Impossible de supprimer le dernier Administrateur.' }
    }
    // Une pierre tombale ne se supprime pas : elle EST l'attestation que
    // l'effacement a eu lieu, et c'est elle qui porte l'auteur des
    // traces conservées. Le cas se produit vraiment — un compte anonymisé
    // n'ayant laissé AUCUNE trace n'est retenu par aucune clé étrangère,
    // la suppression aboutirait donc en silence.
    if (target.anonymized_at) {
      return { ok: false, error: "Ce compte a déjà été anonymisé : il n'y a plus rien à supprimer, et sa pierre tombale atteste l'effacement." }
    }

    // ----------------------------------------------------------
    // Le bouton qui ne pouvait pas marcher
    // ----------------------------------------------------------
    // `auth.admin.deleteUser` supprime la ligne `auth.users`, d'où le
    // profil part en cascade (0001 : `references auth.users(id) on
    // delete cascade`). Mais treize clés étrangères visent `profiles`
    // SANS action de suppression — `audit_log.user_id` en tête — et
    // PostgreSQL refuse (23503). GoTrue rend alors un « Database error
    // deleting user » qui ne dit ni pourquoi ni quoi faire.
    //
    // Autrement dit : pour tout compte ayant validé, déposé ou créé quoi
    // que ce soit, ce bouton échouait à coup sûr. On pose la question
    // AVANT, plutôt que de traduire après coup une erreur de service
    // dont le texte ne nous appartient pas.
    const { data: rawTraces, error: traceErr } = await supabase.rpc('profile_trace_count', { p_user_id: userId })
    if (traceErr) {
      // Migration 0055 non appliquée : on ne bloque pas une
      // fonctionnalité qui existait avant elle. Le comportement
      // d'origine reprend, avec son erreur opaque — et le journal
      // serveur dit pourquoi on n'a pas pu faire mieux.
      console.error('[deleteUser] inventaire des traces indisponible (migration 0055 appliquée ?) :', traceErr.message)
    } else {
      const traces = asTraceCount(rawTraces)
      if (traces.blocking > 0) {
        return {
          ok: false,
          error: `Ce compte a laissé ${traces.blocking} trace${traces.blocking > 1 ? 's' : ''} que l'application doit conserver `
            + `(${describeTraces(traces.detail).slice(0, 3).join(', ')}…). La base refuse de les détacher de leur auteur : `
            + `une décision de validation sans décideur ne vaut rien devant un financeur. `
            + `Utilisez « Anonymiser » — l'identité disparaît, les traces restent.`,
        }
      }
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

// ============================================================
// Effacement RGPD (art. 17) par ANONYMISATION
// ============================================================
// L'écran Confidentialité promet aux personnes un droit d'effacement que
// la base refusait de tenir (migration 0055, qui raconte l'arbitrage en
// entier). Le geste retenu n'est pas une suppression : c'est le
// remplacement, EN PLACE et sans retour, de l'identité par une pierre
// tombale. La décision de validation du 12 mars reste la décision de
// validation du 12 mars ; son auteur devient « Utilisateur supprimé
// #1000 ».
//
// Cette action enchaîne quatre gestes que rien ne peut rendre atomiques —
// ils s'adressent à trois systèmes différents (Postgres, GoTrue,
// Storage). L'ORDRE est donc la seule garantie qu'on ait, et il est
// choisi pour que chaque échec laisse un état DÉFENDABLE :
//
//   1. la base (rpc `anonymize_profile`). Irréversible, donc en premier :
//      si elle échoue, rien d'autre n'a bougé. Elle pose `active = false`,
//      ce qui ferme l'accès à l'application dès la navigation suivante
//      (app/(app)/layout.tsx) — la personne est donc DÉJÀ dehors quand
//      les étapes suivantes s'exécutent ;
//   2. le fichier d'avatar (Storage). Une photo est une donnée
//      personnelle ; `avatar_url` a été vidée en 1, le fichier non ;
//   3. le compte d'authentification (GoTrue) : adresse remplacée par la
//      MÊME pierre tombale, métadonnée `full_name` écrasée, mot de passe
//      remplacé par une valeur que personne ne connaît, compte banni. On
//      ne le SUPPRIME jamais : la cascade `auth.users → profiles`
//      emporterait la pierre tombale et, avec elle, l'auteur de toutes
//      les traces ;
//   4. la trace au journal.
//
// Un échec en 2 ou 3 ne fait pas échouer l'opération — le profil EST
// anonymisé et le nier serait mentir — mais il remonte tel quel à
// l'écran ET dans la trace : c'est ce qui reste à finir à la main.

export interface AnonymizeResult extends Result {
  tombstone?: string
  warning?: string
}

// Supprime les fichiers d'avatar d'un compte. Passe par la clé de
// service : la policy « Avatar delete » (0009) n'autorise que le
// PROPRIÉTAIRE du dossier, un administrateur agissant pour autrui serait
// donc écarté — et un `remove` écarté par la RLS ne lève pas d'erreur,
// il rend une liste vide et l'écran annoncerait une photo effacée qui
// reste servie.
async function removeAvatarFiles(userId: string): Promise<{ removed: number; error?: string }> {
  const admin = adminClient()
  if (!admin) return { removed: 0, error: 'clé de service absente du serveur (SUPABASE_SERVICE_ROLE_KEY)' }
  const { data: files, error: listErr } = await admin.storage.from('avatars').list(userId)
  if (listErr) return { removed: 0, error: listErr.message }
  const paths = (files ?? []).map(f => `${userId}/${f.name}`)
  if (!paths.length) return { removed: 0 }
  const { data: gone, error: rmErr } = await admin.storage.from('avatars').remove(paths)
  if (rmErr) return { removed: 0, error: rmErr.message }
  return { removed: (gone ?? []).length }
}

// Inventaire lu AVANT le geste, pour l'écran de confirmation : « voici
// ce qui sera conservé ». Sans lui, l'écran demande un geste
// irréversible sans en montrer la portée — et l'administrateur ne peut
// pas répondre à la personne qui lui écrit « qu'est-ce qu'il reste de
// moi ? ».
export async function loadAnonymizationPreview(userId: string): Promise<{
  ok: boolean; error?: string; traces?: TraceCount
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non authentifié.' }
  if (!(await canAnonymizeAccounts(supabase, user.id))) {
    return { ok: false, error: "L'anonymisation est réservée aux administrateurs de la plateforme." }
  }
  const { data, error } = await supabase.rpc('profile_trace_count', { p_user_id: userId })
  if (error) {
    return {
      ok: false,
      error: error.code === 'PGRST202'
        ? "Fonction absente : la migration 0055 n'est pas appliquée sur cette base."
        : `Inventaire indisponible : ${error.message}`,
    }
  }
  return { ok: true, traces: asTraceCount(data) }
}

export async function anonymizeUser(userId: string, confirmation: string): Promise<AnonymizeResult> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non authentifié.' }
    if (!(await canAnonymizeAccounts(supabase, user.id))) {
      return { ok: false, error: "L'anonymisation est réservée aux administrateurs de la plateforme." }
    }
    if (user.id === userId) {
      return { ok: false, error: 'Vous ne pouvez pas anonymiser votre propre compte.' }
    }

    const { data: target } = await supabase.from('profiles')
      .select('full_name, email, anonymized_at').eq('id', userId).maybeSingle()
    if (!target) return { ok: false, error: 'Utilisateur introuvable.' }
    if (target.anonymized_at) return { ok: false, error: 'Ce compte est déjà anonymisé.' }

    // ------------------------------------------------------------
    // La confirmation, et le piège qu'elle porte
    // ------------------------------------------------------------
    // Le dépôt confirme ses suppressions par recopie du nom. Le défaut
    // qui va avec a déjà été trouvé deux fois (phases, puis projets) :
    // avec un nom vide, `'' !== ''` est FAUX, donc la confirmation passe
    // sans qu'on ait rien saisi. Ici la cible est calculée par une
    // échelle — nom, sinon adresse — et `anonymizationConfirmed` REFUSE
    // catégoriquement une cible vide, au lieu de laisser une comparaison
    // décider par accident. Le même code sert à l'écran (voir
    // ./anonymisation.ts) : les deux ne peuvent pas diverger.
    const expected = anonymizationConfirmationTarget(target)
    if (!expected) {
      return {
        ok: false,
        error: "Ce compte n'a ni nom ni adresse : la confirmation consiste à recopier l'un des deux, "
          + "et sans eux rien ne prouve qu'on anonymise le bon compte. Renseignez d'abord une adresse "
          + "depuis « Modifier », puis recommencez.",
      }
    }
    if (!anonymizationConfirmed(expected, confirmation)) {
      return { ok: false, error: 'La saisie ne correspond pas — anonymisation annulée.' }
    }

    // ------------------------------------------------------------
    // 1. La base — l'unique étape irréversible
    // ------------------------------------------------------------
    // Appelée avec le client de l'ADMINISTRATEUR, pas avec la clé de
    // service : la fonction est `security definer` et s'appuie sur
    // `is_admin()`, donc sur `auth.uid()`. Sous la clé de service,
    // `auth.uid()` est nul et la fonction refuserait — à juste titre.
    const { data: rawResult, error: rpcErr } = await supabase.rpc('anonymize_profile', { p_user_id: userId })
    if (rpcErr) {
      if (rpcErr.code === 'PGRST202') {
        return { ok: false, error: "Anonymisation impossible : la migration 0055 n'est pas appliquée sur cette base. Rien n'a été modifié." }
      }
      console.error('[anonymizeUser] rpc anonymize_profile refusée :', { userId, code: rpcErr.code, message: rpcErr.message, details: rpcErr.details })
      return { ok: false, error: `Anonymisation refusée : ${describeError(rpcErr)}` }
    }
    const result = (rawResult ?? {}) as {
      number?: number; full_name?: string; email?: string; had_avatar?: boolean; traces?: unknown
    }
    const tombstoneName = result.full_name ?? 'Utilisateur supprimé'
    const tombstoneEmail = result.email ?? ''
    const traces = asTraceCount(result.traces)

    // À partir d'ici, PLUS RIEN ne peut faire échouer l'opération : le
    // profil est anonymisé, répondre `ok: false` ferait croire à
    // l'administrateur qu'il ne l'est pas. Ce qui suit se raconte.
    const notes: string[] = []
    const warnings: string[] = []

    // ------------------------------------------------------------
    // 2. Le fichier d'avatar
    // ------------------------------------------------------------
    const avatar = await removeAvatarFiles(userId)
    if (avatar.error) {
      console.error('[anonymizeUser] photo de profil NON supprimée :', { userId, error: avatar.error })
      warnings.push(`la photo de profil n'a pas pu être supprimée du bucket « avatars » (${avatar.error}) : `
        + `à retirer à la main sous avatars/${userId}/`)
    } else if (avatar.removed > 0) {
      notes.push(`${avatar.removed} fichier${avatar.removed > 1 ? 's' : ''} de photo de profil supprimé${avatar.removed > 1 ? 's' : ''}`)
    } else if (result.had_avatar) {
      // La colonne annonçait une photo, le bucket n'en avait pas : le
      // fichier a été supprimé ailleurs, ou l'URL pointait hors bucket.
      // Ça se dit, ça ne s'alarme pas.
      notes.push('aucun fichier de photo trouvé dans le bucket')
    }

    // ------------------------------------------------------------
    // 3. Le compte d'authentification — bloqué, JAMAIS supprimé
    // ------------------------------------------------------------
    const admin = adminClient()
    if (!admin) {
      warnings.push("le compte d'authentification n'a pas pu être bloqué (SUPABASE_SERVICE_ROLE_KEY absente du serveur) : "
        + "l'adresse réelle subsiste dans auth.users et la personne peut encore se connecter — l'application la déconnectera aussitôt "
        + "(compte désactivé), mais le blocage doit être fait depuis le tableau de bord Supabase.")
    } else {
      const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
        // La même pierre tombale que le profil : l'adresse réelle ne doit
        // pas survivre dans le schéma `auth`, où aucun écran ne la montre
        // et où personne ne penserait à la chercher.
        email: tombstoneEmail || undefined,
        email_confirm: true,
        // `raw_user_meta_data.full_name` est posé à la création du compte
        // (lib/supabase/auth-admin.ts) : c'est le nom de la personne, en
        // clair, dans une colonne qu'aucun écran ne lit. Il part aussi.
        user_metadata: { full_name: tombstoneName },
        // L'ancien mot de passe ne vaut plus rien, y compris pour qui
        // l'aurait noté. La valeur tirée ici n'est communiquée à
        // personne : c'est une serrure sans clé, pas un mot de passe.
        password: randomBytes(24).toString('base64url'),
        // 100 ans. GoTrue refuse alors toute connexion et tout
        // renouvellement de jeton. Un jeton d'accès déjà émis reste
        // valide jusqu'à son expiration (une heure), mais le profil porte
        // `active = false` : l'application déconnecte son porteur à la
        // navigation suivante.
        ban_duration: '876000h',
      })
      if (authErr) {
        console.error('[anonymizeUser] compte auth NON bloqué :', { userId, status: (authErr as { status?: number }).status, message: authErr.message })
        warnings.push(`le compte d'authentification n'a pas pu être bloqué (${withKeyHint(describeError(authErr))}) : `
          + `à faire depuis le tableau de bord Supabase, Authentication ▸ Users ▸ Ban user. `
          + `NE PAS le supprimer : la suppression emporterait le profil anonymisé et l'auteur de toutes ses traces.`)
      } else {
        notes.push("compte d'authentification banni, adresse et mot de passe remplacés")
      }
    }

    // ------------------------------------------------------------
    // 4. La trace — et le piège qu'elle porte
    // ------------------------------------------------------------
    // Rien de personnel n'entre ici. C'est l'erreur classique de
    // l'anonymisation : consigner « Compte de Jean Dupont anonymisé »
    // rend l'opération NULLE, puisque l'identité se relit dans la trace
    // même qui l'efface — et le journal, lui, est fait pour durer.
    //
    // Ce qui est écrit : la pierre tombale, l'identifiant technique (qui
    // ne désigne plus personne mais reste la clé regroupant les traces
    // du compte), le compte de ce qui a été conservé, et ce qui a échoué.
    // `project_id: null`, comme la purge du stockage : l'événement ne
    // relève d'aucun projet.
    const detail = describeTraces(traces.detail)
    const trace = {
      project_id: null, entity: 'profile', entity_id: userId,
      label: `Compte anonymisé — ${tombstoneName}`,
      action: 'supprime', user_id: user.id,
      comment: [
        `Effacement RGPD (art. 17) par anonymisation en place. Identifiant ${userId}.`,
        ` Nom, adresse et photo remplacés par « ${tombstoneName} » ; `,
        notes.length ? `${notes.join(' ; ')}.` : 'aucune action complémentaire.',
        traces.total
          ? ` ${traces.total} trace${traces.total > 1 ? 's' : ''} conservée${traces.total > 1 ? 's' : ''} : ${detail.join(', ')}.`
          : ' Ce compte n\'avait laissé aucune trace.',
        warnings.length ? ` RESTE À FAIRE : ${warnings.join(' ; ')}.` : '',
      ].join(''),
    }
    const { error: auditErr } = await supabase.from('audit_log').insert(trace)
    // Convention des cinq autres suppressions du dépôt (deleteTask,
    // deleteProject, deleteDocument, deletePhase, purgeOrphans) : le
    // geste est fait, on ne le dément pas, et le journal SERVEUR porte le
    // payload complet — réinscriptible à la main.
    if (auditErr) {
      console.error('[audit] ANONYMISATION NON TRACÉE — à réinscrire à la main :',
        JSON.stringify(trace), '—', auditErr.message)
      warnings.push(`la trace au journal n'a pas pu être écrite (${auditErr.message}) : elle figure dans le journal serveur, à réinscrire`)
    }

    revalidatePath('/admin/utilisateurs')
    return { ok: true, tombstone: tombstoneName, warning: warnings.length ? warnings.join(' ; ') : undefined }
  } catch (e) {
    console.error('[anonymizeUser] exception non gérée:', e)
    return { ok: false, error: `Échec de l'anonymisation : ${withKeyHint(describeError(e))}` }
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
      // Le rejet se SIGNALE dans le rapport, il ne se tait pas : deux
      // adresses à point en tête sont passées ici, dont celle d'un
      // référent mairie — injoignable par notification sans que rien
      // ne le dise. La règle est celle de l'envoi (lib/email.ts).
      if (!isUsableEmail(r.email)) {
        lines.push({ ...r, status: 'echec', error: 'Adresse malformée (un point en tête, par exemple) — corrigez-la dans le texte collé et réimportez.' })
        continue
      }
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
        is_platform_admin: role === 'admin', active: true,
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
