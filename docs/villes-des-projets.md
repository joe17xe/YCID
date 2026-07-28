# Les villes des projets (28/07/2026)

Le constat, captures du 28/07 à l'appui : **le travail est entre des
villes** — une en Yvelines et une au Liban pour les triades (Villepreux
↔ Azour, Jouy-en-Josas ↔ Jeïta), parfois deux villes libanaises (les
échanges). Le modèle du lot 3 — un projet, un point `lat`/`lng` — ne
savait pas le dire : les deux triades placées côté Liban, le panneau
Yvelines affichait « 0 projet ».

## Le modèle (migration 0050)

- **`cities`** — le référentiel : nom, pays, coordonnées décimales
  (obligatoires : une ville sans position ne placerait aucun repère).
  Unique sur (nom, pays). Une ville créée pour un projet sert au
  suivant.
- **`project_cities`** — les villes d'un projet, autant qu'il en faut.
  Elles se renseignent **au niveau du projet** : fiche ▸ bouton
  « Villes » (mêmes droits que « Modifier », `phases.manage`), et la
  fiche les liste dans son en-tête.

`projects.lat` / `projects.lng` restent en base (héritage lot 3) : la
carte les ignore dès que la 0050 est passée, et le code déployé avant
le SQL retombe dessus — jamais d'écran cassé entre les deux.

## La carte

Un repère par **ville**, sur les deux panneaux à la fois quand le
projet enjambe les territoires. Cliquer un repère ouvre la liste des
projets qui impliquent la ville, chacun étant un lien vers sa fiche.
La légende compte ce que la carte ne montre pas : projets sans ville,
villes hors des deux territoires.

## Qui voit quoi — l'arbitrage

> **Visualiser sans accéder.** Le repère d'une ville et le NOMBRE de
> projets qui l'impliquent sont visibles de tout compte connecté
> (`project_cities` est lisible par tous : des identifiants opaques,
> jamais un nom). Les NOMS de projets et leurs fiches restent derrière
> les policies projets : un projet hors droits apparaît comme « N
> projet(s) sans accès pour votre compte », jamais nommé, jamais
> cliquable.

La recette existante reste donc vraie : Maria ne voit toujours pas la
Triade Jouy dans ses listes ni son nom sur la carte — elle voit
seulement qu'à Jouy-en-Josas, un travail existe.

Corriger ou supprimer une ville du référentiel déplace les repères de
TOUS les projets qui la portent : c'est réservé aux admins (SQL ou à
outiller le jour venu). Créer une ville est ouvert à tout connecté,
comme les organisations (précédent 0001).

## Ce qui est refusé

- **Pas de géocodage automatique** : un service externe pour une
  poignée de communes connues (arbitrage lot 3, inchangé). Les
  coordonnées se saisissent à la main à la création de la ville.
- **Pas de page par ville** pour l'instant : le clic ouvre un panneau
  sur place. Une page dédiée (historique, photos par ville) est une
  idée de roadmap le jour où le besoin existe.
