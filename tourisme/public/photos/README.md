# Les photos du site

Un fichier ici devient consultable à `/photos/<nom>.jpg`. C'est cette
valeur qu'on met dans le champ `photo` d'un POI, d'un parcours ou d'un
événement — dans `/admin` si Supabase est branché, sinon dans
`content/*.json` puis `node scripts/gen-seed.mjs`.

## Ce qu'il faut envoyer

- **JPEG**, 1600 px de large environ (l'app n'affiche jamais plus large
  que 768 px, mais garde de la marge pour les écrans à haute densité) ;
- **paysage** de préférence : les cartes et les en-têtes sont larges ;
- moins de **400 Ko** par image — le site doit s'ouvrir sur le réseau
  d'un village de montagne ;
- un **nom en minuscules sans accent** : `beit-mrad.jpg`,
  `pineview-hotel.jpg`, `blue-jay-valley.jpg`.

## Le crédit n'est pas optionnel

Toute photo ajoutée est notée dans `CREDITS.txt` : qui l'a prise, et à
quel titre elle peut être publiée. Une photo d'établissement se demande
à l'établissement — on ne reprend pas une image trouvée en ligne.

## Plusieurs photos par lieu

Chaque lieu porte une **galerie ordonnée** — cinq images est un bon
maximum. La **première sert de couverture** : c'est elle qui apparaît
dans les listes, les vignettes et l'en-tête de la fiche. Les suivantes
se déroulent en grille sous la carte.

Nommez les fichiers par lieu et par ordre, c'est le plus simple à
relire : `beit-mrad-1.jpg`, `beit-mrad-2.jpg`, `pineview-1.jpg`…

Dans `/admin`, chaque lieu affiche la grille des images disponibles :
on clique pour ajouter, les flèches réordonnent, la croix retire, et le
crédit se saisit sous chaque vignette.

## Déposer une série et laisser le script faire le reste

Nommez `<prefixe>-<n>.jpg` selon `content/photos.json` — par exemple
`beit-mrad-1.jpg` … `beit-mrad-5.jpg` — déposez les fichiers ici, puis :

    node scripts/galeries.mjs            # aperçu
    node scripts/galeries.mjs --ecrire   # applique
    node scripts/gen-seed.mjs            # régénère le SQL

Le numéro donne l'ordre, et le **n° 1 devient la couverture**. Le crédit
vient de `content/photos.json`, une ligne par lieu. Le script est
idempotent : il reconstruit la galerie depuis le disque, il ne l'empile
pas — et il respecte les légendes déjà saisies à la main.

Il signale au passage les fichiers dont le préfixe n'est rattaché à
aucun lieu, et ceux qui dépassent 500 Ko.

## Ce qu'on ne publie pas sans y avoir réfléchi

- **Des visages identifiables** sans l'accord des personnes. Le site est
  porté par des collectivités publiques françaises : une photo de groupe
  demande le consentement de celles et ceux qui y figurent.
- **Des images marquées** d'un logo, d'un slogan ou d'un numéro de
  téléphone incrusté : elles se lisent comme des publicités au milieu du
  reste. Demandez la version sans habillage à l'établissement.
