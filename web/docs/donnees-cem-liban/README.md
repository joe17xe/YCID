# Budget CEM Liban — les trois volets

Transcription du classeur `Budget_CEM_Liban_LEY_Villepreux_Azour.xlsx`
au format que l'application sait lire. Le classeur reste la source ; ce
qui est ici est une transposition, avec des choix explicites, listés.

## Le périmètre : 106 200 €, et non 47 700 €

Une première version ne reprenait que l'onglet « Budget à gérer » —
47 700 €, la part gérée par LEY/Azour. C'était un contresens :
**l'onglet « rappel budget global » porte le budget entier, 106 200 €,
soit les trois volets du programme**. Arbitrage du 28/08 : l'application
gère les trois, toutes les lignes doivent y être, correctement affectées.

| | numéraire | valorisation | total | lignes |
|---|---|---|---|---|
| Triade Villepreux · Azour · LEY | 40 700 € | 8 500 € | **49 200 €** | 32 |
| Triade Jouy-en-Josas · Jeïta · Comité | 26 900 € | 3 000 € | **29 900 €** | 21 |
| Coordination et actions communes (YCID) | 25 100 € | 2 000 € | **27 100 €** | 12 |
| **Total** | **92 700 €** | **13 500 €** | **106 200 €** | **65** |

Les totaux du classeur (`rappel budget global` B67:B69) sont retrouvés à
l'euro. Et les **huit totaux par partenaire** du classeur (B71:B79) le
sont aussi, valorisation comprise :

MEAE 51 200 · CD78 15 000 · YCID 17 000 · Villepreux 8 500 ·
LEY 6 000 · Jouy-en-Josas 3 000 · Comité de Jumelage 2 500 ·
Azour 1 500 · Jeïta 1 500.

Le découpage en trois se recoupe enfin avec le bloc « Ce que dépense
chaque partenaire » (colonnes O:S) : LEY/Azour 38 200 + Villepreux 2 500
= 40 700 pour Azour ; Comité/Jeïta 26 400 + Jouy 500 = 26 900 pour
Jeïta ; YCID 25 100 pour le commun. Trois lectures indépendantes du même
classeur, trois fois le même résultat.

## Comment chaque ligne est affectée

Le classeur porte un **code couleur de gestion** (légende ligne 17 :
« dépenses gérées par LEY/Azour », « par Comité/Jeïta », « par YCID »,
« par Villepreux », « par Jouy »). C'est la seule information présente
sur toutes les lignes colorées — y compris celles dont la colonne
« Qui décaisse » est vide. C'est donc elle qui affecte, et la colonne
« Qui décaisse » qui corrobore. Les deux ne se contredisent jamais.

Villepreux rejoint la triade d'Azour et Jouy-en-Josas celle de Jeïta :
ce sont les communes françaises de chaque jumelage.

Trois cas ont demandé un arbitrage, et aucun n'est masqué — chaque ligne
concernée le dit dans son commentaire :

1. **Les six lignes sans code couleur** sont rattachées d'après leur
   bailleur : cérémonie d'inauguration à Azour (1 500 € en nature,
   bailleur Azour) → Azour ; la même à Jeïta → Jeïta ; trail de
   Villepreux et Jouy (2 000 € en nature, bailleur Villepreux) → Azour ;
   mises à disposition du Comité → Jeïta, de Villepreux et de LEY →
   Azour.
2. **Les réunions de travail et COPIL** (1 100 €) portent une teinte
   intermédiaire et la mention « réparti pour facilité logistique » :
   partagées moitié-moitié par année entre les deux triades, comme le
   fait l'onglet « Budget à gérer » (50 / 250 / 250).
3. **Les visites de terrain par un spécialiste** (900 €) sont teintées
   des DEUX couleurs, 450 € en 2026 et 450 € en 2027. Chaque triade en
   porte 450 € ; **l'année attribuée à chacune est un choix de
   transposition** — 2027 pour Azour, comme l'onglet « Budget à gérer »,
   2026 pour Jeïta. Le total est juste, la répartition par année est à
   confirmer.

## Les fichiers, et l'ordre d'import

L'import crée, il ne met pas à jour : deux passages font deux budgets.
Vérifier que rien n'existe déjà avant de commencer.

1. **Les projets** doivent exister sous ces noms exacts — ce sont ceux
   des trois volets :
   - `CEM Liban — Triade Villepreux · Azour · LEY`
   - `CEM Liban — Triade Jouy-en-Josas · Jeïta · Comité de Jumelage`
   - `CEM Liban — Coordination et actions communes`
2. **Les organisations** aussi, sous ces noms exacts : `MEAE`, `YCID`,
   `Département des Yvelines (CD78)`, `Commune de Villepreux`,
   `Commune de Jouy-en-Josas`, `Libanais en Yvelines (LEY)`,
   `Comité de Jumelage de Jouy-en-Josas`, `Municipalité d'Azour`,
   `Municipalité de Jeïta`. Le rapprochement ignore la casse et les
   accents, pas les mots manquants : `CD78` ne vaut pas
   `Département des Yvelines (CD78)`.
3. **`phases-cem.csv`** — Import ▸ Phases. Les 10 phases des trois
   projets. Dates et statuts volontairement vides : le classeur n'en
   porte pas, et une date inventée vaut moins qu'une date absente.
4. **`budget-cem-azour.csv`**, **`budget-cem-jeita.csv`**,
   **`budget-cem-commun.csv`** — Import ▸ Lignes budgétaires, un fichier
   par projet. Une dépense donne autant de lignes qu'elle sert d'années :
   le classeur est en colonnes par année, le budget de l'outil est
   annuel.
5. **`appels-de-fonds-cem-liban.csv`** — pas d'import : bordereau de
   saisie à la main, section « Appels de fonds » de l'onglet Budget.

`rattrapage-financeurs.sql` sert au cas où des lignes ont déjà été
saisies sans financeur — diagnostic puis correction en deux temps.

## Choix de transcription

Règle unique, tirée du contrôle tiers du 28/08 (voir
`verification-cowork.md`) : **le CSV ne dit rien que le classeur ne
dise.** Une colonne que la source ne renseigne pas reste vide plutôt
qu'être déduite.

- `categorie` — le classeur n'en porte aucune. La colonne est obligatoire
  à l'import : elle porte donc une valeur **unique**, `projet`, sur les
  65 lignes. Une valeur uniforme n'est pas une classification ; elle
  laisse le classement se faire dans l'outil, par ceux qui savent, et se
  lit d'un coup d'œil comme « pas encore classé ».
- `organisation_responsable` — la colonne « Qui décaisse », et seulement
  là où elle est renseignée. Vide ailleurs.
- `description` — les puces détaillées de l'intitulé, et la **colonne B**
  du classeur (quantités et bases de calcul) sous la forme « Base de
  calcul : 150 euros par session, 3 sessions à Azour et 3 sessions à
  Jeita ». C'est elle qui rend visible que cette ligne annonce 900 €
  pour 450 € saisis.
- `commentaire` — justificatifs attendus, circuit de décaissement, la
  **formule d'origine** quand le montant en est une (les 8 200 € de
  l'aménagement du Shir valent `=7600+1000+800+600+700+500-3000` au
  classeur), et la mention d'arbitrage pour les lignes partagées ou
  déduites.
- `statut` — `prevue` partout. L'onglet « Registre des dépenses » du
  classeur est vide : après import, le réalisé sera nul et les écarts
  égaux à 100 % du prévu. C'est l'état réel du projet.
- `tache` et `montant_tache` — vides. Le classeur ne relie pas les
  dépenses à des tâches ; l'affectation ligne → tâche se fait dans
  l'application, où elle pilote l'avancement pondéré.

## Réserves à connaître avant tout compte rendu

Établies par le contrôle tiers, et portant sur le **classeur**, pas sur
la transposition :

1. **Les tranches YCID sont des valeurs en cache.** Les formules qui les
   portent sont cassées (référence circulaire en `L18`, multiplication
   par une ligne vide) et la première cellule est un lien vers un fichier
   local. Elles sont conformes à 33 200 € × 15 / 60 / 25 %, mais aucune
   formule ne les produit : au prochain recalcul, elles tombent.
2. **Les 33 200 € de subvention YCID ne se recoupent avec rien** :
   15 000 € de numéraire comme bailleur, 17 000 € avec la valorisation.
3. **Cinq lignes « TOTAL » sont saisies en dur et fausses** dans l'onglet
   Contributions&Recettes — ce sont les lignes de synthèse qu'un
   financeur lit en premier.
4. **Le tableau des ressources de « Suivi budget » omet 500 €** (la
   formule `B81` ne référence pas la ligne du CMJ de Villepreux). Il
   totalise 40 200 € au lieu de 40 700 €.

Ces quatre points se corrigent dans le classeur, côté YCID/LEY, et
n'attendent pas l'outil.

## Les appels de fonds

Les 9 promesses lues dans « Contributions&Recettes ». Il n'existe pas
d'import pour les appels de fonds : ces lignes se saisissent à la main.

- YCID → LEY : 4 980 € (2025), 19 920 € (2026), 8 300 € (2027) —
  subvention de 33 200 € par tranches de 15 / 60 / 25 %, selon
  décaissements. **À faire confirmer par YCID** avant toute relance :
  voir la réserve n°1.
- Commune de Villepreux → LEY : 2 000 € (2026) ;
- LEY, réservé pour le projet : 1 000 € par an ;
- Commune de Villepreux, réservé : 500 € (2026), 2 000 € (2027).
