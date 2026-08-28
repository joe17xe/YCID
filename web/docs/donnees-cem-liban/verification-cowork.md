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

- 22 dépenses, 4 lignes d'action (sous-totaux), 31 lignes dans le CSV.
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
