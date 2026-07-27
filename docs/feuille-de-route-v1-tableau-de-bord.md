# Feuille de route — tableau de bord V1 (maquette du 27/07)

La cible : la maquette « YCID Pilot » fournie le 27/07 au soir —
barre latérale sombre et groupée, tuiles d'en-tête, tableau des projets
avec drapeaux et avancement, **carte des interventions Yvelines-Liban**,
et une identité visuelle (logo, favicon, déclinaisons).

## Comment lire la maquette

C'est une image générée : elle donne la **direction visuelle**, pas le
contenu. On y lit « Projets miacks », « 643 Partenennises »,
« Avancrature », deux entrées de menu en double — autant de texte
décoratif. La règle de lecture retenue :

> **On prend la mise en scène, on garde NOS données.** Chaque chiffre,
> chaque libellé, chaque entrée de menu de la V1 vient de la base — pas
> de la maquette.

Deux éléments de la maquette sont volontairement écartés (décor sans
fonction derrière) :

- les **cases à cocher** du tableau — elles promettent des actions en
  masse qui n'existent pas ; une case qui ne fait rien apprend à ne
  plus cocher ;
- l'**icône messagerie** — l'application n'a pas de messagerie ; la
  cloche de notifications joue déjà ce rôle.

## Ce que la maquette montre et qui EXISTE déjà

| Élément de la maquette | État |
|---|---|
| Tuiles KPI en tête | **Livré le 27/07** (StatTile, partout) |
| Barres d'avancement par projet | **Livré** (Pilotage) |
| Cloche de notifications + badge | **Livré** |
| Avatar + menu utilisateur | **Livré** |
| Marque paramétrable (nom, couleurs, logo) | **Livré** (écran Configuration ▸ Marque, 0018) |

Le socle est donc plus proche de la cible qu'il n'y paraît : il reste
la **mise en scène** (sidebar, tableau enrichi), la **carte**, et
l'**identité**.

---

## Les quatre lots

### Lot 1 — Barre latérale sombre et groupée · **1 jour**

La sidebar actuelle est blanche, à plat. La cible : fond sombre teinté
de la couleur de marque, sections groupées avec intitulés (Projets,
Suivi, Paramètres), état actif en pastille claire.

- Restyle de `Sidebar.tsx` + `MobileNav.tsx` (les deux partagent les
  entrées : une seule liste, comme toujours).
- Les couleurs restent des variables de marque — le white-label (0018)
  continue de fonctionner : une autre collectivité garde SA couleur.
- Contraste vérifié (texte clair sur fond sombre, RGAA).

*Risque : faible. Aucune donnée, aucun SQL.*

### Lot 2 — Tableau « Statut des projets » enrichi · **0,5 jour**

Le tableau du Pilotage s'enrichit vers la cible :

- colonne **partenaires** (depuis `project_organizations`, déjà en
  base) ;
- **drapeau** du pays (Unicode, pas d'emoji image) ;
- **tri** par avancement / pays / nom ;
- kebab « ⋯ » par ligne : Ouvrir · Budget · Vitrine publique.
- Pagination seulement si le portefeuille dépasse ~20 projets — trois
  projets paginés sur une page, c'est du décor.

*Risque : faible. Repose sur des données existantes.*

### Lot 3 — Carte des interventions Yvelines-Liban · **1,5 à 2 jours**

Le morceau neuf. Deux panneaux (Yvelines, Liban) avec un repère par
projet, comme la maquette.

**Choix technique proposé : SVG dessiné, zéro dépendance.** Une
bibliothèque de cartographie (Leaflet…) tirerait des fonds de carte
depuis un serveur tiers — dépendance réseau, poids, RGPD — pour deux
territoires qui ne changeront jamais. Deux tracés SVG (contour des
Yvelines, contour du Liban) et une projection simple suffisent, et le
rendu est net à toutes les tailles.

- Migration `0049` : `projects.lat` / `projects.lng`, saisies dans
  « Modifier la fiche du projet » — PAS de géocodage automatique, qui
  appellerait un service externe pour trois communes connues.
- Repères cliquables → la fiche projet ; nombre de projets par
  territoire en légende.
- Sur téléphone : les deux panneaux s'empilent (règle « rien ne sort
  du cadre »).

*Risque : moyen — le soin du tracé fait la qualité perçue. Demande une
passe de saisie des coordonnées (Azour, Jeïta, Villepreux, Jouy…).*

### Lot 4 — Identité visuelle · **0,5 jour de dev** + une décision

Le logo « arbre » de la maquette et ses déclinaisons (icône, favicon,
monochrome, icône d'app).

- **La décision vous revient** : un logo est un choix d'identité, pas
  un correctif. Trois voies — (a) vous fournissez un logo existant ;
  (b) un graphiste ; (c) je génère des propositions par IA que vous
  tranchez.
- Côté dev, tout existe déjà presque : l'écran Marque accepte le logo.
  Reste à câbler **favicon + icônes PWA** depuis le logo téléversé
  (manifest déjà en place) : 0,5 jour.

---

## Séquencement proposé

La semaine du 28/07 est la **semaine de recette**. La règle : ne pas
déstabiliser ce qui est en test.

| Quand | Quoi | Cumul |
|---|---|---|
| Début de semaine | Lot 1 (sidebar) + Lot 2 (tableau) | 1,5 j |
| Milieu de semaine | Lot 3 (carte) — derrière la recette, pas devant | +2 j |
| En parallèle, sans dev | Décision logo (Lot 4) | — |
| Fin de semaine | Lot 4 câblage favicon/PWA + passe d'écran complète | +0,5 j |

**Total : 3,5 à 4 jours de développement.** Les lots 1-2 sont sans
risque et livrables dès demain ; la carte est le seul travail qui mérite
qu'on le regarde deux fois avant de dire « fini ».

## Ce qui passe AVANT si la semaine se resserre

1. Les correctifs que la recette remontera — ils priment sur le décor.
2. Les sauvegardes (jamais testées) — arbitré le 27/07 : traité pendant
   la semaine de recette.
3. La carte peut glisser d'une semaine sans rien casser : c'est le lot
   le plus visible et le moins structurant.
