# Faire vérifier la transposition par un tiers

La transposition du classeur `Budget_CEM_Liban_LEY_Villepreux_Azour.xlsx`
vers `budget-cem-liban-azour.csv` a été faite par lecture programmatique
du fichier. Elle peut être fausse — un contresens sur une colonne, une
ligne d'action prise pour une dépense — et cela ne se verrait pas : le
résultat serait cohérent avec lui-même.

D'où ce contrôle par un tiers qui n'a pas fait le travail. Il se mène en
DEUX temps, et l'ordre n'est pas décoratif : donner les chiffres attendus
dès le départ obtient une confirmation, pas une vérification. Le premier
prompt travaille à l'aveugle.

Attacher à la conversation : le classeur Excel d'origine. Pour le second
prompt seulement, y joindre aussi `budget-cem-liban-azour.csv`.

---

## Prompt 1 — extraction à l'aveugle

> Tu as en pièce jointe un classeur de budget de projet de coopération
> décentralisée (programme CEM Liban, triade Villepreux · Azour · LEY).
>
> Je veux une extraction FIDÈLE de l'onglet « Budget à gérer », sans
> interprétation ni mise en forme créative. Ne cherche pas à corriger ce
> que tu trouves : je veux savoir ce que le fichier dit, y compris s'il
> se contredit.
>
> Réponds exactement ceci, dans cet ordre :
>
> 1. **Le tableau des dépenses.** Une ligne par dépense (pas les lignes
>    d'action, qui sont des sous-totaux — dis-moi combien tu en comptes
>    séparément), avec : intitulé, montant 2025 / 2026 / 2027 en
>    numéraire, montant 2025 / 2026 / 2027 en valorisation, et le
>    bailleur de la colonne « Nom collectivité ou partenaire bailleur ».
> 2. **Les totaux** numéraire et valorisation, par année et en cumul,
>    calculés PAR TOI à partir des lignes de dépense — pas recopiés de
>    la ligne « Total annuel » du fichier. Puis dis si ton calcul
>    coïncide avec cette ligne « Total annuel ».
> 3. **Le total numéraire par bailleur**, calculé par toi. Compare-le
>    ensuite au « Tableau des ressources » de l'onglet « Suivi budget »
>    et signale tout écart, même de quelques euros, en nommant la ou les
>    lignes qui l'expliquent.
> 4. **L'onglet « Contributions&Recettes »** : qui verse quoi, à qui,
>    pour quelle année. Dis explicitement si les lignes « TOTAL » de cet
>    onglet se déduisent des lignes qu'elles totalisent, ou non.
> 5. **Tout ce qui te paraît incohérent, ambigu ou inachevé** dans ce
>    classeur. Sois franc : ce fichier va servir de référence à un
>    compte rendu financier devant des financeurs publics.
>
> Ne me propose aucune amélioration du fichier, aucune reformulation.
> Des chiffres et des constats.

---

## Prompt 2 — confrontation

À envoyer APRÈS la réponse au prompt 1, dans la même conversation, en y
joignant `budget-cem-liban-azour.csv`.

> Voici maintenant un CSV produit par quelqu'un d'autre à partir de ce
> même classeur, destiné à être importé dans notre outil de pilotage.
> Chaque dépense du classeur y devient autant de lignes qu'elle sert
> d'années, parce que le budget de l'outil est annuel.
>
> Confronte-le à TON extraction, pas l'inverse : c'est ton relevé qui
> fait foi ici.
>
> 1. Une dépense du classeur est-elle manquante dans le CSV ? Une ligne
>    du CSV ne correspond-elle à rien dans le classeur ?
> 2. Les montants et les années coïncident-ils, ligne à ligne ?
> 3. La colonne `financeur` correspond-elle au bailleur du classeur ?
>    Attention : les noms y sont ceux de nos organisations, plus longs
>    que dans le classeur (« CD78 » y devient « Département des Yvelines
>    (CD78) », « Villepreux » devient « Commune de Villepreux »). Un nom
>    plus long n'est pas une erreur ; un bailleur CHANGÉ en est une.
> 4. La colonne `valorisation` marque-t-elle bien, et seulement, les
>    montants qui sont en valorisation dans le classeur ?
> 5. Les totaux du CSV — numéraire, valorisation, et par bailleur —
>    égalent-ils les tiens ?
>
> Termine par un verdict en une phrase : le CSV est-il une transposition
> fidèle, oui ou non, et si non, ce qu'il faut corriger.
>
> Ne réécris pas le CSV. Je veux la liste des écarts.

---

## Ce que ce contrôle devrait trouver

À ne PAS communiquer avant d'avoir la réponse — c'est la réponse
attendue, et elle sert à juger le contrôle autant que le fichier.

- 19 dépenses, 4 lignes d'action (sous-totaux), 31 lignes dans le CSV.
- Numéraire 3 050 / 28 800 / 8 850 € — total 40 700 €.
- Valorisation 1 500 / 2 500 / 3 000 € — total 7 000 €.
- Par bailleur, en numéraire : MEAE 15 550 €, CD78 14 450 €,
  Villepreux 4 500 €, YCID 3 200 €, LEY 3 000 €.
- **Écart attendu n°1** : le « Tableau des ressources » de l'onglet
  Suivi budget donne Villepreux à 4 000 € et non 4 500 €. La ligne
  « Organisation par le Conseil municipal des jeunes d'une rénovation à
  Villepreux » (500 €, 2026) manque à ce récapitulatif.
- **Écart attendu n°2** : les lignes TOTAL de l'onglet
  Contributions&Recettes (10 960 / 20 920 / 4 320) ne se déduisent pas
  des lignes au-dessus — 2025 y vaut deux fois la tranche YCID, 2027
  moins qu'elle. Formules probablement devenues fausses.

Si le contrôle ne trouve pas ces deux écarts, c'est le contrôle qui est
en défaut, pas le classeur.

---

## Résultat du contrôle — 28/08

Le prompt 1 a été passé dans Claude pour Microsoft Office (une compétence
`/audit-xls` s'est déclenchée avant l'extraction demandée ; les deux
réponses figurent au fil).

**Les deux écarts attendus ont été trouvés**, et documentés plus
précisément que je ne l'avais fait :

- Villepreux 4 500 € contre 4 000 € — la formule `Suivi budget!B81` est
  `=SUM('Budget à gérer'!E28;E35;G35;G41)` et omet `E37`. Le contrôle
  nomme la formule, là où je n'avais que le montant ;
- les lignes TOTAL de Contributions&Recettes sont saisies en dur et
  fausses : 2025 lignes 5+7 = 5 980 contre 10 960 affichés ; 2026
  5+6+7 = 22 920 contre 20 920 ; 2027 5+7 = 9 300 contre 4 320.

**Le contrôle a aussi trouvé une erreur dans MON travail** — c'est ce qui
en fait un contrôle et non une formalité : j'annonçais 22 dépenses, il y
en a **19** (23 lignes moins les 4 sous-totaux d'action). Le CSV, lui,
était juste : 31 lignes, totaux exacts. Corrigé ici et dans le README.

Et une erreur de fond dans le CSV, corrigée depuis : la colonne
`organisation_responsable` portait LEY sur toutes les lignes, alors que
« Qui décaisse » désigne Villepreux sur sept d'entre elles. Le contrôle
l'a rendue visible sans la nommer, en relevant que le bloc « Ce que
chaque partenaire doit dépenser » attribue à Villepreux exactement les
lignes 37 (500 €) et 41 (2 000 €). Après correction, le CSV redonne
2 500 € pour Villepreux et 38 200 € pour LEY — les montants mêmes de ce
bloc. Un recoupement de plus, qui ne passait pas avant.

### Ce qu'il a trouvé et que je n'avais pas vu

Par ordre de gravité pour le compte rendu financier :

1. **Les tranches YCID sont des valeurs en cache.** `J18:L18` valent
   `=$L18*J$10` … : elles multiplient par une ligne vide et `L18` se
   référence elle-même. `I5` (4 980 €) est un lien vers
   `C:\Users\joeab\Downloads\...`, non résoluble ailleurs. Les montants
   sont arithmétiquement conformes aux 15 / 60 / 25 % de 33 200 €, mais
   aucune formule ne les produit : au prochain recalcul, ils tombent.
2. **Les 33 200 € de subvention YCID ne se recoupent avec rien** :
   3 200 € comme bailleur au budget, 17 000 € au « Total YCID » du
   rappel global, 25 100 € en « géré YCID ».
3. **« Budget à gérer » n'est qu'une part du projet** : 47 700 € contre
   106 200 € au « rappel budget global », sans que rien ne le dise.
4. **Trois chiffrages du même périmètre apparent** : 40 700 € au budget,
   40 200 € au tableau des ressources, 38 200 € au bloc LEY des
   contributions — trois définitions implicites, aucune note.
5. **Le registre des dépenses est vide** : tous les cumuls de suivi
   valent 0 et tous les écarts affichent 100 % du prévu. Cohérent avec
   l'outil, qui affiche « payé 0 € ».
6. `E25` (8 200 €, la ligne la plus lourde) vaut
   `=7600+1000+800+600+700+500-3000` : six composantes non documentées et
   une déduction de 3 000 € sans justification écrite.
7. Le bailleur est orthographié « Villepreux » avec une espace finale
   sur deux lignes : deux valeurs distinctes pour Excel, donc tout tri ou
   SUMIF par bailleur les sépare. Sans effet ici — la transposition
   normalise — mais fatal à qui refait le calcul dans le classeur.

### Ce qu'il faut en retenir avant d'importer

Le CSV est fidèle au **budget** ; c'est le **classeur** qui porte des
totaux de synthèse faux, et ce sont eux qu'un financeur lit en premier.
Corriger le classeur (les cinq points critiques de l'audit) reste à faire
côté YCID/LEY, indépendamment de l'outil.

### Prompt 2 — verdict et suites

Verdict rendu : transposition **fidèle**. Les 19 dépenses et les 31
couples dépense × année sont présents, aux bons montants, aux bonnes
années, avec les bons bailleurs et un marquage valorisation exact ; les
11 agrégats coïncident au centime.

Sept réserves, dont quatre appelaient une correction — faite :

| # | Réserve | Suite donnée |
|---|---|---|
| 1 | `organisation_responsable` déduite sur les lignes 40 et 44, que le classeur ne teinte pas et dont « Qui décaisse » est vide | Colonne renseignée **uniquement** là où le classeur parle : 21 LEY, 2 Villepreux, 8 vides |
| 2 | `categorie` entièrement inventée, et incohérente en interne | Une valeur **unique** (`projet`) sur les 31 lignes — la colonne est obligatoire à l'import, le classement se fera dans l'outil |
| 3 | Colonne B du classeur (bases de calcul) perdue — dont la note de la ligne 36 qui annonce 900 € pour 450 € saisis | Reportée dans `description` : « Base de calcul : … » |
| 4 | Détail des 8 200 € perdu, puisqu'il n'existait que dans la formule | La formule `=7600+1000+800+600+700+500-3000` est reportée dans `commentaire` |
| 5 | `tache` / `montant_tache` vides | Sans objet : le classeur ne relie pas les dépenses à des tâches, l'affectation se fait dans l'outil |
| 6 | `statut` = `prevue` partout, aucune donnée d'exécution | Sans objet : le registre des dépenses du classeur est vide — c'est l'état réel du projet |
| 7 | `description` renseignée sur 3 lignes | Fidèle, et désormais sur 5 lignes de plus grâce à la réserve 3 |

Les recoupements tiennent après correction : 40 700 € de numéraire,
7 000 € de valorisation, et 2 500 € / 38 200 € de décaissement Villepreux
/ LEY — les montants mêmes du bloc « Ce que chaque partenaire doit
dépenser ».
