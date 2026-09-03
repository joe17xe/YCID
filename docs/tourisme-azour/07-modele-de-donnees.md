# Plateforme touristique d'Azour — le modèle de données : tout est paramètre

Exigence du 29/08 (soir) : pouvoir **rentrer des coordonnées GPS de
façon indépendante**, chaque objet avec ses informations en paramètres,
pour faire évoluer la carte et les parcours **sans toucher au code**.

Réponse courte : c'est compatible — c'est même la conséquence logique de
l'exigence « scalable ». La règle devient : **la carte n'affiche que des
données ; le code ne connaît aucune coordonnée.** Ajouter un belvédère,
déplacer un départ, corriger une trace = une saisie au back-office,
visible immédiatement, sans redéploiement. Le précédent existe dans
Solid'Pilot : la table `cities` (migration 0050) stocke des coordonnées
décimales saisies à la main — même philosophie, étendue.

## Deux natures de géométrie, deux modes de saisie

| | Le **point** (POI, départ, panneau, urgence) | La **trace** (le tracé d'un parcours) |
|---|---|---|
| Ce que c'est | Deux nombres : latitude, longitude (degrés décimaux WGS84, le format de Google Maps — ex. `33.5303, 35.5688`) | Des centaines de points ordonnés |
| Saisie | Trois façons : coller les coordonnées · cliquer sur la carte du back-office · « prendre ma position » sur le terrain (téléphone, précision ±5-10 m — suffisant pour un POI) | **Import de fichier GPX ou KML** (jamais de saisie manuelle). Pour retoucher finement : outil externe gratuit (gpx.studio, Google Earth) puis ré-import — on ne développe pas d'éditeur de tracé en V1 |
| Stockage | Colonnes géométriques (PostGIS, activable dans Supabase) | Converti en GeoJSON à l'import, stocké en base |

Le KML de l'étude des sentiers, une fois récupéré, entre par ce même
canal d'import : le circuit de mise à jour des parcours est le circuit
d'amorçage.

## La fiche de paramètres par type d'objet

Ce qui se renseigne au back-office — rien d'autre ne définit la carte :

- **Territoire** : nom (×3 langues), logo, couleurs, langues actives,
  contacts, numéro d'information du kiosque, bandeau « état d'accès »
  daté. Dupliquer un village = créer une ligne ici.
- **Parcours** : nom ×3, type (boucle / linéaire / accès guidé), trace
  (import GPX), distance et D+/D− (**auto-calculés depuis la trace**,
  avec valeur officielle forçable — celles de l'étude), durée min-max,
  difficulté, saison conseillée, dangers ×3, point de départ (un POI),
  photos, statut (brouillon / publié / fermé temporairement).
- **POI** : nom ×3, type (belvédère, patrimoine, panneau, départ,
  hébergement, restaurant, guide, urgence, point d'eau…), coordonnées,
  numéro de panneau (le lien terrain ↔ app), texte court ×3, photos,
  lien audio, **services rendus sur place** (petit-déjeuner, restaurant,
  bar, épicerie, point d'eau), rattachement à 0..n parcours.

  Le **type** dit ce qu'est le lieu, les **services** disent ce qu'on y
  trouve : une maison d'hôtes sert le petit-déjeuner sans être un
  restaurant, un hôtel a une table sans cesser d'être un hébergement.
  C'est ce champ, et non le type, qui alimente la rubrique « Se
  restaurer » — et la distance au centre du territoire y sépare seule
  les tables du village de celles qu'on va chercher plus loin. Aucune
  liste n'est écrite dans le code.
- **Événement** : trail, randonnée d'inauguration, saison des cigognes…

## Les impacts techniques — honnêtement

1. **Un pipeline d'import à développer** (le seul vrai chantier ajouté) :
   upload GPX/KML → conversion GeoJSON → calculs dérivés (longueur,
   D+/D−, boîte englobante ; altitude complétée par un modèle numérique
   de terrain libre si la trace n'en porte pas) → prévisualisation.
   Quelques jours de développement, bibliothèques open source standard.
2. **Le versionnage hors-ligne** : les parcours étant téléchargeables,
   chaque modification de données doit invalider le pack hors-ligne
   concerné (champ version / date de mise à jour, le service worker
   re-télécharge quand le réseau revient). Prévu dès la conception,
   c'est simple ; rattrapé après coup, c'est une source de bugs subtils.
3. **Les garde-fous qualité** — une coordonnée fausse égare un
   randonneur : validation du format et des bornes (le point doit tomber
   au Liban), cohérence trace ↔ distance annoncée, et surtout un circuit
   **brouillon → prévisualisation sur carte → publié**, le même réflexe
   que les circuits de validation de Solid'Pilot. Personne ne publie une
   trace sans l'avoir vue dessinée.
4. **Les droits par territoire** : chaque territoire n'édite que ses
   objets — règles RLS Supabase, le mécanisme déjà maîtrisé sur
   Solid'Pilot. À poser dans le schéma dès la première migration.
5. **PostGIS dès le départ** : l'extension géographique de Postgres est
   disponible dans Supabase, gratuite, et rend les calculs (longueurs,
   proximité, emprises) natifs. La seule décision à ne pas différer, car
   elle structure le schéma.

## Ce que ça ne change pas

- **Le budget** : aucun coût récurrent nouveau (PostGIS et les
  bibliothèques d'import sont libres) ; l'effort d'import/validation
  s'inscrit dans la prestation déjà proposée sur la ligne
  « Structuration de l'offre de randonnée ».
- **Le calendrier** : c'est du dessin de schéma fait au bon moment —
  maintenant, avant la première ligne de code — pas une déviation.
- **La compatibilité Geotrek** : ce modèle EST le vocabulaire Geotrek
  (itinéraire, POI, service, événement) ; l'indépendance des données
  renforce la migration future au lieu de la compliquer.
