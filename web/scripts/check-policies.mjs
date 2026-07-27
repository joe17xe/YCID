// ============================================================
// Garde-fou : une policy ne lit jamais sa propre table
// ============================================================
// PostgreSQL applique la RLS aux lectures faites DANS le corps d'une
// policy. Une policy sur `validations` qui interroge `validations`
// rappelle donc la même policy, qui relit la table, sans fin :
//
//   infinite recursion detected in policy for relation "validations"
//
// Le coût n'est pas théorique. Ce dépôt a subi la panne trois fois :
//
//   0003  récursion sur `profiles`      — trouvée par relecture
//   0010  récursion sur les memberships — trouvée par relecture
//   0041  récursion sur `validations`   — trouvée par l'utilisateur,
//         en recette, après six jours pendant lesquels AUCUNE
//         validation n'était possible dans l'application
//
// La troisième est la plus instructive : la migration était relue,
// commentée, documentée, et le défaut a survécu à tout cela. Il ne se
// voit pas à la lecture — il se voit à l'exécution, sur une base, au
// moment du clic. Ce contrôle le voit à l'écriture.
//
// Le remède est toujours le même : déporter la lecture dans une
// fonction `security definer`, qui n'est pas soumise à la RLS.
//
//   node scripts/check-policies.mjs
//
// Sans dépendance, comme les deux autres contrôles.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const sqlDir = join(ROOT, 'supabase/migrations')

// Concaténation dans l'ordre d'application : une policy est réécrite de
// migration en migration, et seule la DERNIÈRE compte. Contrôler la
// première reviendrait à juger une règle morte — et, ici, à signaler
// éternellement un défaut déjà corrigé.
const files = readdirSync(sqlDir).filter(f => f.endsWith('.sql')).sort()
const sql = files.map(f => `\n-- @@FILE ${f}\n` + readFileSync(join(sqlDir, f), 'utf8')).join('\n')

const fileAt = (idx) => {
  const m = [...sql.slice(0, idx).matchAll(/-- @@FILE (\S+)/g)].pop()
  return m ? m[1] : '?'
}

const bare = (t) => t.replace(/^public\./i, '').toLowerCase()

// Événements ordonnés : le dernier `create` ou `drop` d'une policy
// donnée fait foi. `drop ... ; create ...` se suivent presque toujours,
// et le create l'emporte parce qu'il vient après.
const events = []
for (const m of sql.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+([a-z_.]+)/gi)) {
  events.push({ idx: m.index, kind: 'drop', name: m[1], table: bare(m[2]) })
}
// `[^;]*` borne au statement : le corps d'une policy ne contient pas de
// point-virgule, et une lecture gloutonne traverserait la suivante.
for (const m of sql.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+([a-z_.]+)([^;]*)/gi)) {
  events.push({ idx: m.index, kind: 'create', name: m[1], table: bare(m[2]), body: m[3] })
}
events.sort((a, b) => a.idx - b.idx)

const live = new Map()
for (const e of events) live.set(`${e.table}|${e.name}`, e)

const failures = []
let checked = 0

for (const e of live.values()) {
  if (e.kind !== 'create') continue
  checked++
  // Seules les LECTURES comptent. `validations.org_id` dans le corps
  // d'une policy sur `validations` est une qualification de colonne,
  // parfaitement légitime : c'est la ligne en cours d'évaluation, pas
  // une requête. Ce qui déclenche la boucle, c'est `from` / `join`.
  const self = new RegExp(`\\b(from|join)\\s+(?:public\\.)?${e.table}\\b`, 'i')
  const hit = e.body.match(self)
  if (hit) {
    failures.push(
      `${fileAt(e.idx)} — policy « ${e.name} » sur ${e.table} interroge ${e.table} `
      + `(« ${hit[0]} »). PostgreSQL y appliquera la RLS, donc cette même policy : récursion infinie. `
      + `Déportez la lecture dans une fonction « security definer ».`
    )
  }
}

console.log(`Contrôle des policies — ${files.length} migrations, ${checked} policies en vigueur.`)
if (failures.length) {
  console.error(`\n✗ ${failures.length} policie(s) récursive(s) :\n`)
  for (const f of failures) console.error(`  · ${f}`)
  console.error('')
  process.exit(1)
}
console.log('✓ Aucune policy ne lit sa propre table.')
