// ============================================================
// Garde-fou : une seule liste de droits
// ============================================================
// La règle « qui peut quoi » a existé en cinq exemplaires — les policies
// RLS, les trois tableaux de la page projet, les quatre fonctions de
// lib/permissions.ts, le sélecteur de membres, et la matrice
// d'affichage. Elles ont divergé sans que rien ne le signale : l'écran
// des droits annonçait le dépôt de pièces à tous les rôles alors que le
// SQL l'en excluait, et désignait « validateur » comme seul décideur
// alors que ce rôle ne décidait plus rien.
//
// Ce contrôle rend cette divergence détectable. Il ne remplace pas la
// RLS — elle seule est opposable — il empêche l'interface de reprendre
// une opinion séparée.
//
//   node scripts/check-rbac.mjs
//
// Volontairement sans dépendance : il tourne aujourd'hui, avant même
// qu'un lanceur de tests existe (J2 du plan bêta).

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const ROLES = ['chef_projet', 'referent_mairie', 'resp_financier', 'contributeur', 'validateur', 'auditeur', 'lecteur']

const failures = []
const fail = (check, msg) => failures.push(`${check} — ${msg}`)

// ------------------------------------------------------------
// Lecture de la matrice (analyse textuelle : pas de chargeur TS ici)
// ------------------------------------------------------------
const rbacSrc = readFileSync(join(ROOT, 'lib/rbac.ts'), 'utf8')

const roleArray = (s) => [...s.matchAll(/'([a-z_]+)'/g)].map(m => m[1]).filter(r => ROLES.includes(r))
const namedList = (name) => {
  const m = rbacSrc.match(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`))
  return m ? roleArray(m[1]) : null
}

const ASSIGNABLE = namedList('ASSIGNABLE_ROLES') ?? []
const LEGACY = namedList('LEGACY_ROLES') ?? []
const CONTRIBUTORS = namedList('CONTRIBUTORS') ?? []

// Chaque ligne de RBAC_MATRIX, avec ses rôles résolus. Cantonné au bloc
// de la matrice : `ROLE_COLUMNS` et l'interface portent aussi des `key:`
// et un `roles:`, et une lecture globale les confondait.
const matrixBlock = rbacSrc.slice(rbacSrc.indexOf('export const RBAC_MATRIX'))
const matrix = new Map()
for (const m of matrixBlock.matchAll(/key:\s*'([a-z._]+)'[\s\S]*?roles:\s*(\[[^\]]*\]|[A-Z_]+)/g)) {
  const [, key, rolesExpr] = m
  let roles
  if (rolesExpr === 'ALL') roles = [...ASSIGNABLE, ...LEGACY]
  else if (rolesExpr === 'CONTRIBUTORS') roles = CONTRIBUTORS
  else if (rolesExpr.startsWith('[')) roles = roleArray(rolesExpr)
  else roles = null
  if (roles === null) fail('matrice', `rôles non résolus pour « ${key} » (${rolesExpr})`)
  else matrix.set(key, roles)
}
if (!matrix.size) fail('matrice', 'RBAC_MATRIX illisible — le format a changé, ce contrôle est aveugle')

// ------------------------------------------------------------
// 1. Aucune liste de rôles hors de lib/rbac.ts
// ------------------------------------------------------------
// On ne traque pas la MENTION d'un rôle — poser `role: 'chef_projet'` à
// la création d'un projet est légitime — mais la LISTE, qui est toujours
// une règle de droits recopiée.
const ALLOWED = new Set(['lib/rbac.ts', 'lib/constants.ts', 'lib/types.ts', 'lib/help-content.ts'])
const R = ROLES.join('|')
const PATTERNS = [
  // ['chef_projet', 'resp_financier', …]
  new RegExp(`\\[[^\\]]*['"](?:${R})['"][^\\]]*['"](?:${R})['"][^\\]]*\\]`),
  // role === 'a' || role === 'b'
  new RegExp(`['"](?:${R})['"][\\s\\S]{0,80}?(?:\\|\\||&&)[\\s\\S]{0,80}?['"](?:${R})['"]`),
]

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  if (e.name === 'node_modules' || e.name.startsWith('.')) return []
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return /\.tsx?$/.test(e.name) ? [p] : []
})

for (const dir of ['app', 'lib', 'components']) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file)
    if (ALLOWED.has(rel)) continue
    const src = readFileSync(file, 'utf8')
    for (const re of PATTERNS) {
      const hit = src.match(re)
      if (hit) {
        fail('liste recopiée', `${rel} énumère des rôles : ${hit[0].replace(/\s+/g, ' ').slice(0, 90)}…\n     → utilisez can(role, capacité) de lib/rbac.ts`)
        break
      }
    }
  }
}

// ------------------------------------------------------------
// 2. Les rôles connus couvrent l'enum PostgreSQL
// ------------------------------------------------------------
const sqlDir = join(ROOT, 'supabase/migrations')
const sqlAll = readdirSync(sqlDir).sort()
  .map(f => readFileSync(join(sqlDir, f), 'utf8')).join('\n')

const enumDecl = sqlAll.match(/create type project_member_role as enum \(([^)]*)\)/)
const enumValues = enumDecl ? roleArray(enumDecl[1]) : []
for (const v of [...sqlAll.matchAll(/alter type project_member_role add value(?: if not exists)? '([a-z_]+)'/g)]) {
  enumValues.push(v[1])
}
const known = new Set([...ASSIGNABLE, ...LEGACY])
for (const v of enumValues) {
  if (!known.has(v)) fail('enum', `« ${v} » existe en base mais n'est ni attribuable ni hérité dans lib/rbac.ts`)
}

// ------------------------------------------------------------
// 3. Aucun rôle à la fois attribuable et retiré
// ------------------------------------------------------------
for (const r of ASSIGNABLE) {
  if (LEGACY.includes(r)) fail('rôles', `« ${r} » est à la fois attribuable et retiré`)
}

// ------------------------------------------------------------
// 4. Matrice == SQL, pour les règles qui énumèrent des rôles
// ------------------------------------------------------------
// Le SQL fait foi ; la matrice doit le refléter exactement. On prend la
// DERNIÈRE définition rencontrée : une policy est réécrite de migration
// en migration, et seule la dernière s'applique — lire la première
// donnerait un contrôle qui valide une règle morte.
const lastMatch = (re) => {
  let last = null
  for (const m of sqlAll.matchAll(new RegExp(re, 'g'))) last = m
  return last
}

// `[^;]*?` et non `[\s\S]*?` : borner au statement en cours. Une
// recherche gloutonne traverse la fin d'une policy et attrape la liste
// de rôles de la SUIVANTE — elle validait ainsi can_upload_document()
// contre les rôles d'une policy de validation sans aucun rapport.
// L'ancrage sur `create ...` évite aussi de partir d'un simple APPEL de
// la fonction, dont il existe plusieurs.
const SQL_CHECKS = [
  { capability: 'documents.upload', source: 'can_upload_document()', re: 'create or replace function public\\.can_upload_document[^;]*?pm\\.role in \\(([^)]*)\\)' },
  { capability: 'mesures.add', source: '"Add measure"', re: 'create policy "Add measure"[^;]*?pm\\.role in \\(([^)]*)\\)' },
  { capability: 'rapports.generate', source: '"Create ai reports"', re: 'create policy "Create ai reports"[^;]*?pm\\.role in \\(([^)]*)\\)' },
]

for (const { capability, source, re } of SQL_CHECKS) {
  const found = lastMatch(re)
  if (!found) {
    fail(capability, `${source} introuvable dans les migrations — contrôle aveugle`)
    continue
  }
  const sqlRoles = new Set(roleArray(found[1]))
  const uiRoles = new Set(matrix.get(capability) ?? [])
  const missing = [...sqlRoles].filter(r => !uiRoles.has(r))
  const extra = [...uiRoles].filter(r => !sqlRoles.has(r))
  if (missing.length || extra.length) {
    fail(capability, `matrice ≠ ${source}. En trop dans la matrice : ${extra.join(', ') || '—'} ; manquants : ${missing.join(', ') || '—'}`)
  }
}

// ------------------------------------------------------------
// 5. L'auditeur ne peut rien modifier
// ------------------------------------------------------------
// La définition même du rôle, arbitrée le 26/07 : consulter pour
// contrôler, sans jamais toucher à ce qu'on contrôle. Un auditeur qui
// peut modifier n'est plus un auditeur. Tout le reste peut évoluer, pas
// cela.
const READ_ONLY = ['projets.view', 'budget.view', 'audit.view']
for (const [key, roles] of matrix) {
  if (roles.includes('auditeur') && !READ_ONLY.includes(key)) {
    fail('auditeur', `« ${key} » est accordé à l'auditeur, qui ne doit rien pouvoir modifier`)
  }
}

// ------------------------------------------------------------
console.log(`Contrôle RBAC — ${matrix.size} capacités, ${ASSIGNABLE.length} rôles attribuables, ${LEGACY.length} retirés.`)
if (failures.length) {
  console.error(`\n✗ ${failures.length} problème(s) :\n`)
  for (const f of failures) console.error(`  · ${f}`)
  process.exit(1)
}
console.log('✓ Une seule liste de droits, et elle concorde avec le SQL.')
