// ============================================================
// Garde-fou : un agrégat budgétaire écarte les valorisations
// ============================================================
// Règle produit, écrite deux fois — docs/spec-phase1-mvp.md §10.4 et le
// bandeau « Répartition par financeur » de l'écran projet : le prévu est
// HORS valorisation, et les valorisations se présentent à part. Du
// bénévolat et des locaux prêtés ne se votent pas, ne s'engagent pas et
// ne se paient pas ; les mêler à des euros gonfle une enveloppe d'un
// montant que personne ne réglera jamais.
//
// Cette règle n'était appliquée QU'À MOITIÉ, ce qui est pire que pas du
// tout. Le total du projet et la répartition par financeur filtraient
// sur `is_valorisation` ; les agrégats par phase — dans l'écran comme
// dans le sous-total du tableau — prenaient toutes les lignes. Résultat
// constaté à l'écran par le Product Owner : la somme des sous-totaux de
// phase ne faisait pas le total du projet affiché quatre blocs plus
// haut, et une « Cérémonie et randonnée d'inauguration » valorisée
// 1 500 € pesait dans le prévu d'une phase comme de l'argent voté. Un
// écran de suivi budgétaire dont les colonnes ne s'additionnent pas se
// fait reprendre au premier COPIL.
//
// Le défaut n'est pas visible à la relecture : les deux calculs sont à
// vingt lignes d'écart et se ressemblent. Rien, ni TypeScript ni le
// build, ne dit qu'un `for (const l of budgetLines)` a oublié un test
// qu'un autre fait. D'où ce contrôle.
//
//   node scripts/check-valorisation.mjs
//
// CE QU'IL REGARDE — volontairement peu, pour ne jamais crier pour
// rien. Trois formes, celles qu'ont prises les deux défauts réels :
//   · une boucle `for … of` dont le corps somme `planned_amount` ou
//     appelle `financialsFor()` ;
//   · un `.reduce()` qui somme `planned_amount` ;
//   · un `sumFinancials(X.map(…))`, c'est-à-dire un total bâti sur une
//     liste de lignes.
// Chacune doit être VISIBLEMENT consciente des valorisations : soit son
// corps teste `is_valorisation`, soit la liste qu'elle parcourt est un
// identifiant déclaré par un filtre sur `is_valorisation` (`realLines`,
// `valoLines`). Le contrôle ne cherche pas à savoir si le filtre est
// dans le bon sens — il exige que la question ait été posée.
//
// PÉRIMÈTRE : les `.ts` et `.tsx` d'`app/` et de `components/`,
// c'est-à-dire ce qui s'AFFICHE et ce qui se REND. `lib/budget.ts` en
// est volontairement absent : il reçoit un montant déjà choisi et n'a
// pas à connaître la notion.
//
// Les `.ts` viennent d'y entrer. Le périmètre s'arrêtait aux `.tsx`
// pour une raison précise : `app/(app)/projets/[id]/report-actions.ts`,
// le générateur du rapport d'expert IA, portait le même défaut sur ses
// agrégats de phase, et faire échouer la CI sur une dette connue plutôt
// que sur une régression aurait appris à tout le monde à ignorer ce
// contrôle. Cette dette est corrigée — le fichier écarte désormais les
// valorisations des montants par phase et par tâche, et les expose à
// part au modèle. Rien ne justifie plus la restriction, et l'écart
// comptait davantage là que partout ailleurs : un rapport part au
// financeur, un écran se recharge.
//
// Ce contrôle ne remplace pas la lecture : il attrape l'oubli, pas le
// contresens.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DIRS = ['app', 'components']
// `.ts` compris : les server actions calculent les mêmes totaux que les
// écrans, et le digest du rapport IA en est un.
const EXT = /\.tsx?$/

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  if (e.name === 'node_modules' || e.name.startsWith('.')) return []
  const p = join(dir, e.name)
  return e.isDirectory() ? walk(p) : EXT.test(e.name) ? [p] : []
})

// Lit le contenu d'une paire de délimiteurs à partir de `open`. Si
// l'équilibre n'est jamais atteint — chaîne contenant une accolade,
// exotisme quelconque — on rend le reste du fichier : l'analyse devient
// PLUS permissive, jamais plus bavarde. Un garde-fou qui se trompe doit
// se taire, pas accuser.
function balanced(src, open, [o, c]) {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === o) depth++
    else if (src[i] === c) { depth--; if (!depth) return { text: src.slice(open + 1, i), end: i } }
  }
  return { text: src.slice(open + 1), end: src.length }
}

// Un identifiant est « conscient » si sa déclaration parle de
// valorisation. Trois lignes suffisent : au-delà, ce n'est plus la
// déclaration qu'on lit, c'est ce qui suit — et l'on conclurait juste
// par accident.
function declarationMentionsValorisation(src, name) {
  const m = src.match(new RegExp(`\\bconst\\s+${name}\\b[^\\n]*(\\n[^\\n]*){0,2}`))
  return !!m && m[0].includes('is_valorisation')
}

// La question a-t-elle été posée quelque part sur ce calcul ?
function isAware(src, source, body) {
  if (`${source}\n${body}`.includes('is_valorisation')) return true
  return (source.match(/[A-Za-z_$][\w$]*/g) ?? [])
    .some(id => declarationMentionsValorisation(src, id))
}

const lineOf = (src, index) => src.slice(0, index).split('\n').length

const failures = []
let checked = 0

// Trois façons d'écrire le même total. Chacune a été trouvée dans le
// code : `for` et `sumFinancials(...map(...))` portaient le défaut,
// `.reduce()` porte le total des valorisations.
function inspect(rel, src) {
  // 1. for (const l of <liste>) { … planned_amount … financialsFor(…) }
  for (const m of src.matchAll(/\bfor\s*\(/g)) {
    const head = balanced(src, m.index + m[0].length - 1, ['(', ')'])
    const of = head.text.split(/\bof\b/)
    if (of.length < 2) continue // for(;;) : pas une itération de lignes
    const braceAt = src.indexOf('{', head.end)
    if (braceAt === -1) continue
    const body = balanced(src, braceAt, ['{', '}']).text
    if (!/planned_amount|financialsFor\s*\(/.test(body)) continue
    checked++
    if (isAware(src, of.slice(1).join('of'), body)) continue
    failures.push([rel, lineOf(src, m.index),
      'boucle qui agrège des montants sans jamais regarder `is_valorisation`'])
  }

  // 2. …reduce((s, l) => s + l.planned_amount, 0)
  for (const m of src.matchAll(/\.reduce\s*\(/g)) {
    const arg = balanced(src, m.index + m[0].length - 1, ['(', ')'])
    if (!arg.text.includes('planned_amount')) continue
    checked++
    // Le receveur : ce qui précède `.reduce(` sur la même expression.
    // 200 caractères couvrent `(budgetLines ?? []).filter(…)` sans
    // remonter jusqu'à l'instruction d'avant.
    const receiver = src.slice(Math.max(0, m.index - 200), m.index)
    if (isAware(src, receiver, arg.text)) continue
    failures.push([rel, lineOf(src, m.index),
      'somme de `planned_amount` sur une liste qui peut contenir des valorisations'])
  }

  // 3. sumFinancials(<liste>.map(…)) — le total d'un groupe de lignes.
  for (const m of src.matchAll(/\bsumFinancials\s*\(/g)) {
    const arg = balanced(src, m.index + m[0].length - 1, ['(', ')'])
    const mapAt = arg.text.indexOf('.map(')
    if (mapAt === -1) continue // un tableau déjà constitué : rien à filtrer ici
    checked++
    if (isAware(src, arg.text.slice(0, mapAt), arg.text)) continue
    failures.push([rel, lineOf(src, m.index),
      'total bâti sur une liste de lignes non filtrée — les valorisations y entrent'])
  }
}

let files = 0
for (const dir of DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    files++
    inspect(relative(ROOT, file), readFileSync(file, 'utf8'))
  }
}

// « fichiers » et non « écrans » depuis l'entrée des `.ts` : un digest
// envoyé à un modèle ne s'affiche nulle part et compte tout autant.
console.log(`Contrôle des valorisations — ${files} fichiers relus, ${checked} agrégats budgétaires examinés.`)

if (!checked) {
  console.error('\n✗ Aucun agrégat trouvé : ce contrôle est devenu aveugle.')
  console.error('  Les calculs ont changé de forme — adaptez les motifs ci-dessus,')
  console.error("  sinon il passera au vert quoi qu'il arrive.\n")
  process.exit(1)
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} agrégat(s) qui comptent du bénévolat comme de l'argent :\n`)
  for (const [file, line, why] of failures) console.error(`  · ${file}:${line} — ${why}`)
  console.error('')
  console.error('  Le prévu est HORS valorisation (spec §10.4). Un total qui les inclut')
  console.error("  gonfle l'enveloppe d'un montant que personne ne paiera, et se voit :")
  console.error('  la somme des sous-totaux ne fait plus le total du projet.')
  console.error('')
  console.error('  Parcourez une liste filtrée — `realLines` — ou écartez la ligne dans')
  console.error('  la boucle (`if (l.is_valorisation) { … ; continue }`). Et gardez le')
  console.error("  montant VISIBLE à côté, jamais dedans : pour le MEAE l'apport en")
  console.error('  nature fait partie du cofinancement.\n')
  process.exit(1)
}

console.log('✓ Aucun agrégat budgétaire ne compte les valorisations comme de l\'argent.')
