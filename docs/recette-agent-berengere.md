# Recette automatisée — profil Bérengère Ayoub (Product Owner, YCID)

> **Destiné à un agent Claude pilotant un navigateur.** La session est
> déjà connectée avec le compte de Bérengère Ayoub. N'essaie pas de
> changer de compte.

## ⚠️ À exécuter APRÈS la recette de Maria Maroun

Le test B5 valide un devis que Maria dépose dans sa propre session. Si
elle ne l'a pas encore fait, B5 sera `BLOQUÉ` — et ce sera normal.

## Règles absolues

1. **N'invente aucun résultat.** Une étape non exécutée donne `BLOQUÉ`,
   jamais `OK`.
2. **Rapporte ce que tu vois**, en recopiant les montants et libellés
   exacts.
3. **Interdits** : supprimer un projet ; supprimer une pièce, une ligne
   ou une tâche que tu n'as pas créée ; modifier un montant voté ;
   modifier le rôle d'un membre.
4. **Un test DOIT échouer** — B6. Un refus y est le résultat attendu.
5. **Ce compte a un profil inhabituel** : Bérengère est **auditrice**
   (lecture seule) sur deux projets, mais **membre d'YCID**. Elle peut
   donc **valider un devis** sans pouvoir créer quoi que ce soit sur le
   projet. Ce n'est pas une contradiction : décider vient de
   l'organisation, agir vient du rôle projet. Ne signale pas cela comme
   un défaut.

---

## B1 — Menu de navigation

**Étapes** : affiche le menu latéral.

**Attendu** : **Tableau de bord, Projets, À valider, Organisations,
Import, Pilotage, Roadmap, Aide**.

**Critère `KO`** : présence d'une section **Administration**.

**À reporter** : la liste exacte des entrées.

## B2 — Périmètre : les trois projets

**Étapes** : menu **Projets**, puis menu **Pilotage**.

**Attendu** : **3 projets** dans les deux écrans.

**Critère `KO`** : moins de 3 projets — cela signifierait que le
rattachement de Bérengère à l'organisation YCID n'a pas été fait.

**Puis** : ouvre chaque projet → onglet **Aperçu** → relève le rôle de
Bérengère.

**Attendu** : **Auditeur** sur deux projets, **Responsable financier**
sur un troisième.

**À reporter** : le nombre de projets, et le rôle relevé sur chacun.

## B3 — Arbitrage de la roadmap

**Étapes** : menu **Roadmap** → ouvre une idée → fais défiler jusqu'en
bas de la page, sous le bloc « Fiche ».

**Attendu** : un panneau **« Gestion produit »** avec statut, priorité
et difficulté modifiables.

**Puis** : change la priorité, enregistre, **puis remets la valeur
d'origine**.

**Critère `KO`** : le panneau est absent.

**À reporter** : présence du panneau, et si la modification a été
acceptée puis annulée.

## B4 — Participation à la roadmap

**Étapes** :

1. Vote pour une idée → relève le compteur → vote de nouveau pour
   annuler → relève le compteur.
2. Ajoute un commentaire sur une idée.
3. Crée une idée intitulée `Test agent — à supprimer`, puis
   **supprime-la**.

**Attendu** : le compteur monte puis redescend ; le commentaire apparaît
au nom de Bérengère Ayoub ; l'idée créée est bien supprimable.

**À reporter** : les valeurs du compteur, et si les trois actions ont
abouti.

## B5 — ⭐ Valider un devis (dépend de Maria)

**Étapes** : ouvre le projet **CEM Liban — Coordination et actions
communes** → onglet **Budget** → trouve la ligne portant un devis de
300 € déposé par Maria Maroun → icône **trombone 📎**.

**Si aucun devis de 300 € n'existe** : verdict `BLOQUÉ — Maria n'a pas
encore déposé`. Passe au test suivant.

1. Relève la valeur de la colonne **Engagé** de cette ligne.
2. Vérifie la présence des boutons **Valider** et **Refuser**.
3. Clique **Valider**.
4. Relève de nouveau la valeur d'**Engagé**.

**Attendu** : Engagé passe de `0 €` à **`300 €`**.

**Critère `KO` déterminant** : Engagé ne bouge pas. C'est le cœur du
pilotage financier ; signale-le en premier.

**À reporter** : Engagé avant, Engagé après, et le libellé de l'étape
affichée à côté de l'organisation.

## B6 — ⚠️ TEST QUI DOIT ÉCHOUER

**Ce test vérifie une INTERDICTION. Une absence de bouton est le
résultat attendu.**

**Étapes** : ouvre le projet **CEM Liban — Triade Villepreux · Azour ·
LEY** → onglet **Budget** → une ligne portant une pièce dont
l'organisation sollicitée **n'est pas YCID** → trombone 📎.

**Attendu** : la pièce et son état sont visibles, mais **aucun bouton de
décision** : ni Valider, ni Refuser, ni « Valider à sa place… ».

**Verdict `OK`** = aucun bouton de décision.
**Verdict `KO`** = un bouton de décision est proposé.

**À reporter** : le nom de l'organisation sollicitée, et la liste exacte
des boutons visibles (ou « aucun »).

## B7 — La file « À valider »

**Étapes** : menu **À valider**.

**Attendu** : soit une liste de devis en attente d'une décision d'YCID,
soit le message « Rien n'attend votre décision ». Chaque ligne indique
le montant, le projet, la ligne budgétaire et « Sollicite … ».

**Si tu as validé le devis en B5** : il ne doit **plus** figurer dans
cette liste.

**À reporter** : le nombre d'éléments, et si le devis validé en B5 a
bien disparu.

## B8 — Rapport d'expert IA

**Étapes** : sur un projet → **Rapport d'expert IA** → **Générer**.
Compte jusqu'à 90 secondes.

**Attendu** : un rapport avec, en en-tête, « Périmètre analysé : N
phase(s) ».

**Critère `KO` déterminant** : **N vaut 0**.

**Puis** : vérifie que la section listant les **décisions** n'est pas
vide si le projet en comporte (onglet COPIL du même projet).

**À reporter** : la valeur de N, le nombre de sections, et si la section
décisions est cohérente avec l'onglet COPIL.

---

## Tests réservés à un humain — ne pas tenter

- Affichage sur téléphone réel.
- Jugements de valeur : « ce rapport est-il présentable en COPIL »,
  « ces six libellés budgétaires sont-ils clairs sans explication ».

---

## Format du rapport final

| Test | Verdict | Observation |
|---|---|---|
| B1 | OK / KO / BLOQUÉ | … |
| … | | |

Puis, obligatoirement :

1. **Les valeurs relevées** : nombre de projets (B2), rôle par projet
   (B2), **Engagé avant et après (B5)**, organisation sollicitée (B6),
   N du rapport (B8).
2. **Les écarts** : pour chaque `KO`, l'attendu, le constaté, et le
   message exact.
3. **Ce que tu n'as pas pu faire**, et pourquoi.
4. **Confirmation** : la priorité modifiée en B3 a bien été remise à sa
   valeur d'origine, et l'idée de test de B4 a bien été supprimée.
