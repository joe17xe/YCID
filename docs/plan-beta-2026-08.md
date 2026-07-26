# Plan bêta — semaine du 27/07, recette le 03/08

Décision du 26/07 : la recette est décalée d'une semaine pour livrer une
bêta **solide et cohérente** plutôt qu'une bêta complète.

Ce plan ne cherche donc pas à ajouter des fonctions. Il cherche à ce que
ce qui existe **dise la vérité**, tienne sous la main de quelqu'un
d'autre que son auteur, et résiste à la prochaine modification.

---

## Le constat qui gouverne ce plan

Neuf PR déployées, **zéro test automatisé**, aucun script de test dans
`package.json`. Toutes les pannes récentes ont été trouvées par lecture
humaine ou par l'utilisateur en production. Aucune n'a été trouvée par
la machine.

| # | Panne | Découverte par |
|---|---|---|
| 1 | Rapport IA généré « sur 0 phase », sans erreur (colonne `phases.budget` supprimée) | relecture, 1 jour après |
| 2 | Mise en validation en échec silencieux : devis déposé, circuit jamais amorcé | relecture, la veille de la recette |
| 3 | `lib/rbac.ts` en désaccord avec les policies RLS — l'écran des droits ment | relecture, 26/07 |
| 4 | Migration 0036 inopérante (`is_platform_admin` valait « pas un utilisateur ordinaire ») | relecture, avant application |
| 5 | Commit perdu, déploiement annoncé à tort | l'utilisateur |
| 6 | Force-push effaçant le contenu d'une branche | l'utilisateur |
| 7 | Huit commits poussés sans PR ouverte — l'écran attendu n'était pas en ligne | l'utilisateur |
| 8 | Protocole de test M7 et M8 contradictoires | le testeur |

Trois familles s'en dégagent, et elles appellent trois remèdes
différents :

- **1, 2 — la panne muette.** Le système répond « c'est fait » alors que
  rien n'a eu lieu. C'est la plus dangereuse : elle se découvre en
  réunion, devant un financeur.
- **3, 4 — la vérité en plusieurs exemplaires.** Deux copies d'une même
  règle finissent toujours par diverger.
- **5, 6, 7 — la livraison.** Ni bug ni conception : de la méthode.

**Une bêta n'est pas solide parce qu'elle a plus de fonctions. Elle est
solide parce qu'une régression y est détectée avant l'utilisateur.**

---

## J1 (27/07) — Une seule source de vérité pour les droits

### Le problème

La règle « qui peut quoi » existe en **trois exemplaires** : 62
occurrences dans les policies SQL, 79 dans le code applicatif, et la
matrice d'affichage `lib/rbac.ts`. Cette dernière annonce elle-même que
« les règles vivent ailleurs » : elle décrit sans gouverner.

Elles ont déjà divergé :

| La matrice affiche | La réalité |
|---|---|
| `documents.upload` → tous les rôles | `can_upload_document()` exclut validateur, auditeur, lecteur |
| `validations.decide` → `validateur` | depuis la 0036 : membre de l'organisation sollicitée, ou admin. Le rôle « Validateur » ne valide plus rien |

Et **validateur, auditeur et lecteur sont aujourd'hui identiques** :
aucun contrôle de l'application ne les distingue. Trois libellés, un
comportement.

### Le travail

1. `lib/rbac.ts` devient la source que lisent **aussi** les drapeaux de
   la page projet (`canPhases`, `canTasks`, `canBudget` — trois tableaux
   recopiés). Le SQL reste maître pour la sécurité : c'est sa place. Ce
   qui disparaît, c'est l'opinion séparée de l'application.
2. Correction des deux divergences ci-dessus.
3. Arbitrage sur les trois rôles vides *(décision attendue, voir fin de
   document)*.
4. **Le test qui rend tout cela durable** : un test compare
   `RBAC_MATRIX` aux policies SQL et échoue si l'un bouge sans l'autre.
   C'est lui le vrai livrable de la journée — sans lui, les copies
   divergeront de nouveau dans trois semaines.

### Ce qu'on ne fait pas

**Pas de rôles paramétrables.** Nos règles réelles — le déposant ne
valide pas son propre devis, décide qui est membre de l'organisation
sollicitée, unanimité, procuration motivée — sont des **relations entre
une personne et un objet**, pas des cases dans une grille rôle ×
capacité. Un paramétrage naïf les aplatirait : on gagnerait des cases à
cocher en perdant ce qui protège l'argent public.

La preuve est déjà là : `validation_rules`, brique paramétrable conçue
dans la 0001, **n'a jamais reçu une seule ligne** en un an. Sept rôles
pour trois projets et onze comptes — le besoin n'est pas là. Il le
deviendra quand une autre collectivité reprendra l'outil. Une matrice
unique rend ce jour-là facile : remplir une table, au lieu de réécrire
141 points.

---

## J2 (28/07) — Le filet de sécurité

Trois tests, choisis pour couvrir exactement les pannes déjà subies —
pas pour faire du chiffre de couverture.

| Test | Panne qu'il aurait attrapée |
|---|---|
| Toute colonne d'un `.select()` explicite existe au schéma | **#1** — le rapport IA sur 0 phase |
| `RBAC_MATRIX` == policies RLS | **#3, #4** — la matrice qui ment |
| Parcours par rôle : ce que voit et peut un chef de projet, un terrain, un lecteur | les régressions de la refonte des rôles |

Plus la **CI sur chaque PR** : `tsc --noEmit`, `npm run build`, ces
tests. Aujourd'hui rien ne tourne avant un merge.

Et une **règle de livraison** écrite, pour les pannes 5-6-7 : vérifier
`git merge-base --is-ancestor` avant d'annoncer un déploiement, et ne
jamais annoncer sur la foi d'un push. C'est déjà ma pratique depuis
l'incident ; ce n'est pas encore une règle du dépôt.

---

## J3 (29/07) — Le circuit qui tourne pour de vrai

**Lot indissociable.** L'unanimité et les notifications se déploient
**ensemble**, jamais l'une sans l'autre.

Raison : l'unanimité arbitrée le 25/07 rend une organisation silencieuse
**bloquante** pour l'engagé. Sans file d'attente ni email, personne ne
sait qu'on l'attend. Livrer l'unanimité seule rendrait l'application
**pire qu'aujourd'hui**.

1. **Email entièrement configurable** — migration `email_settings`,
   écran Configuration ▸ Email (SMTP, expéditeur, marche/arrêt, bouton
   test), `lib/mailer.ts`. Repli silencieux tant que rien n'est
   configuré. Jamais de secret en dur, même motif que la configuration
   IA (0023).
2. **File « À valider »** — aujourd'hui il faut ouvrir projet par
   projet, ligne par ligne, le dialogue de pièces pour découvrir qu'une
   décision attend. Un validateur qui ne fouille pas ne validera jamais.
3. **Notifications** : soumission → organisation sollicitée ; décision →
   déposant ; tâche terminée → responsable projet.
4. **Unanimité** : un devis n'est engagé que si **chaque** organisation
   sollicitée a validé ; un refus rejette.

---

## J4 (30/07) — Les trous béants

Trois manques qui n'ont pas de contournement.

1. **Dépôt de pièce au niveau projet.** La 38a a élargi le rattachement,
   mais l'interface ne propose le dépôt que sur une tâche, une ligne ou
   une photo de phase. Une **convention de financement** — la pièce
   fondatrice du projet — n'a nulle part où aller.
2. **Édition de la fiche projet**, dont le **montant voté**. C'est LA
   référence du pilotage financier depuis la 0033, et une erreur de
   saisie à la création est aujourd'hui définitive. Figée par accident,
   pas par choix. Tracée au Journal.
3. **« Budget (€) » → « Montant voté (€) »** partout où le chiffre
   apparaît, pour ancrer la sémantique.

Puis les deux règles restantes du 25/07, courtes :

4. **Plancher de pondération à 2 %** — une tâche à 0 € pèse au moins
   2 %, pour qu'une phase ne puisse pas afficher 100 % avec une
   convention non signée.
5. **Déduplication** de `isEngaged`, recopié dans
   `BudgetLineDocuments.tsx` alors que `lib/budget.ts` existe pour
   l'éviter. Exactement la divergence #3, en plus petit.

---

## J5 (31/07) — Gel et préparation de la recette

**Aucune fonction nouvelle ce jour-là.**

1. Gel du code en fin de matinée.
2. Relecture complète des trois protocoles : ils décriront un logiciel
   qui aura changé cinq jours de suite. Les deux dernières relectures
   ont chacune trouvé une contradiction (M7/M8, B6).
3. Régénération de `install-complet.sql` — le README le demande après
   chaque migration, ce n'est plus à jour depuis la 0008.
4. **Préparation des données de recette** : rattachements aux
   organisations, ligne financée par YCID sur la Coordination,
   configuration SMTP. Aujourd'hui ces étapes tombent sur le testeur le
   matin même.
5. Parcours complet par mes soins, dans les trois rôles, avant envoi.

**03/08 — recette**, avec des protocoles à jour et un jeu de données
prêt.

---

## Hors périmètre, assumé

Reporté sans regret — ce sont des fonctions, pas de la solidité :

- répartition prévu/engagé/payé **par financeur** (la « vue financeur »
  de la spec §10.4) ;
- export CSV du budget ;
- Journal paginé et filtrable ;
- colonnes engagé/payé dans le Pilotage portefeuille ;
- photos multiples et repli HEIC ;
- vitrine publique enrichie ;
- découpage de la page projet (~800 lignes) — dette réelle, pas
  urgence ;
- rôles paramétrables — voir J1.

---

## Deux décisions attendues de vous

**1. Les trois rôles vides.** Validateur, auditeur et lecteur ne se
distinguent aujourd'hui en rien. Trois options :

- **leur donner un sens** — auditeur voit le Journal, lecteur non ;
  validateur retrouve un droit de décision *(ma préférence : c'est le
  seul qui ait une réalité métier — le financeur qui tranche)* ;
- **les retirer** de l'écran de saisie, en gardant les valeurs en base ;
- **les laisser**, en sachant que l'écran des droits promet des
  distinctions qui n'existent pas.

**2. Le SMTP.** Le J3 a besoin d'un serveur d'envoi pour être testé :
compte YCID, ou un service tiers. Sans identifiants, je livre l'écran de
configuration et le repli silencieux, mais aucun email ne sera vérifié
avant la recette.

---

## Ce que ce plan ne promet pas

Cinq jours ne suffisent pas à rendre une application « sûre ». Ils
suffisent à ce qu'elle **cesse de mentir** : les droits affichés seront
les droits réels, une panne du circuit se verra, et une régression sera
signalée avant l'utilisateur. C'est ce qui sépare une démo d'une bêta.
