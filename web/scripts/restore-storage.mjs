// ============================================================
// Restauration des fichiers du Storage — vers un projet CIBLE
// ============================================================
// L'autre moitié de backup-storage.mjs : renvoie un instantané
// (dossier daté + manifest.json) vers un projet Supabase. Sert à
// ÉPROUVER la restauration sur un projet jetable — une sauvegarde
// jamais restaurée est une intention, pas une sauvegarde — et, le
// mauvais jour venu, à restaurer pour de vrai.
//
// L'URL et la clé du projet CIBLE se passent en arguments, jamais lus
// dans .env.local : restaurer par accident PAR-DESSUS la production
// ne doit pas être possible en se trompant d'environnement.
//
//   node restore-storage.mjs <instantané> <url-projet-cible> <service-role-cible>
//
// Les buckets manquants sont créés (privés). Les fichiers existants
// sont écrasés (upsert) : la restauration fait foi.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [snapshot, targetUrl, targetKey] = process.argv.slice(2)
if (!snapshot || !targetUrl || !targetKey) {
  console.error('Usage : node restore-storage.mjs <instantané> <url-projet-cible> <service-role-cible>')
  process.exit(1)
}
const manifestPath = join(resolve(snapshot), 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error(`❌ manifest.json introuvable dans ${snapshot}`)
  process.exit(1)
}
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const supabase = createClient(targetUrl, targetKey, { auth: { autoRefreshToken: false, persistSession: false } })

const bucketsNeeded = [...new Set(manifest.map(e => e.bucket))]
const { data: existing } = await supabase.storage.listBuckets()
const have = new Set((existing ?? []).map(b => b.name))
for (const name of bucketsNeeded) {
  if (have.has(name)) continue
  const { error } = await supabase.storage.createBucket(name)
  if (error) { console.error(`❌ Création du bucket ${name} : ${error.message}`); process.exit(1) }
  console.log(`    Bucket créé : ${name}`)
}

let ok = 0
const failures = []
for (const e of manifest) {
  const file = join(resolve(snapshot), e.bucket, e.path)
  if (!existsSync(file)) { failures.push(`${e.bucket}/${e.path} : absent de l'instantané`); continue }
  const { error } = await supabase.storage.from(e.bucket).upload(e.path, readFileSync(file), { upsert: true })
  if (error) failures.push(`${e.bucket}/${e.path} : ${error.message}`)
  else ok++
}

console.log(`    ${ok}/${manifest.length} fichier(s) restauré(s) vers ${targetUrl}.`)
if (failures.length) {
  console.error(`❌ ${failures.length} échec(s) :`)
  for (const f of failures.slice(0, 10)) console.error(`   ${f}`)
  process.exit(1)
}
