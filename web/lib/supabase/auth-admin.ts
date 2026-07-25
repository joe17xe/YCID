import { createHash } from 'crypto'

// ============================================================
// Appels directs à l'API Auth admin de Supabase (GoTrue)
// ============================================================
// Pourquoi ne pas utiliser supabase-js ici : le 25/07/2026, la clé
// secrète du serveur répondait HTTP 200 en appel direct (curl) alors
// que le même appel via supabase-js échouait avec un message JWT
// trompeur. Cet appel direct reproduit exactement la requête vérifiée,
// et surtout remonte le CORPS DE RÉPONSE BRUT de Supabase — le vrai
// message d'erreur, au lieu de l'emballage de la librairie.
// Serveur uniquement : la clé ne doit jamais atteindre le navigateur.

export interface AdminUserResult {
  ok: boolean
  userId?: string
  status?: number
  error?: string
}

// Empreinte SHA-256 (8 hex) — irréversible, sûre à afficher. Permet de
// comparer la clé chargée en mémoire avec celle du fichier :
//   printf '%s' "$KEY" | sha256sum | cut -c1-8
export function serviceKeyDiagnostic(): string {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) return 'clé absente du serveur'
  const format = k.startsWith('sb_secret_') ? 'sb_secret_…'
    : k.startsWith('eyJ') ? 'eyJ… (ANCIENNE clé légale, rejetée par les projets en ES256)'
    : `format inattendu (« ${k.slice(0, 4)}… »)`
  return `${format}, ${k.length} caractères, empreinte ${createHash('sha256').update(k).digest('hex').slice(0, 8)}`
}

export async function adminCreateUser(input: {
  email: string
  password: string
  fullName: string
}): Promise<AdminUserResult> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!key || !url) {
    return { ok: false, error: "Création non configurée : SUPABASE_SERVICE_ROLE_KEY et NEXT_PUBLIC_SUPABASE_URL doivent être définis sur le serveur." }
  }

  let res: Response
  try {
    res = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { full_name: input.fullName },
      }),
      cache: 'no-store',
    })
  } catch (e) {
    console.error('[adminCreateUser] échec réseau:', e)
    return { ok: false, error: `Contact impossible avec Supabase : ${e instanceof Error ? e.message : String(e)}` }
  }

  const raw = await res.text()
  let body: Record<string, unknown> = {}
  try { body = raw ? JSON.parse(raw) : {} } catch { /* réponse non JSON */ }

  if (res.ok) {
    const userId = typeof body.id === 'string' ? body.id : undefined
    if (!userId) {
      console.error('[adminCreateUser] réponse sans identifiant:', raw.slice(0, 300))
      return { ok: false, status: res.status, error: 'Compte créé mais identifiant absent de la réponse Supabase.' }
    }
    return { ok: true, userId, status: res.status }
  }

  // Message réel de Supabase (msg / error_description / message / error)
  const detail = ['msg', 'error_description', 'message', 'error'].reduce<string>((acc, k) => {
    const v = body[k]
    return acc || (typeof v === 'string' && v ? v : '')
  }, '') || raw.slice(0, 200) || `HTTP ${res.status}`

  console.error('[adminCreateUser] refus de Supabase:', { status: res.status, detail, body: raw.slice(0, 500) })

  if (res.status === 422 || /already|exist|registered|duplicate/i.test(detail)) {
    return { ok: false, status: res.status, error: 'Un utilisateur avec cet email existe déjà.' }
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: res.status, error: `Supabase a refusé la clé du serveur (HTTP ${res.status}) : ${detail} — clé chargée : ${serviceKeyDiagnostic()}.` }
  }
  if (res.status >= 500) {
    return { ok: false, status: res.status, error: `Erreur interne de Supabase (HTTP ${res.status}) : ${detail}. Consultez Dashboard → Logs → Auth et Postgres.` }
  }
  return { ok: false, status: res.status, error: `Échec de la création (HTTP ${res.status}) : ${detail}` }
}
