// ============================================================
// Garde-fou : le digest envoyé à l'IA ne demande aucune personne
// ============================================================
// `generateExpertReport` rassemble le projet entier — phases, tâches,
// budget, indicateurs, réunions, décisions — et envoie le tout à un
// fournisseur d'IA choisi dans Admin ▸ Configuration. Selon le choix,
// ce tout quitte l'Union européenne : les États-Unis sous couvert de la
// décision d'adéquation, la Chine sans aucune décision d'adéquation
// (cf. `zone` et `transfert` dans `lib/ai-settings.ts`, repris mot pour
// mot sur la page publique /confidentialite).
//
// Ce que cette page promet aux personnes concernées, une seule ligne de
// requête peut le démentir. La preuve existait déjà dans le code : la
// requête sur `phases` demandait `tasks(… , assignee_id)` — l'identifiant
// du profil de la personne à qui la tâche est confiée — alors que le
// `.map()` qui construit le digest, vingt lignes plus bas, ne l'a jamais
// lu. Personne ne l'avait voulu, personne ne l'avait vu : une colonne
// s'ajoute à une liste séparée par des virgules sans que TypeScript, le
// build ou la revue n'aient de raison de s'y arrêter. Et le jour où
// quelqu'un aurait écrit `responsable: t.assignee_id`, le nom serait
// parti chez le fournisseur sans que la page de confidentialité change
// d'un mot.
//
//   node scripts/check-anonymat-digest.mjs
//
// CE QU'IL FAIT. Il reconstruit depuis les migrations la liste des
// colonnes qui DÉSIGNENT UNE PERSONNE PHYSIQUE — celles qui référencent
// `profiles` ou `auth.users` (`assignee_id`, `created_by`,
// `uploaded_by`, `owner_user_id`…), toutes celles de `profiles`, et
// quelques noms sans ambiguïté (`email`, `full_name`, `avatar_url`,
// `attendees`). Puis il relit les `.select()` du corps de la fonction
// visée et échoue si l'une d'elles en demande une. Un `select('*')` sur
// une table qui porte une telle colonne échoue aussi : `tasks(*)`
// ramène `assignee_id` sans jamais l'écrire.
//
// CE QU'IL NE FAIT PAS, et il vaut mieux le dire que le laisser croire :
//
//   · il ne lit PAS le texte libre. Descriptions, titres de tâches,
//     comptes rendus de réunion, décisions, consignes de génération
//     partent tels quels et peuvent nommer qui leurs auteurs veulent.
//     C'est un arbitrage assumé — expliqué au-dessus du digest — et non
//     quelque chose qu'un script pourrait rattraper : aucune détection
//     de nom propre français n'est assez fiable pour censurer une pièce
//     destinée à un financeur ;
//
//   · il ne couvre PAS `comm-actions.ts`, l'autre appelant du modèle, et
//     c'est délibéré. Sa requête demande `responsible_id` — une colonne
//     de personne — pour vérifier un droit et envoyer une notification,
//     jamais pour la mettre dans l'invite. L'y inclure ferait échouer la
//     vérification sur un usage parfaitement légitime, et un garde-fou
//     qui crie pour rien s'apprend très vite à ignorer. Distinguer les
//     deux demanderait de suivre chaque champ jusqu'à l'invite : ce
//     n'est pas à la portée d'une lecture par expressions régulières.
//
// Le périmètre est donc étroit et NOMMÉ ci-dessous. S'il devenait faux
// — fonction renommée, fichier déplacé —, le contrôle échoue au lieu de
// passer au vert sur du vide : c'est la seule façon qu'il a de rester
// vrai. Sans dépendance, comme check-selects.mjs, dont il reprend la
// reconstruction du schéma et le découpage des `select`.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

// Ce qui part chez le fournisseur d'IA. Une entrée = un fichier et la
// fonction dont TOUTE la collecte alimente une invite.
const TARGETS = [
  { file: 'app/(app)/projets/[id]/report-actions.ts', fn: 'generateExpertReport' },
]

// Colonnes personnelles quelle que soit la table : elles ne peuvent pas
// désigner autre chose qu'une personne physique.
const PERSONAL_NAMES = /^(email|full_name|avatar_url|attendees)$/

// Deux natures d'échec, qui n'appellent pas le même geste : « colonne »
// = une donnée personnelle est demandée, il faut la retirer ;
// « perimetre » = le contrôle ne sait plus quoi lire, il faut le
// réaccorder au code. Les mélanger dans un seul message conclurait
// « retirez la colonne » à quelqu'un qui vient de renommer une fonction.
const failures = []
const fail = (where, msg, kind = 'colonne') => failures.push({ where, msg, kind })

// ------------------------------------------------------------
// 1. Reconstruire, depuis les migrations, ce qui désigne une personne
// ------------------------------------------------------------
// Rejouées dans l'ordre : une colonne ajoutée puis supprimée doit finir
// absente, sans quoi le contrôle accuserait une requête à tort.
const sqlDir = join(ROOT, 'supabase/migrations')
const columns = new Map() // table -> Set(colonnes)
const personal = new Map() // table -> Set(colonnes de personne)

const add = (map, table, col) => {
  if (!map.has(table)) map.set(table, new Set())
  map.get(table).add(col)
}
const drop = (map, table, col) => map.get(table)?.delete(col)

// Une définition de colonne désigne une personne si elle pointe vers la
// table des profils — c'est-à-dire vers `auth.users`, l'identité.
const pointsToPerson = (definition) => /references\s+(?:public\.)?profiles\s*\(|references\s+auth\.users\s*\(/i.test(definition)

for (const file of readdirSync(sqlDir).sort()) {
  const sql = readFileSync(join(sqlDir, file), 'utf8')
    .replace(/--[^\n]*/g, '')          // commentaires
    .replace(/\$\$[\s\S]*?\$\$/g, '')  // corps de fonctions : pas du DDL

  for (const m of sql.matchAll(/create table (?:if not exists )?(\w+)\s*\(([\s\S]*?)\n\)\s*;/g)) {
    const [, table, body] = m
    columns.set(table, new Set())
    personal.set(table, new Set())
    for (const line of body.split('\n')) {
      const c = line.trim().match(/^(\w+)\s+/)
      if (!c) continue
      if (/^(primary|unique|foreign|check|constraint|exclude)$/i.test(c[1])) continue
      add(columns, table, c[1])
      // `profiles` EN ENTIER : email, nom, photo, et jusqu'à son `id`,
      // qui est celui du compte. Aucune de ses colonnes n'a sa place
      // dans une invite.
      if (table === 'profiles' || PERSONAL_NAMES.test(c[1]) || pointsToPerson(line)) add(personal, table, c[1])
    }
  }

  for (const m of sql.matchAll(/alter table (?:only )?(\w+)([\s\S]*?);/g)) {
    const [, table, body] = m
    if (!columns.has(table)) continue
    for (const a of body.matchAll(/add column (?:if not exists )?(\w+)([^,;]*)/g)) {
      add(columns, table, a[1])
      if (table === 'profiles' || PERSONAL_NAMES.test(a[1]) || pointsToPerson(a[2])) add(personal, table, a[1])
    }
    for (const d of body.matchAll(/drop column (?:if exists )?(\w+)/g)) { drop(columns, table, d[1]); drop(personal, table, d[1]) }
    for (const r of body.matchAll(/rename column (\w+) to (\w+)/g)) {
      const wasPersonal = personal.get(table)?.has(r[1])
      drop(columns, table, r[1]); drop(personal, table, r[1])
      add(columns, table, r[2])
      if (wasPersonal || PERSONAL_NAMES.test(r[2])) add(personal, table, r[2])
    }
  }
}

// Aveuglement n° 1 : sans colonnes de personne reconstruites, le
// contrôle passerait au vert sur n'importe quelle requête.
const personalCount = [...personal.values()].reduce((n, s) => n + s.size, 0)
if (personalCount < 10) {
  fail('schéma', `seulement ${personalCount} colonne(s) de personne reconstruite(s) depuis ${sqlDir} — l'analyse des migrations a échoué, ce contrôle serait aveugle`, 'perimetre')
}

// ------------------------------------------------------------
// 2. Isoler le corps de la fonction visée
// ------------------------------------------------------------
// Rendre le reste du fichier si l'équilibre n'est jamais atteint : plus
// de texte relu, donc plus de sévérité, jamais moins.
function balanced(src, open, [o, c]) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === o) depth++
    else if (src[i] === c) { depth--; if (!depth) return { text: src.slice(open + 1, i), end: i } }
  }
  return { text: src.slice(open + 1), end: src.length }
}

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

// ------------------------------------------------------------
// 3. Relire les select()
// ------------------------------------------------------------
let inspected = 0

function checkSelect(table, sel, where) {
  const cols = personal.get(table)
  if (!cols) return // table inconnue (vue, table système) : on ne juge pas
  for (const part of topLevelParts(sel)) {
    if (part.startsWith('...')) continue

    // `*` sur une table qui porte une colonne de personne : la colonne
    // part sans que personne ne l'ait écrite. C'est la forme la plus
    // discrète du défaut, et elle existe ailleurs dans le dépôt
    // (`phases.select("*, tasks(*, …)")` sur l'écran projet, où le nom
    // du responsable S'AFFICHE et doit s'afficher).
    if (part === '*') {
      if (cols.size) fail(where, `select('*') sur « ${table} » : ramène ${[...cols].join(', ')}`)
      continue
    }

    const nested = part.match(/^([\w]+)(?::([\w!]+))?\s*\(([\s\S]*)\)$/)
    if (nested) {
      const [, name, fk, inner] = nested
      // « alias:colonne_fk(...) » : la colonne de jointure elle-même est
      // une donnée — `author:created_by(full_name)` demande bel et bien
      // `created_by`.
      if (fk) {
        const fkCol = fk.replace(/!.*/, '')
        if (cols.has(fkCol)) fail(where, `${table}.${fkCol} désigne une personne (jointure « ${part.slice(0, 48)}… »)`)
      }
      // La relation porte le nom d'une table connue : on descend.
      if (personal.has(name)) checkSelect(name, inner, where)
      continue
    }

    const col = part.split(/[\s:]/)[0].replace(/!.*|::.*/g, '').trim()
    if (!col || col === 'count') continue
    if (cols.has(col)) fail(where, `${table}.${col} désigne une personne`)
  }
}

for (const target of TARGETS) {
  const src = readFileSync(join(ROOT, target.file), 'utf8')
  const decl = src.match(new RegExp(`function\\s+${target.fn}\\s*\\(`))
  // Aveuglement n° 2 : fonction renommée ou déplacée. Échouer, plutôt
  // que de relire zéro ligne en annonçant que tout va bien.
  if (!decl) {
    fail(target.file, `fonction « ${target.fn} » introuvable — renommée ou déplacée ? Ce contrôle ne relit plus rien : mettez à jour TARGETS dans ce script`, 'perimetre')
    continue
  }
  const params = balanced(src, decl.index + decl[0].length - 1, ['(', ')'])
  const braceAt = src.indexOf('{', params.end)
  if (braceAt === -1) { fail(target.file, `corps de « ${target.fn} » illisible`, 'perimetre'); continue }
  const bodyStart = braceAt
  const body = balanced(src, bodyStart, ['{', '}']).text

  let found = 0
  // .from('table') … .select('colonnes') — le chaînage peut être coupé
  // par des sauts de ligne, d'où le [\s\S]{0,40}.
  for (const m of body.matchAll(/\.from\(['"](\w+)['"]\)[\s\S]{0,40}?\.select\(\s*(['"`])([\s\S]*?)\2/g)) {
    const [, table, , sel] = m
    if (sel.includes('${')) continue // liste construite dynamiquement
    found++
    inspected++
    const line = src.slice(0, bodyStart + m.index).split('\n').length
    checkSelect(table, sel, `${target.file}:${line}`)
  }
  // Aveuglement n° 3 : la collecte a changé de forme (client typé,
  // fonction extraite…) et les motifs ne l'attrapent plus.
  if (!found) {
    fail(target.file, `aucune requête reconnue dans « ${target.fn} » — la collecte a changé de forme, adaptez ce script`, 'perimetre')
  }
}

// ------------------------------------------------------------
console.log(`Contrôle de l'anonymat du digest IA — ${personalCount} colonnes de personne au schéma, ${inspected} requête(s) relue(s).`)

const leaks = failures.filter(f => f.kind === 'colonne')
const blind = failures.filter(f => f.kind === 'perimetre')

if (blind.length) {
  console.error(`\n✗ ${blind.length} point(s) sur lesquels ce contrôle est devenu aveugle :\n`)
  for (const f of blind) console.error(`  · ${f.where} — ${f.msg}`)
  console.error('')
  console.error("  Un garde-fou qui ne lit plus rien passe au vert quoi qu'il arrive : il")
  console.error("  vaut alors moins que pas de garde-fou du tout, puisqu'on s'y fie.")
  console.error('  Réaccordez le périmètre au code avant de continuer.\n')
}

if (leaks.length) {
  console.error(`\n✗ ${leaks.length} donnée(s) personnelle(s) demandée(s) par une requête dont la sortie part chez le fournisseur d'IA :\n`)
  for (const f of leaks) console.error(`  · ${f.where} — ${f.msg}`)
  console.error('')
  console.error('  Ce digest quitte la plateforme, et selon le fournisseur configuré il')
  console.error("  quitte l'Union européenne. La page /confidentialite affirme aux")
  console.error("  personnes concernées qu'aucun champ les identifiant n'est transmis :")
  console.error('  cette phrase ne tient que tant que cette liste est vide.')
  console.error('')
  console.error("  Retirez la colonne du select. Si le rapport en a réellement besoin,")
  console.error("  c'est une décision à prendre — et la page de confidentialité doit")
  console.error('  alors le dire, avant que le code ne le fasse.\n')
}

if (failures.length) process.exit(1)
console.log("✓ Aucune requête du digest IA ne demande de champ identifiant une personne.")
