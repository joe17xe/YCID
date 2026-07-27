// ============================================================
// Garde-fou : un tableau ne fait pas glisser la page
// ============================================================
// Un `<table>` ne rétrécit pas. Placé dans une page sans conteneur qui
// défile, il impose sa largeur au document entier : sur un téléphone,
// ce n'est pas le tableau qui déborde, c'est TOUTE la page qui glisse
// sous le doigt — cartes, boutons et titres emportés avec elle.
//
// C'est ce qui s'est passé le 27/07 : « le display n'est pas au format
// mobile ». Six tableaux n'avaient aucun conteneur, et le tableau
// budgétaire — corrigé la veille — donnait le change pendant que la
// barre d'onglets, elle, poussait la page à 900 pixels.
//
// Arbitrage du 27/07, après essai au téléphone : « ça ne doit jamais
// sortir du cadre du téléphone, il faut arranger chaque tâche autrement
// même si on défile longuement sur la page ». Un tableau qui défile
// latéralement sort du cadre — il est lisible, pas consultable : pour
// lire une ligne il faut la balayer, et l'on perd l'en-tête en route.
//
// Deux règles, désormais sans exception :
//   · un conteneur `overflow-x-auto` — filet de sécurité pour les
//     écrans intermédiaires, entre 640 px et la largeur du tableau ;
//   · la classe `table-cards`, qui bascule les lignes en blocs sous
//     640 px. Elle porte aussi la largeur minimale, en CSS et non en
//     style inline : une valeur inline l'emporterait sur la requête
//     média et empêcherait justement la bascule.
//
// Un `minWidth` inline n'est plus accepté : c'était le défilement
// latéral, c'est-à-dire ce qu'on vient d'écarter.
//
//   node scripts/check-mobile.mjs
//
// Ce contrôle ne remplace pas un essai sur un vrai téléphone : il
// attrape l'oubli, pas la laideur.

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const SKIP = new Set(['node_modules', '.next', '.git', 'public', 'scripts'])

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  if (SKIP.has(e.name)) return []
  const p = join(dir, e.name)
  return e.isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : []
})

// Fenêtre de remontée : le conteneur est presque toujours la balise
// juste au-dessus, parfois séparée par un en-tête de carte ou un
// commentaire. Au-delà, ce n'est plus un conteneur, c'est une autre
// section.
const LOOKBACK = 8

const failures = []
let tables = 0

for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/<table\b/.test(lines[i])) continue
    tables++
    const before = lines.slice(Math.max(0, i - LOOKBACK), i).join('\n')
    const rel = relative(ROOT, file)
    if (!/overflow-x-auto|overflow-auto|overflow-x-scroll/.test(before)) {
      failures.push(`${rel}:${i + 1} — <table> sans conteneur défilant. `
        + `Sur téléphone, c'est la page entière qui glisse. `
        + `Enveloppez dans <div className="overflow-x-auto">.`)
    } else if (!/table-cards/.test(lines[i])) {
      failures.push(`${rel}:${i + 1} — <table> sans la classe « table-cards ». `
        + `Il défilera latéralement sur téléphone au lieu de se replier en cartes. `
        + `Ajoutez className="… table-cards tc-640" et un data-label sur chaque <td>.`)
    }
  }
}

console.log(`Contrôle mobile — ${tables} tableaux relus.`)
if (failures.length) {
  console.error(`\n✗ ${failures.length} tableau(x) qui débordent :\n`)
  for (const f of failures) console.error(`  · ${f}`)
  console.error('')
  process.exit(1)
}
console.log('✓ Aucun tableau ne défile latéralement sur téléphone.')
