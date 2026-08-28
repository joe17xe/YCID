# Budget CEM Liban — Villepreux · Azour · LEY

Ce dossier contient les données du classeur
`Budget_CEM_Liban_LEY_Villepreux_Azour.xlsx` transposées au format que
l'application sait lire, et de quoi corriger ce qui a déjà été saisi.

Il ne remplace pas le classeur : celui-ci reste la source. Ce qui est ici
est une **transcription**, avec des choix explicites, listés plus bas.

## Ce que contient le classeur

L'onglet « Budget à gérer » porte **19 dépenses** réparties en quatre
regroupements — Action 1, Action 2, Action 3 et « Autres dépenses », qui
sont des sous-totaux et non des dépenses —, chacune avec un montant par
année (2025, 2026, 2027), en numéraire ou en valorisation, et le
**bailleur** en colonne « Nom collectivité ou partenaire bailleur ».
C'est cette colonne qui manque en base.

⚠️ **Cet onglet n'est pas tout le projet.** L'onglet « rappel budget
global » totalise 106 200 € (92 700 € de numéraire + 13 500 € de
valorisation) contre 47 700 € ici. « Budget à gérer » est le périmètre
géré par LEY/Azour et Villepreux ; le CSV ci-dessous ne couvre que
celui-là. Rien dans le classeur ne dit ce rapport — c'est le contrôle
tiers qui l'a établi.

Totaux du classeur, retrouvés à l'identique après transposition :

| | 2025 | 2026 | 2027 | total |
|---|---|---|---|---|
| Numéraire | 3 050 € | 28 800 € | 8 850 € | **40 700 €** |
| Valorisation | 1 500 € | 2 500 € | 3 000 € | **7 000 €** |

Par bailleur (numéraire), la transposition redonne exactement le
« Tableau des ressources » de l'onglet *Suivi budget* — MEAE 15 550 €,
CD78 14 450 €, YCID 3 200 €, LEY 3 000 € — **à une exception près** :

> Villepreux ressort à **4 500 €** ici, contre 4 000 € dans le tableau
> des ressources du classeur. L'écart de 500 € est la ligne « Organisation
> par le Conseil municipal des jeunes d'une rénovation à Villepreux »
> (2026, bailleur Villepreux), qui semble absente du récapitulatif.
> **C'est une incohérence interne au classeur**, pas un défaut de
> transposition : à trancher côté YCID/LEY avant de figer le budget.

## Les fichiers

### `budget-cem-liban-azour.csv`

31 lignes prêtes pour **Import ▸ Lignes budgétaires** (séparateur `;`).
Une ligne de dépense du classeur donne autant de lignes qu'elle a
d'années servies — le budget de l'application est annuel, le classeur est
en colonnes par année.

Prérequis, sinon l'import refuse les lignes concernées :

1. le projet doit exister sous le nom exact
   `CEM Liban — Triade Villepreux · Azour · LEY` ;
2. les phases doivent exister sous les intitulés d'action du classeur
   (colonne `phase` du CSV) — **importer les phases d'abord** ;
3. les organisations doivent exister sous ces noms **exacts** :
   `MEAE`, `YCID`, `Département des Yvelines (CD78)`,
   `Commune de Villepreux`, `Libanais en Yvelines (LEY)`.

Le rapprochement se fait sur le nom, insensible à la casse et aux
accents, mais **pas** aux mots manquants : `CD78` ne vaut pas
`Département des Yvelines (CD78)`. Si vos organisations portent d'autres
noms, corrigez la colonne `financeur` du CSV — c'est plus sûr que de
renommer les organisations, qui servent ailleurs.

Choix de transcription, à relire :

- `categorie` — le classeur n'en a pas. Règle appliquée : justificatif
  mentionnant du matériel → `investissement` ; « Mise à disposition » et
  remboursements de frais → `fonctionnement` ; tout le reste → `projet`.
  Rien n'empêche de la corriger dans le CSV avant import.
- `organisation_responsable` — lu dans la colonne « Qui décaisse » :
  LEY sur 24 lignes, Commune de Villepreux sur 7 (la rénovation du CMJ,
  la délégation au trail, le trail de Villepreux et la mise à
  disposition communale). Le transfert progressif à Azour
  (`LEY puis Azour`) ne s'exprime dans aucune colonne de l'outil : il est
  dit en commentaire. **Contrôle de cohérence** : le numéraire décaissé
  par Villepreux ressort à 2 500 € et celui de LEY à 38 200 €, soit
  exactement le bloc « Ce que chaque partenaire doit dépenser » de
  l'onglet Contributions&Recettes.
- `commentaire` — reprend les justificatifs attendus et le circuit de
  décaissement du classeur, qui sont l'information de contrôle.
- `statut` — `prevue` partout : rien n'indique dans le classeur qu'une
  ligne serait déjà engagée.
- `tache` — vide. Le classeur ne relie pas les dépenses à des tâches ;
  l'affectation ligne → tâche se fait dans l'application, où elle pilote
  l'avancement pondéré.

### `appels-de-fonds-cem-liban.csv`

⚠️ **À saisir en connaissance de cause.** Le contrôle tiers a établi que
les montants des tranches YCID (4 980 / 19 920 / 8 300 €) sont des
**valeurs en cache** : les formules qui les portent sont cassées
(référence circulaire, multiplication par une ligne vide) et la première
cellule est un lien vers un fichier local d'un poste de travail. Elles
sont arithmétiquement conformes à 33 200 € × 15 / 60 / 25 %, mais aucune
formule du classeur ne les produit — au prochain recalcul complet, elles
tombent. Le rattachement tranche → année repose de surcroît sur des
pourcentages décalés d'une colonne par rapport aux en-têtes d'années.
Ces montants sont donc **à faire confirmer par YCID** avant d'engager
une relance sur leur base.

Deuxième réserve, plus lourde : **les 33 200 € de subvention YCID ne se
recoupent avec aucun autre total du classeur** — YCID pèse 3 200 € comme
bailleur dans « Budget à gérer », 17 000 € au « Total YCID » de
« rappel budget global », 25 100 € en « géré YCID ». Quatre chiffres pour
une même subvention.

Les promesses de versement lues dans l'onglet
« Contributions&Recettes ». **Il n'existe pas d'import pour les appels de
fonds** : ces 9 lignes se saisissent à la main dans l'onglet Budget,
section « Appels de fonds ». Le fichier sert de bordereau de saisie.

- YCID → LEY : 4 980 € (2025), 19 920 € (2026), 8 300 € (2027) —
  subvention de 33 200 € versée par tranches de 15 / 60 / 25 %, selon
  décaissements ;
- Commune de Villepreux → LEY : 2 000 € (2026) ;
- LEY, réservé pour le projet : 1 000 € par an ;
- Commune de Villepreux, réservé : 500 € (2026) et 2 000 € (2027).

> Réserve de lecture : la ligne « TOTAL » de cet onglet
> (10 960 / 20 920 / 4 320) ne se déduit pas des lignes au-dessus —
> 2025 y vaut deux fois la tranche YCID, 2027 moins qu'elle. Les totaux
> paraissent être des formules devenues fausses. Les montants
> **par partenaire** sont cohérents entre eux et avec la subvention de
> 33 200 € ; ce sont eux qui ont été repris. À confirmer avant de s'en
> servir en COPIL.

### `rattrapage-financeurs.sql`

Pour les lignes budgétaires **déjà saisies** sans financeur : un
diagnostic (que se passe-t-il, et pourquoi l'écran dit « Non affecté »),
puis une correction en deux temps — on regarde d'abord ce qui serait
écrit, on écrit ensuite. À exécuter dans le SQL Editor Supabase.

## Réimporter ou corriger ?

- **Corriger** (le script SQL, ou les lignes une à une dans l'écran
  Budget) si les lignes actuelles sont bonnes et qu'il ne leur manque que
  le bailleur. C'est le cas le plus probable, et le moins destructeur.
- **Réimporter** le CSV si les montants ou le découpage par année ne
  correspondent pas au classeur. Dans ce cas, **supprimer d'abord les
  lignes existantes** : l'import crée, il ne met pas à jour, et deux
  passages font deux budgets.
