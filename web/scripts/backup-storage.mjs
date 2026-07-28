// ============================================================
// Sauvegarde des fichiers du Storage — et point de contrôle
// ============================================================
// Appelé par scripts/backup.sh (VPS). Deux modes :
//
//   node backup-storage.mjs <dossier-cible>
//     Copie TOUS les fichiers de TOUS les buckets dans le dossier,
//     et écrit manifest.json (bucket, chemin, taille, updated_at).
//     Incrémental : un fichier inchangé depuis l'instantané précédent
//     (même taille, même updated_at) est repris par LIEN DUR au lieu
//     d'être retéléchargé — l'offre Free plafonne la bande passante,
//     retélécharger chaque nuit l'épuiserait en pure perte.
//
//   node backup-storage.mjs --stamp
//     Horodate platform_settings.backup_last_at. Appelé par backup.sh
//     en DERNIER : jamais de point de contrôle sans que la base ET les
//     fichiers aient réussi. Si la colonne n'existe pas encore
//     (migration 0052 non passée), avertit sans faire échouer la
//     sauvegarde — les fichiers, eux, sont bien copiés.
//
// Le moindre fichier en échec fait échouer le mode copie (exit 1) :
// un instantané partiel qui se tait ressemble à un instantané complet,
// et on le découvre le jour où on restaure.
//
// Identifiants : lus dans web/.env.local (la source de vérité du VPS,
// voir deploy.sh) — NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// Volontairement sans dépendance nouvelle : @supabase/supabase-js est
// déjà celle de l'application.

import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, linkSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const file = join(WEB_DIR, '.env.local')
  const env = {}
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return { ...env, ...process.env }
}

const env = loadEnvLocal()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY introuvables (web/.env.local)')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// ------------------------------------------------------------
// Mode --stamp : le point de contrôle
// ------------------------------------------------------------
if (process.argv[2] === '--stamp') {
  const { error } = await supabase.from('platform_settings')
    .update({ backup_last_at: new Date().toISOString() })
    .not('id', 'is', null)
  if (error) {
    console.warn(`⚠ Point de contrôle non posé (migration 0052 passée ?) : ${error.message}`)
  } else {
    console.log('    Point de contrôle horodaté (Admin ▸ Stockage).')
  }
  process.exit(0)
}

// ------------------------------------------------------------
// Mode copie
// ------------------------------------------------------------
const target = process.argv[2]
if (!target) {
  console.error('Usage : node backup-storage.mjs <dossier-cible> | --stamp')
  process.exit(1)
}

// L'instantané précédent, pour l'incrémental : le dernier dossier frère
// (ordre lexicographique = ordre chronologique, les noms sont datés).
const parent = dirname(resolve(target))
let previous = null
if (existsSync(parent)) {
  const siblings = readdirSync(parent).filter(d => resolve(parent, d) !== resolve(target)).sort()
  if (siblings.length) {
    const last = join(parent, siblings[siblings.length - 1])
    const manifestPath = join(last, 'manifest.json')
    if (existsSync(manifestPath)) {
      try {
        previous = { dir: last, entries: new Map(JSON.parse(readFileSync(manifestPath, 'utf8')).map(e => [`${e.bucket}/${e.path}`, e])) }
      } catch { previous = null }
    }
  }
}

async function listAll(bucket, prefix) {
  const out = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset })
    if (error) throw new Error(`list ${bucket}/${prefix ?? ''} : ${error.message}`)
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if (item.id === null) out.push(...await listAll(bucket, path)) // dossier
      else out.push({ path, size: item.metadata?.size ?? null, updated_at: item.updated_at ?? null })
    }
    if (!data || data.length < 1000) break
    offset += data.length
  }
  return out
}

const { data: buckets, error: bErr } = await supabase.storage.listBuckets()
if (bErr) { console.error(`❌ listBuckets : ${bErr.message}`); process.exit(1) }

const manifest = []
const failures = []
let linked = 0, downloaded = 0

for (const b of buckets ?? []) {
  let files
  try { files = await listAll(b.name, '') }
  catch (e) { failures.push(String(e)); continue }
  for (const f of files) {
    const dest = join(target, b.name, f.path)
    mkdirSync(dirname(dest), { recursive: true })
    const prev = previous?.entries.get(`${b.name}/${f.path}`)
    const prevFile = prev ? join(previous.dir, b.name, f.path) : null
    if (prev && prev.size === f.size && prev.updated_at === f.updated_at && prevFile && existsSync(prevFile)) {
      try {
        linkSync(prevFile, dest)
        linked++
        manifest.push({ bucket: b.name, path: f.path, size: f.size, updated_at: f.updated_at })
        continue
      } catch { /* lien impossible (autre système de fichiers…) : on télécharge */ }
    }
    try {
      const { data, error } = await supabase.storage.from(b.name).download(f.path)
      if (error) throw new Error(error.message)
      writeFileSync(dest, Buffer.from(await data.arrayBuffer()))
      downloaded++
      manifest.push({ bucket: b.name, path: f.path, size: statSync(dest).size, updated_at: f.updated_at })
    } catch (e) {
      failures.push(`${b.name}/${f.path} : ${e.message ?? e}`)
    }
  }
}

mkdirSync(resolve(target), { recursive: true })
writeFileSync(join(target, 'manifest.json'), JSON.stringify(manifest, null, 1))

console.log(`    ${manifest.length} fichier(s) — ${downloaded} téléchargé(s), ${linked} repris par lien dur.`)
if (failures.length) {
  console.error(`❌ ${failures.length} échec(s) :`)
  for (const f of failures.slice(0, 10)) console.error(`   ${f}`)
  process.exit(1)
}
