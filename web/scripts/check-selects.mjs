// ============================================================
// Garde-fou : toute colonne demandée existe vraiment
// ============================================================
// La 0033 a supprimé `phases.budget`. La page projet, qui sélectionne
// `*`, n'a rien vu. Le rapport d'expert IA, lui, nommait la colonne : sa
// requête a échoué, `data` est revenu nul, et le rapport s'est généré
// quand même — « Périmètre analysé : 0 phase(s) », sans la moindre
// erreur à l'écran. Une pièce fausse mais plausible, destinée à un
// financeur. Le défaut a vécu une journée entière.
//
// Postgres ne prévient pas à la compilation, et TypeScript ne connaît
// pas le schéma. Ce contrôle fait le rapprochement : il reconstruit les
// tables depuis les migrations, puis relit chaque `.select()` explicite
// du code.
//
//   node scripts/check-selects.mjs
//
// Sans dépendance, comme check-rbac.mjs.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const failures = []
const fail = (where, msg) => failures.push(`${where} — ${msg}`)

// ------------------------------------------------------------
// 1. Reconstruire le schéma depuis les migrations
// ------------------------------------------------------------
// Rejouées dans l'ordre, comme le ferait Postgres : une colonne ajoutée
// puis supprimée doit finir absente.
const sqlDir = join(ROOT, 'supabase/migrations')
const tables = new Map() // nom -> Set(colonnes)

for (const file of readdirSync(sqlDir).sort()) {
  const sql = readFileSync(join(sqlDir, file), 'utf8')
    .replace(/--[^\n]*/g, '')          // commentaires
    .replace(/\$\$[\s\S]*?\$\$/g, '')  // corps de fonctions : pas du DDL

  for (const m of sql.matchAll(/create table (?:if not exists )?(\w+)\s*\(([\s\S]*?)\n\)\s*;/g)) {
    const [, table, body] = m
    const cols = new Set()
    // Une définition de colonne commence en début de ligne ; les
    // contraintes de table (primary key, unique, check…) n'en sont pas.
    for (const line of body.split('\n')) {
      const c = line.trim().match(/^(\w+)\s+/)
      if (!c) continue
      if (/^(primary|unique|foreign|check|constraint|exclude)$/i.test(c[1])) continue
      cols.add(c[1])
    }
    tables.set(table, cols)
  }

  for (const m of sql.matchAll(/alter table (?:only )?(\w+)([\s\S]*?);/g)) {
    const [, table, body] = m
    const cols = tables.get(table)
    if (!cols) continue
    for (const a of body.matchAll(/add column (?:if not exists )?(\w+)/g)) cols.add(a[1])
    for (const d of body.matchAll(/drop column (?:if exists )?(\w+)/g)) cols.delete(d[1])
    for (const r of body.matchAll(/rename column (\w+) to (\w+)/g)) { cols.delete(r[1]); cols.add(r[2]) }
  }
}

if (tables.size < 10) {
  fail('schéma', `seulement ${tables.size} tables reconstruites — l'analyse des migrations a échoué, ce contrôle serait aveugle`)
}

// ------------------------------------------------------------
// 2. Relire les select() du code
// ------------------------------------------------------------
// Supabase accepte : "id, nom", "*", des relations imbriquées
// « table(...) », et des alias « alias:colonne_fk(...) ».
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  if (e.name === 'node_modules' || e.name.startsWith('.')) return []
  const p = join(dir, e.name)
  if (e.isDirectory()) return walk(p)
  return /\.tsx?$/.test(e.name) ? [p] : []
})

// Découpe au premier niveau : les virgules entre parenthèses
// appartiennent à une relation imbriquée, pas à la liste courante.
function topLevelParts(sel) {
  const parts = []
  let depth = 0, cur = ''
  for (const ch of sel) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map(p => p.trim()).filter(Boolean)
}

function checkSelect(table, sel, where) {
  const cols = tables.get(table)
  if (!cols) return // table inconnue (vue, table système) : on ne juge pas
  for (const part of topLevelParts(sel)) {
    if (part === '*' || part.startsWith('...')) continue

    const nested = part.match(/^([\w]+)(?::([\w!]+))?\s*\(([\s\S]*)\)$/)
    if (nested) {
      const [, name, fk, inner] = nested
      // « alias:colonne_fk(...) » — la colonne de jointure doit exister.
      if (fk) {
        const fkCol = fk.replace(/!.*/, '')
        if (!cols.has(fkCol) && !tables.has(fkCol)) {
          fail(where, `${table}.${fkCol} n'existe pas (jointure « ${part.slice(0, 40)}… »)`)
        }
      }
      // La relation porte le nom d'une table connue : on descend.
      const child = tables.has(name) ? name : null
      if (child) checkSelect(child, inner, where)
      continue
    }

    const col = part.split(/[\s:]/)[0].replace(/!.*|::.*/g, '').trim()
    if (!col || col === 'count') continue
    if (!cols.has(col)) {
      fail(where, `${table}.${col} n'existe pas — colonne supprimée ou faute de frappe`)
    }
  }
}

let selects = 0
for (const dir of ['app', 'lib', 'components']) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, 'utf8')
    const rel = relative(ROOT, file)
    // .from('table') ... .select('colonnes') — le chaînage peut être
    // coupé par des sauts de ligne, d'où le [\s\S]{0,40}.
    for (const m of src.matchAll(/\.from\(['"](\w+)['"]\)[\s\S]{0,40}?\.select\(\s*(['"`])([\s\S]*?)\2/g)) {
      const [, table, , sel] = m
      if (sel.includes('${')) continue // liste construite dynamiquement
      selects++
      const line = src.slice(0, m.index).split('\n').length
      checkSelect(table, sel, `${rel}:${line}`)
    }
  }
}

// ------------------------------------------------------------
console.log(`Contrôle des select — ${tables.size} tables reconstruites, ${selects} requêtes relues.`)
if (failures.length) {
  console.error(`\n✗ ${failures.length} problème(s) :\n`)
  for (const f of failures) console.error(`  · ${f}`)
  console.error('\n  Une colonne absente ne casse pas la compilation : la requête échoue')
  console.error('  à l\'exécution, `data` revient nul, et l\'écran affiche du vide sans erreur.')
  process.exit(1)
}
console.log('✓ Toutes les colonnes demandées existent au schéma.')
