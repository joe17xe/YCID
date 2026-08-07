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
// CE QU'IL A LAISSÉ PASSER, et ce qui a changé. Il ne comparait que
// TROIS capacités au SQL. `referent_mairie` en recevait huit dans la
// matrice sans figurer dans une seule des policies correspondantes : le
// contrôle restait au vert parce qu'il ne regardait pas de ce côté — et
// que rien ne l'obligeait à regarder partout. Les écritures promises à
// ce rôle étaient refusées par la RLS, la moitié d'entre elles en
// silence (un `update` écarté touche zéro ligne et répond « succès »).
// La 0062 aligne le SQL ; les contrôles 5 et 6 ci-dessous ferment le
// silence qui l'avait rendu possible :
//
//   5. toute capacité qui accorde un rôle doit DÉCLARER sa règle SQL ;
//   6. toute policy qui énumère des rôles doit être PORTÉE par une
//      capacité — ou son absence de la matrice doit être motivée.
//
// Autrement dit, on ne vérifie plus seulement que les listes connues
// concordent : on vérifie qu'aucune règle de droits n'échappe à la
// comparaison.
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

// `[^;]*` et non `[\s\S]*` : borner au statement en cours. Une recherche
// gloutonne traverse la fin d'une policy et attrape la liste de rôles de
// la SUIVANTE — elle validait ainsi can_upload_document() contre les
// rôles d'une policy de validation sans aucun rapport. L'ancrage sur
// `create ...` évite aussi de partir d'un `drop policy if exists`, ou
// d'un simple APPEL de la fonction, dont il existe plusieurs.
//
// On lit TOUTES les listes de rôles du statement, pas la première. Une
// policy porte souvent `using` ET `with check` : si les deux divergent,
// on autorise à lire ce qu'on refuse d'écrire (ou l'inverse), et un
// contrôle qui s'arrête à la première ne verrait rien. C'est la leçon de
// la 0045, où le `with check` manquait purement et simplement.
const statementRe = (rule) => rule.fn
  ? `create\\s+or\\s+replace\\s+function\\s+public\\.${rule.fn}[^;]*`
  : `create\\s+policy\\s+"${rule.policy}"\\s+on\\s+(?:public\\.)?${rule.table}\\b[^;]*`

const roleLists = (body) =>
  [...body.matchAll(/role\s+in\s*\(([^)]*)\)|array\s*\[([^\]]*)\]/gi)]
    .map(m => roleArray(m[1] ?? m[2]))
    .filter(l => l.length)

// La règle SQL opposable pour chaque capacité qui accorde des rôles.
// Cette table ne comptait que TROIS lignes, et c'est précisément ce qui
// a laissé passer l'écart de la 0062 : `referent_mairie` recevait sept
// capacités dans la matrice sans figurer dans aucune policy
// correspondante, et le contrôle restait au vert parce qu'il ne
// regardait pas de ce côté. Le contrôle 5 ci-dessous interdit désormais
// qu'une capacité échappe à cette table sans le dire.
const SQL_RULES = [
  { capability: 'projets.update', policy: 'Chef modify project', table: 'projects' },
  // `projets.update` écrit DEUX tables : changer l'organisation porteuse
  // de la fiche doit faire suivre le rôle « porteur » du rattachement,
  // sans quoi l'écran et le circuit de validation désignent deux
  // organisations différentes (0062).
  { capability: 'projets.update', policy: 'Manage project orgs', table: 'project_organizations' },
  { capability: 'phases.manage', policy: 'Chef manage phases', table: 'phases' },
  { capability: 'membres.manage', policy: 'Manage project members', table: 'project_members' },
  // Une policy sur `project_members` ne peut pas interroger sa propre
  // table (récursion, cf. check-policies) : la liste passe par
  // `has_project_role(..., array[...])`, et reste donc lisible ICI.
  { capability: 'taches.manage', policy: 'Contributeur insert tasks', table: 'tasks' },
  { capability: 'taches.manage', policy: 'Contributeur update open tasks', table: 'tasks' },
  { capability: 'taches.manage', policy: 'Contributeur delete open tasks', table: 'tasks' },
  { capability: 'budget.manage', policy: 'Manage budget lines', table: 'budget_lines' },
  { capability: 'budget.manage', policy: 'Manage budget line tasks', table: 'budget_line_tasks' },
  { capability: 'indicateurs.manage', policy: 'Manage indicators', table: 'indicators' },
  { capability: 'copil.manage', policy: 'Chef manage meetings', table: 'meetings' },
  { capability: 'decisions.manage', policy: 'Manage decisions', table: 'decisions' },
  { capability: 'documents.upload', fn: 'can_upload_document' },
  { capability: 'mesures.add', policy: 'Add measure', table: 'indicator_measures' },
  { capability: 'rapports.generate', policy: 'Create ai reports', table: 'ai_reports' },
]

for (const rule of SQL_RULES) {
  const source = rule.fn ? `${rule.fn}()` : `« ${rule.policy} » (${rule.table})`
  const found = lastMatch(statementRe(rule))
  if (!found) {
    fail(rule.capability, `${source} introuvable dans les migrations — contrôle aveugle`)
    continue
  }
  const lists = roleLists(found[0])
  if (!lists.length) {
    fail(rule.capability, `${source} n'énumère aucun rôle connu — la règle a changé de forme, ce contrôle est aveugle`)
    continue
  }
  // `using` et `with check` doivent dire la même chose.
  const first = lists[0].slice().sort().join(',')
  const divergent = lists.find(l => l.slice().sort().join(',') !== first)
  if (divergent) {
    fail(rule.capability, `${source} : « using » et « with check » n'accordent pas les mêmes rôles (${first} ≠ ${divergent.slice().sort().join(',')})`)
    continue
  }
  const sqlRoles = new Set(lists[0])
  const uiRoles = new Set(matrix.get(rule.capability) ?? [])
  const missing = [...sqlRoles].filter(r => !uiRoles.has(r))
  const extra = [...uiRoles].filter(r => !sqlRoles.has(r))
  if (missing.length || extra.length) {
    fail(rule.capability, `matrice ≠ ${source}. En trop dans la matrice : ${extra.join(', ') || '—'} ; manquants : ${missing.join(', ') || '—'}`)
  }
}

// ------------------------------------------------------------
// 5. Toute capacité qui accorde des rôles a sa règle SQL déclarée
// ------------------------------------------------------------
// LE CONTRÔLE QUI MANQUAIT. L'écart de la 0062 n'était pas une
// contradiction entre deux listes — le contrôle 4 l'aurait vue — mais un
// SILENCE : sept capacités de la matrice ne pointaient vers aucune règle
// SQL, donc personne ne les comparait à rien. Un garde-fou qui ne vérifie
// que ce qu'on a pensé à lui donner à vérifier reste au vert pendant que
// l'écran promet des pouvoirs que la base refuse.
//
// Désormais : accorder une capacité à un rôle projet oblige à dire OÙ
// cette capacité est opposable. Les deux seules réponses acceptables
// sont « voici la policy » (SQL_RULES) et « elle suit l'appartenance au
// projet, il n'y a aucun rôle à comparer » (ci-dessous, nommément).
const MEMBERSHIP_ONLY = new Map([
  ['projets.view', 'is_project_member() — appartenance, aucun rôle énuméré'],
  ['budget.view', '« See budget lines » (0001) — is_project_member()'],
  ['audit.view', '« See audit » (0001) — is_project_member()'],
])
const covered = new Set(SQL_RULES.map(r => r.capability))
for (const [key, roles] of matrix) {
  if (!roles.length) continue
  if (covered.has(key) || MEMBERSHIP_ONLY.has(key)) continue
  fail('couverture', `« ${key} » accorde ${roles.join(', ')} sans règle SQL déclarée.\n     → ajoutez-la à SQL_RULES, ou à MEMBERSHIP_ONLY si aucun rôle n'est énuméré en base`)
}

// ------------------------------------------------------------
// 6. Aucune policy n'énumère des rôles sans capacité qui la porte
// ------------------------------------------------------------
// La réciproque du contrôle 5, et l'autre moitié du silence : une policy
// peut accorder à des rôles projet un pouvoir dont la matrice ne parle
// pas du tout. L'écran ne ment pas, il se TAIT — ce qui est moins
// spectaculaire et tout aussi faux, puisque « Accès & rôles » est censé
// dire ce que chacun peut faire.
//
// On ne lit que la DERNIÈRE définition de chaque policy : elle est
// réécrite de migration en migration, et juger la première signalerait
// éternellement une règle morte. Même mécanique que check-policies.
const events = []
for (const m of sqlAll.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?"([^"]+)"\s+on\s+([a-z_.]+)/gi)) {
  events.push({ idx: m.index, kind: 'drop', name: m[1], table: m[2].replace(/^public\./i, '') })
}
for (const m of sqlAll.matchAll(/create\s+policy\s+"([^"]+)"\s+on\s+([a-z_.]+)([^;]*)/gi)) {
  events.push({ idx: m.index, kind: 'create', name: m[1], table: m[2].replace(/^public\./i, ''), body: m[3] })
}
events.sort((a, b) => a.idx - b.idx)
const livePolicies = new Map()
for (const e of events) livePolicies.set(`${e.table}|${e.name}`, e)

// Règles SQL qui énumèrent des rôles projet SANS entrée dans la matrice.
// Ce n'est pas une divergence — c'est un TROU, et l'exemption le nomme
// plutôt que de le laisser invisible. Combler ces trois-là demande un
// arbitrage produit (quelle capacité, pour qui), pas une transcription :
// on ne l'invente pas dans un garde-fou.
const HORS_MATRICE = new Map([
  ['budget_categories|Manage budget categories',
   'Référentiel des catégories budgétaires (0006) — la matrice ne décrit aucune capacité de paramétrage de projet'],
  ['documents|Delete documents',
   'Supprimer une pièce NON décidée (0059) — la matrice décrit le dépôt, pas la suppression'],
  ['validations|Delete validation',
   'Supprimer une validation non décidée (0059) — même trou que ci-dessus, et même arbitrage à rendre'],
  // Les deux suivantes ne sont pas de notre fait : elles arrivent des 53
  // commits que `master` a pris pendant ce lot, et ce contrôle — écrit
  // ici même — les découvre au premier passage. C'est exactement son
  // office, et c'est la preuve qu'il regarde ailleurs que dans nos
  // propres ajouts.
  //
  // Elles sont déclarées ici, PAS rattachées à une capacité inventée :
  // décider quelle capacité porte « qui rattache une ville à un projet »
  // ou « qui invite à une réunion » est un arbitrage produit, et un
  // garde-fou qui invente la réponse qu'il est censé vérifier ne vérifie
  // plus rien. À rendre par YCID, puis à déplacer dans SQL_RULES.
  ['project_cities|Editors manage project cities',
   'Villes rattachées à un projet (0050, amont) — aucune capacité ne décrit ce geste ; arbitrage produit en attente'],
  ['meeting_participants|Editors manage meeting participants',
   'Invités d’une réunion (0051, amont) — `copil.manage` couvre la réunion, pas la liste des invités ; arbitrage produit en attente'],
])
const claimed = new Set(SQL_RULES.filter(r => r.policy).map(r => `${r.table}|${r.policy}`))
for (const [key, e] of livePolicies) {
  if (e.kind !== 'create') continue
  if (!roleLists(e.body).length) continue
  if (claimed.has(key) || HORS_MATRICE.has(key)) continue
  fail('couverture', `la policy « ${e.name} » (${e.table}) accorde des rôles projet qu'aucune capacité ne porte.\n     → rattachez-la à une capacité de RBAC_MATRIX via SQL_RULES, ou déclarez-la dans HORS_MATRICE avec son motif`)
}

// ------------------------------------------------------------
// 7. L'auditeur ne peut rien modifier
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
// 8. Le siège d'auditeur ne s'accorde par aucun rôle projet
// ------------------------------------------------------------
// Arbitrage du 27/07 : le contrôlé ne choisit pas son contrôleur. La
// règle vit en RLS (0047) sous forme de policies RESTRICTIVES — une
// policy ordinaire s'ajoute par OU et n'aurait rien restreint. Une
// seule des trois qui redeviendrait permissive annulerait la règle en
// silence, en ouvrant une voie au lieu d'en fermer une.
const auditorSeat = matrix.get('membres.manage_auditeur')
if (auditorSeat === undefined) {
  fail('auditeur', '« membres.manage_auditeur » absent de la matrice — contrôle aveugle')
} else if (auditorSeat.length) {
  fail('auditeur', `« membres.manage_auditeur » accordé à ${auditorSeat.join(', ')} : aucun rôle projet ne doit l'ouvrir`)
}
for (const cmd of ['insert', 'update', 'delete']) {
  const re = new RegExp(`create policy "[^"]*"\\s+on project_members\\s+as restrictive for ${cmd}[^;]*auditeur`, 'i')
  if (!re.test(sqlAll)) {
    fail('auditeur', `aucune policy RESTRICTIVE sur project_members pour ${cmd.toUpperCase()} : le siège d'auditeur n'est pas protégé en base`)
  }
}

// ------------------------------------------------------------
// 9. Les capacités COCHÉES SUR LE PROFIL tiennent leurs quatre promesses
// ------------------------------------------------------------
// Troisième forme de droit du produit, à côté du rôle projet et du rôle
// plateforme : une case sur `profiles`. `can_manage_roadmap` (0037) puis
// `can_manage_users` (0065). Elles n'apparaissent dans AUCUNE colonne de
// la matrice — elles ne s'accordent par aucun rôle — et jusqu'ici aucun
// contrôle ne les regardait. Ce silence a coûté cher, et pas en théorie :
//
//   · le trigger `protect_profile_flags` (0006, durci en 0022) ne gardait
//     que `is_platform_admin`. `can_manage_roadmap` est né en 0037 sans y
//     être ajouté, et « Own profile » (0001) autorise chacun à écrire sa
//     propre ligne : N'IMPORTE QUEL COMPTE pouvait donc se cocher
//     l'arbitrage de la roadmap d'une requête. Une capacité qui
//     s'auto-attribue n'est pas une capacité ;
//   · `anonymize_profile` (0063) remet les capacités à faux une par une,
//     à la main. En ajouter une sans y penser laisse un compte anonymisé
//     porteur d'un pouvoir — au sens propre, une personne effacée qui
//     continue d'arbitrer.
//
// Les deux défauts se ressemblent : une colonne ajoutée d'un côté,
// oubliée de trois autres. On les vérifie donc ensemble, et le seul fait
// de déclarer une nouvelle capacité ici oblige à fermer les quatre.
const PROFILE_CAPABILITIES = [
  { column: 'can_manage_roadmap', fn: 'is_roadmap_manager', capability: null },
  { column: 'can_manage_users', fn: 'is_user_manager', capability: 'users.manage' },
]

const protectBody = lastMatch(`create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?protect_profile_flags[\\s\\S]*?\\$\\$;`)
const anonymizeBody = lastMatch(`create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?anonymize_profile[\\s\\S]*?\\$\\$;`)
if (!protectBody) fail('capacité', 'protect_profile_flags() introuvable — le verrou anti-escalade est illisible, ce contrôle serait aveugle')
if (!anonymizeBody) fail('capacité', 'anonymize_profile() introuvable — ce contrôle serait aveugle')

// On cherche la FORME de la garde, pas la mention du nom. Chercher la
// simple présence de « can_manage_users » dans les deux corps rendait ce
// contrôle tautologique : les deux fonctions CITENT ces colonnes dans
// leurs commentaires, et le contrôle restait au vert après suppression
// de la garde elle-même — vérifié en la retirant.
//
//   · le verrou du trigger, c'est la comparaison ancienne/nouvelle
//     valeur : `new.x is distinct from old.x`. Rien d'autre n'empêche
//     un CHANGEMENT ;
//   · le geste de l'anonymisation, c'est l'affectation `x = false`.
const guardsDelta = (body, column) =>
  new RegExp(`new\\.${column}\\s+is\\s+distinct\\s+from\\s+old\\.${column}`).test(body)
const resetsToFalse = (body, column) =>
  new RegExp(`\\b${column}\\s*=\\s*false`).test(body)

// Le rôle plateforme lui-même passe par les mêmes deux verrous : le
// laisser hors du contrôle rouvrirait le trou de 2026-08 (chacun
// pouvait se poser `platform_role = 'admin'`, que `is_admin()` lit).
if (protectBody && !guardsDelta(protectBody[0], 'platform_role')) {
  fail('capacité', "protect_profile_flags() ne garde pas `platform_role`.\n"
    + "     → `is_admin()` le LIT depuis la 0037 et « Own profile » (0001) laisse chacun écrire sa ligne :\n"
    + '       sans cette garde, n\'importe quel compte se pose administrateur en une requête')
}

for (const { column, fn, capability } of PROFILE_CAPABILITIES) {
  const label = `« ${column} »`
  if (!new RegExp(`add column (?:if not exists )?${column}\\b`).test(sqlAll)) {
    fail('capacité', `${label} n'est ajoutée par aucune migration — la case à cocher n'a pas de colonne`)
    continue
  }
  // 1. Un porteur nommé, qui admet aussi l'administrateur : sans lui,
  //    cocher la case retirerait le droit à l'administrateur, ou
  //    obligerait chaque appelant à réécrire le « ou admin ».
  // `[\s\S]*?` et non `[^;]*` : le corps d'une fonction contient des
  // point-virgules (contrairement à celui d'une policy), la borne est
  // donc le `$$;` de fermeture — le premier, grâce au quantificateur
  // paresseux, sans quoi on avalerait la fonction suivante.
  const fnBody = lastMatch(`create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?${fn}\\s*\\([\\s\\S]*?\\$\\$;`)
  if (!fnBody) {
    fail('capacité', `${label} n'a pas de fonction ${fn}() : la RLS ne peut pas s'y référer`)
  } else {
    if (!fnBody[0].includes(column)) fail('capacité', `${fn}() ne lit pas ${label}`)
    if (!/'admin'/.test(fnBody[0])) fail('capacité', `${fn}() n'admet pas l'administrateur : cocher la case le lui RETIRERAIT`)
  }
  // 2. Elle ne s'auto-attribue pas.
  if (protectBody && !guardsDelta(protectBody[0], column)) {
    fail('capacité', `${label} n'est pas gardée par protect_profile_flags()`
      + ` (il y manque « new.${column} is distinct from old.${column} »).\n`
      + `     → « Own profile » (0001) laisse chacun écrire sa propre ligne : la capacité se coche toute seule`)
  }
  // 3. L'anonymisation la retire.
  if (anonymizeBody && !resetsToFalse(anonymizeBody[0], column)) {
    fail('capacité', `anonymize_profile() ne remet pas ${label} à faux : un compte effacé garderait ce pouvoir`)
  }
  // 4. Si elle porte une capacité de la matrice, celle-ci le dit — et
  //    aucun rôle PROJET ne l'ouvre : la capacité vit sur le profil.
  if (capability) {
    const roles = matrix.get(capability)
    if (roles === undefined) fail('capacité', `« ${capability} » absent de la matrice alors que ${label} l'ouvre`)
    else if (roles.length) {
      fail('capacité', `« ${capability} » est accordé à ${roles.join(', ')} : c'est une capacité de PROFIL, aucun rôle projet ne doit l'ouvrir`)
    }
    // `\bnote:` seul ne suffit pas — il se laisse satisfaire par
    // « xnote: », dont il n'y a pas de frontière de mot avant le « n ».
    // On exige le début d'une propriété d'objet.
    if (!new RegExp(`key:\\s*'${capability}'[\\s\\S]{0,600}?[\\s{,]note:`).test(matrixBlock)) {
      fail('capacité', `« ${capability} » n'a pas de note : la colonne « Administrateur » de l'écran Accès & rôles\n`
        + `     ne montre pas une capacité de profil, il faut donc l'écrire`)
    }
  }
}

// ------------------------------------------------------------
console.log(`Contrôle RBAC — ${matrix.size} capacités, ${ASSIGNABLE.length} rôles attribuables, ${LEGACY.length} retirés, ${PROFILE_CAPABILITIES.length} capacités de profil.`)
if (failures.length) {
  console.error(`\n✗ ${failures.length} problème(s) :\n`)
  for (const f of failures) console.error(`  · ${f}`)
  process.exit(1)
}
console.log('✓ Une seule liste de droits, et elle concorde avec le SQL.')
