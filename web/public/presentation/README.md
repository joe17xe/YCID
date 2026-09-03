# Support de présentation aux partenaires

`communes.html` — 30 diapositives, 30 minutes, pour la séance de prise en
main d'une commune partenaire (première tenue : Jouy-en-Josas et Jeïta,
triade du programme CEM Liban–Yvelines).

Fichier **statique et autonome** : un seul HTML, aucune dépendance hors
les polices Google (et il reste lisible sans elles, hors ligne). Servi
par Next.js depuis `public/`, donc **sans connexion** — il s'ouvre depuis
le vidéoprojecteur d'une mairie, ou depuis un fichier téléchargé si le
wifi de la salle est mauvais. Un lien y mène depuis la page Aide.

    https://ycid.joefr.cloud/presentation/communes.html

## Pendant la présentation

| Touche | Effet |
|---|---|
| `→` `espace` `Entrée` | diapositive suivante (un clic dans la page aussi) |
| `←` | précédente |
| `S` | sommaire cliquable |
| `N` | **notes du présentateur** — le minutage, les points à insister, les questions attendues |
| `T` | démarre / remet à zéro le chrono (il vire à l'orange après 30 min) |
| `P` | plein écran |

**PDF** : `Ctrl/⌘ + P` → une diapositive par page, en paysage 1280 × 720.
Les notes ne s'impriment pas ; le numéro de page, si.

## Remplacer une reconstitution par une vraie capture

Les écrans de la visite guidée sont des **reconstitutions** en HTML/CSS :
mêmes couleurs, mêmes libellés, mêmes badges que l'application, avec les
données réelles du volet Jouy · Jeïta. Elles ont un avantage sur une
capture — elles ne périment pas au prochain changement de nom d'onglet —
et un défaut : ce ne sont pas des captures.

Pour en remplacer une, **aucune modification du HTML n'est nécessaire** :
déposer un PNG dans `captures/` sous le nom déclaré par la diapositive.
Si le fichier existe, il remplace la reconstitution au chargement ;
sinon la reconstitution reste. Les noms attendus :

| Fichier | Écran |
|---|---|
| `connexion.png` | page de connexion |
| `dashboard.png` | tableau de bord |
| `projet-apercu.png` | fiche projet, onglet Aperçu |
| `projet-taches.png` | onglet Tâches |
| `projet-budget.png` | onglet Budget |
| `a-valider.png` | file « À valider » |
| `appels-de-fonds.png` | appels de fonds |
| `documents.png` | onglet Documents |
| `impact.png` | onglet Impact |

Capture au format paysage, largeur ≥ 1400 px, **sans données personnelles
d'un compte réel** : le support circule hors de l'application.

## Adapter à une autre commune

Trois endroits, et rien d'autre :

1. la **couverture** (diapositive 1) — les noms des partenaires et la date ;
2. la diapositive **« Votre volet, tel qu'il est dans l'outil »** — les
   montants du volet concerné (source : `web/docs/donnees-cem-liban/`) ;
3. la diapositive **« Ce qu'on vous demande »** — les trois colonnes
   d'engagements, une par organisation présente.

Les chiffres affichés viennent de la transposition du classeur
budgétaire du programme, vérifiée ligne à ligne : volet Jouy-en-Josas ·
Jeïta · Comité de Jumelage, 26 900 € en numéraire et 3 000 € en
valorisation, 21 lignes.
