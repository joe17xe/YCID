#!/usr/bin/env node
// Compose les galeries à partir des fichiers réellement déposés dans
// public/photos, d'après content/photos.json (préfixe → lieu, crédit).
//
//   node scripts/galeries.mjs          voir ce qui serait fait
//   node scripts/galeries.mjs --ecrire appliquer à content/pois.json
//
// Nommage attendu : « <prefixe>-<n>.jpg ». Le numéro donne l'ordre, et
// le premier sert de couverture. Le script est idempotent : il reconstruit
// la galerie depuis le disque, il ne l'empile pas.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p) => JSON.parse(readFileSync(join(racine, p), 'utf8'))

const { prefixes } = lire('content/photos.json')
const pois = lire('content/pois.json')
const ecrire = process.argv.includes('--ecrire')

const IMAGE = /^(.+)-(\d+)\.(jpe?g|png|webp|avif)$/i
const MAX_OCTETS = 500 * 1024

let fichiers = []
try {
  fichiers = readdirSync(join(racine, 'public/photos'))
} catch {
  console.error('public/photos introuvable.')
  process.exit(1)
}

// On regroupe par préfixe, en gardant le plus long qui corresponde :
// « blue-jay-valley-1.jpg » ne doit pas tomber dans « blue-jay ».
const parPoi = new Map()
const orphelins = []
const lourds = []
for (const f of fichiers.sort()) {
  const m = IMAGE.exec(f)
  if (!m) continue
  const [, base, no] = m
  const prefixe = Object.keys(prefixes)
    .filter((p) => base === p || base.startsWith(p + '-') || base === p)
    .sort((a, b) => b.length - a.length)[0]
  if (!prefixe) {
    orphelins.push(f)
    continue
  }
  const { poi, credit } = prefixes[prefixe]
  if (statSync(join(racine, 'public/photos', f)).size > MAX_OCTETS) lourds.push(f)
  const liste = parPoi.get(poi) ?? []
  liste.push({ no: Number(no), photo: { src: `/photos/${f}`, credit } })
  parPoi.set(poi, liste)
}

let touches = 0
for (const o of pois) {
  const liste = parPoi.get(o.slug)
  if (!liste) continue
  const galerie = liste.sort((a, b) => a.no - b.no).map((x) => x.photo)
  // Un crédit ou une légende déjà saisis à la main l'emportent : le
  // script complète le contenu, il ne l'écrase pas.
  const avant = new Map((o.photos ?? []).map((p) => [p.src, p]))
  o.photos = galerie.map((p) => ({ ...p, ...avant.get(p.src) }))
  o.photo = o.photos[0]?.src ?? null
  touches++
  console.log(`${o.slug} → ${o.photos.length} photo(s), couverture ${o.photo}`)
}

if (orphelins.length)
  console.log(`\n${orphelins.length} fichier(s) sans préfixe connu : ${orphelins.join(', ')}`)
if (lourds.length)
  console.log(`\n⚠ plus de 500 Ko, à recompresser : ${lourds.join(', ')}`)
if (!touches) console.log('Aucune galerie composée.')

if (ecrire) {
  writeFileSync(join(racine, 'content/pois.json'), JSON.stringify(pois, null, 2) + '\n')
  console.log('\ncontent/pois.json écrit. Enchaînez : node scripts/gen-seed.mjs')
} else {
  console.log('\n(aperçu — relancez avec --ecrire pour appliquer)')
}
