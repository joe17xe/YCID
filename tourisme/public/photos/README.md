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
