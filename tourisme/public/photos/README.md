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
