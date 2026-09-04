#!/usr/bin/env node
// Génère supabase/seed.sql depuis content/*.json — le contenu fichier
// est la source unique de vérité, le SQL en est une projection.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => JSON.parse(readFileSync(join(root, 'content', f), 'utf8'))

const territoire = read('territoire.json')
const parcours = read('parcours.json')
const pois = read('pois.json')
const evenements = read('evenements.json')
const formules = read('formules.json')

const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const j = (v) => (v == null ? 'null' : `${q(JSON.stringify(v))}::jsonb`)
const t = (v) => (v == null ? 'null' : q(v))
const n = (v) => (v == null ? 'null' : Number(v))
const b = (v) => (v ? 'true' : 'false')
const arr = (v) => `'{${v.join(',')}}'`
const pt = (c) => (c == null ? 'null' : `st_setsrid(st_makepoint(${c[0]}, ${c[1]}), 4326)`)
const line = (g) =>
  g == null ? 'null' : `st_setsrid(st_geomfromgeojson(${q(JSON.stringify(g))}), 4326)`
const T = `(select id from territoires where slug = ${q(territoire.slug)})`

let sql = `-- Seed « ${territoire.nom.fr} » — GÉNÉRÉ par scripts/gen-seed.mjs depuis content/*.json.
-- Ne pas éditer à la main : modifier content/ puis relancer \`node scripts/gen-seed.mjs\`.
-- Idempotent : rejouable (upsert par slug).

insert into territoires (slug, nom, marque, slogan, actif, langues, langue_defaut, photo_accueil,
  contact_tel, contact_whatsapp, contact_email, urgences, etat_acces, centre, zoom_defaut,
  presentation, acces)
values (${q(territoire.slug)}, ${j(territoire.nom)}, ${t(territoire.marque)}, ${j(territoire.slogan)}, ${b(territoire.actif)},
  ${arr(territoire.langues)}, ${q(territoire.langue_defaut)}, ${t(territoire.photo_accueil)},
  ${t(territoire.contact_tel)}, ${t(territoire.contact_whatsapp)}, ${t(territoire.contact_email)},
  ${j(territoire.urgences)}, ${j(territoire.etat_acces)}, ${pt(territoire.centre)}, ${n(territoire.zoom_defaut)},
  ${j(territoire.presentation)}, ${j(territoire.acces)})
on conflict (slug) do update set nom = excluded.nom, marque = excluded.marque, slogan = excluded.slogan,
  actif = excluded.actif, langues = excluded.langues, langue_defaut = excluded.langue_defaut,
  photo_accueil = excluded.photo_accueil, urgences = excluded.urgences,
  etat_acces = excluded.etat_acces, centre = excluded.centre, zoom_defaut = excluded.zoom_defaut,
  presentation = excluded.presentation, acces = excluded.acces;
`

for (const p of parcours) {
  sql += `
insert into parcours (territoire_id, slug, nom, accroche, description, type, difficulte,
  acces_guide, trace, trace_statut, distance_m, denivele_pos_m, denivele_neg_m,
  duree_min_minutes, duree_max_minutes, saison, dangers, acces, depart, photo, statut, ordre)
values (${T}, ${q(p.slug)}, ${j(p.nom)}, ${j(p.accroche)}, ${j(p.description)}, ${q(p.type)},
  ${q(p.difficulte)}, ${b(p.acces_guide)}, ${line(p.trace)}, ${q(p.trace_statut)},
  ${n(p.distance_m)}, ${n(p.denivele_pos_m)}, ${n(p.denivele_neg_m)},
  ${n(p.duree_min_minutes)}, ${n(p.duree_max_minutes)}, ${j(p.saison)}, ${j(p.dangers)},
  ${j(p.acces)}, ${pt(p.depart)}, ${t(p.photo)}, ${q(p.statut)}, ${n(p.ordre)})
on conflict (territoire_id, slug) do update set nom = excluded.nom, accroche = excluded.accroche,
  description = excluded.description, type = excluded.type, difficulte = excluded.difficulte,
  acces_guide = excluded.acces_guide, trace = excluded.trace, trace_statut = excluded.trace_statut,
  distance_m = excluded.distance_m, denivele_pos_m = excluded.denivele_pos_m,
  denivele_neg_m = excluded.denivele_neg_m, duree_min_minutes = excluded.duree_min_minutes,
  duree_max_minutes = excluded.duree_max_minutes, saison = excluded.saison,
  dangers = excluded.dangers, acces = excluded.acces, depart = excluded.depart,
  photo = excluded.photo, statut = excluded.statut, ordre = excluded.ordre;
`
}

for (const o of pois) {
  sql += `
insert into pois (territoire_id, slug, nom, type, geom, panneau_no, texte, photo, audio_url, contact, statut, ordre, services, sur_reservation, photos)
values (${T}, ${q(o.slug)}, ${j(o.nom)}, ${q(o.type)}, ${pt(o.geom)}, ${n(o.panneau_no)},
  ${j(o.texte)}, ${t(o.photo)}, ${t(o.audio_url)}, ${j(o.contact)}, ${q(o.statut)}, ${n(o.ordre)}, ${arr(o.services ?? [])}, ${b(o.sur_reservation)}, ${j(o.photos ?? [])})
on conflict (territoire_id, slug) do update set nom = excluded.nom, type = excluded.type,
  geom = excluded.geom, panneau_no = excluded.panneau_no, texte = excluded.texte,
  photo = excluded.photo, audio_url = excluded.audio_url, contact = excluded.contact,
  statut = excluded.statut, ordre = excluded.ordre, services = excluded.services,
  sur_reservation = excluded.sur_reservation, photos = excluded.photos;
`
}

for (const p of parcours) {
  if (!p.etapes?.length) continue
  sql += `\ndelete from parcours_pois where parcours_id = (select id from parcours where slug = ${q(p.slug)} and territoire_id = ${T});`
  p.etapes.forEach((slug, i) => {
    sql += `
insert into parcours_pois (parcours_id, poi_id, ordre)
select (select id from parcours where slug = ${q(p.slug)} and territoire_id = ${T}),
       (select id from pois where slug = ${q(slug)} and territoire_id = ${T}), ${i + 1}
on conflict do nothing;`
  })
  sql += '\n'
}

for (const f of formules) {
  sql += `
insert into formules (territoire_id, slug, nom, accroche, description, categorie,
  duree_minutes, participants_min, participants_max, prix_montant, prix_devise, prix_unite,
  inclus, niveau, saison, langues, photo, statut, ordre)
values (${T}, ${q(f.slug)}, ${j(f.nom)}, ${j(f.accroche)}, ${j(f.description)}, ${q(f.categorie)},
  ${n(f.duree_minutes)}, ${n(f.participants_min)}, ${n(f.participants_max)},
  ${n(f.prix_montant)}, ${q(f.prix_devise)}, ${q(f.prix_unite)},
  ${j(f.inclus)}, ${t(f.niveau)}, ${j(f.saison)}, ${arr(f.langues)}, ${t(f.photo)},
  ${q(f.statut)}, ${n(f.ordre)})
on conflict (territoire_id, slug) do update set nom = excluded.nom, accroche = excluded.accroche,
  description = excluded.description, categorie = excluded.categorie,
  duree_minutes = excluded.duree_minutes, participants_min = excluded.participants_min,
  participants_max = excluded.participants_max, prix_montant = excluded.prix_montant,
  prix_devise = excluded.prix_devise, prix_unite = excluded.prix_unite,
  inclus = excluded.inclus, niveau = excluded.niveau, saison = excluded.saison,
  langues = excluded.langues, photo = excluded.photo, statut = excluded.statut,
  ordre = excluded.ordre;
`
  sql += `\ndelete from formules_parcours where formule_id = (select id from formules where slug = ${q(f.slug)} and territoire_id = ${T});`
  for (const slug of f.parcours_slugs ?? []) {
    sql += `
insert into formules_parcours (formule_id, parcours_id)
select (select id from formules where slug = ${q(f.slug)} and territoire_id = ${T}),
       (select id from parcours where slug = ${q(slug)} and territoire_id = ${T})
on conflict do nothing;`
  }
  sql += '\n'
}

for (const e of evenements) {
  sql += `
insert into evenements (territoire_id, slug, nom, description, date_debut, date_fin, recurrent, lien, photo, statut)
values (${T}, ${q(e.slug)}, ${j(e.nom)}, ${j(e.description)}, ${t(e.date_debut)}, ${t(e.date_fin)},
  ${b(e.recurrent)}, ${t(e.lien)}, ${t(e.photo)}, ${q(e.statut)})
on conflict (territoire_id, slug) do update set nom = excluded.nom, description = excluded.description,
  date_debut = excluded.date_debut, date_fin = excluded.date_fin, recurrent = excluded.recurrent,
  lien = excluded.lien, photo = excluded.photo, statut = excluded.statut;
`
}

writeFileSync(join(root, 'supabase', 'seed.sql'), sql)
console.log(
  `seed.sql généré : 1 territoire, ${parcours.length} parcours, ${pois.length} POI, ` +
    `${formules.length} formules, ${evenements.length} événements`,
)
