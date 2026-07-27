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
// Le remède tient en deux règles, et elles vont ensemble :
//   · un conteneur `overflow-x-auto` autour du tableau ;
//   · une largeur minimale sur le tableau, sinon les colonnes se
//     compriment jusqu'à l'illisible plutôt que de déclencher le
//     défilement.
//
// La classe `table-cards` vaut largeur minimale : elle la porte en CSS
// (globals.css) plutôt qu'en style inline, précisément pour qu'une
// requête média puisse la lever et transformer les lignes en cartes.
// Une largeur inline l'emporterait sur la requête média.
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
    } else if (!/minWidth|min-w-\[|table-cards/.test(lines[i])) {
      // Le conteneur seul ne suffit pas : sans largeur minimale, le
      // navigateur comprime les colonnes au lieu de faire défiler, et
      // l'on obtient six colonnes de trois caractères.
      failures.push(`${rel}:${i + 1} — <table> dans un conteneur défilant mais sans largeur minimale. `
        + `Les colonnes se comprimeront au lieu de déclencher le défilement. `
        + `Ajoutez style={{ minWidth: … }}.`)
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
console.log('✓ Chaque tableau défile pour son propre compte.')
