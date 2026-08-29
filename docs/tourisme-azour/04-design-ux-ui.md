# Plateforme touristique d'Azour — direction design UX/UI

Le parti pris : **un compagnon de sentier, pas une brochure.** L'app se
juge debout, en plein soleil, avec une barre de réseau et 12 % de
batterie — pas dans un navigateur de bureau.

## Les principes (à afficher au mur pendant tout le projet)

1. **Mobile d'abord, une main, plein soleil.** Contrastes élevés (viser
   WCAG AAA sur les informations de sécurité), cibles tactiles ≥ 48 px,
   les actions clés dans la moitié basse de l'écran.
2. **Hors-ligne par défaut.** Tout parcours ouvert une fois reste
   consultable sans réseau : trace, carte, POI, urgences. L'état
   hors-ligne est toujours visible et jamais bloquant.
3. **Trois langues à égalité, l'arabe en vrai droite-à-gauche.** Pas un
   simple `dir="rtl"` cosmétique : miroir complet de la mise en page,
   typographie arabe dessinée pour l'écran, harmonisée avec la latine
   (ex. IBM Plex Sans + IBM Plex Sans Arabic, ou Inter + Readex Pro).
4. **On accueille par l'envie, pas par la carte.** L'écran d'accueil est
   photographique et éditorial (« Aujourd'hui à Azour ») ; la carte est à
   un geste, jamais imposée d'entrée.
5. **Une fiche parcours se décide en dix secondes.** Cinq chiffres en
   tête (distance, dénivelé, durée, difficulté, altitude max), puis la
   profondeur en déroulant : récit, étapes, sécurité, GPX.
6. **Le terrain et l'app se répondent.** Chaque panneau physique porte un
   QR qui ouvre exactement la bonne page ; l'app cite les panneaux
   (« au panneau 4, prenez à droite »). La numérotation est commune.
7. **La sécurité se voit.** Eau, ombre, passages exposés, météo du jour,
   numéros d'urgence accessibles en deux gestes depuis n'importe où,
   rappel « dites à quelqu'un où vous allez ».
8. **L'humain avant l'algorithme.** Les jeunes guides ont un visage, un
   prénom et un bouton WhatsApp ; les maisons d'hôtes ont une personne,
   pas un moteur de réservation anonyme.
9. **Frugalité.** Premier chargement < 2 Mo, images servies compressées
   et redimensionnées, tuiles vectorielles, pas de vidéo en autoplay.
   Le réseau des visiteurs est précieux, leur batterie aussi.
10. **Le kiosque est la même app en grand.** Mode plein écran sur les
    tablettes budgétées, session qui se réinitialise seule, et une seule
    sortie : le QR « emportez Azour dans votre poche ».

## Identité visuelle

La palette vient du paysage — à caler sur une vraie campagne photo :

| Rôle | Piste | Inspiration |
|---|---|---|
| Primaire | vert profond | pins et chênes d'Azour |
| Secondaire | ocre/terre | terrasses, pierre chaude |
| Accent | bleu | vallée du Bisri, ciel d'altitude |
| Fond clair | blanc cassé / calcaire | la roche du Shir |
| Fond sombre | vert-noir | nuit sur la crête (mode sombre natif) |

- **Typographie** : une famille humaniste très lisible, avec sa jumelle
  arabe (voir principe 3). Chiffres tabulaires pour les stats de
  parcours.
- **Iconographie** : trait simple et constant (type Lucide), pictos
  spécifiques dessinés pour : le Shir, point d'eau, ombre, camping,
  guide, kiosque.
- **Photographie** : plein cadre, horizontons réels, personnes de dos en
  situation — jamais de banque d'images génériques.
- **Ton éditorial** : chaleureux, précis, sans superlatif touristique
  (« la plus belle vallée » n'apprend rien ; « 40 minutes d'ombre sous
  les pins, source au tiers du chemin » si).

## Architecture d'information

```
Accueil (éditorial, météo, à la une)
├── Parcours (liste ⇄ carte, filtres : durée, difficulté, thème)
│   └── Fiche parcours
│       ├── Mode « sur le sentier » (position, prochain point, panneaux)
│       └── POI du parcours (dont le Shir)
├── Explorer (tous les POI : patrimoine, points de vue, camping)
├── Pratique (dormir · manger · guides · s'y rendre · urgences)
├── Agenda (trail d'Azour, événements, saisons)
└── À propos (le projet, les jeunes, les partenaires, l'histoire)
```

## Les six écrans à maquetter en premier

1. **Accueil** — photo du Shir plein écran, salutation trilingue, météo,
   3 parcours mis en avant, accès kiosque/urgences.
2. **Liste des parcours** — cartes visuelles avec les 5 chiffres clés et
   l'état hors-ligne, bascule liste/carte.
3. **Fiche parcours** — le cœur du produit (voir principe 5) : en-tête
   photo, stats, profil altimétrique, étapes numérotées comme les
   panneaux, bouton « télécharger pour le sentier ».
4. **Mode sentier** — carte plein écran, ma position, distance restante,
   prochain point d'intérêt, urgences à un geste.
5. **POI Shir** — le site emblématique : récit court, photos, « comment
   y aller », lien panneau ↔ QR.
6. **Kiosque** — plein écran paysage, très grandes cibles, choix de
   langue immédiat, parcours du jour, QR de sortie.

## Design system (socle technique du design)

- Tokens : couleurs sémantiques (fond, encre, accent, danger, réussite),
  échelle d'espacement 4 px, rayons, ombres discrètes, deux thèmes
  (clair/sombre) définis dès le premier jour.
- Composants clés : carte-parcours, badge difficulté (échelle à définir
  et à afficher assumée), profil altimétrique, pastille POI, bandeau
  hors-ligne, bloc urgence, sélecteur de langue (toujours visible au
  kiosque, discret sur mobile).
- Cartographie : fond OpenStreetMap/relief via MapLibre, style
  personnalisé aux couleurs de la marque, courbes de niveau sur les
  fiches parcours.

## Ce que « outil de pointe » veut dire ici

Pas un empilement de fonctionnalités : la pointe, c'est l'exécution —
hors-ligne irréprochable, trilingue natif, photos superbes, cohérence
panneau/app/kiosque, et une V2 qui pourra accueillir audio-guides,
avis, réservation quand l'usage l'aura demandé.
