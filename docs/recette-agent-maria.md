# Recette automatisée — profil Maria Maroun (Chef de projet / Terrain)

> **Destiné à un agent Claude pilotant un navigateur.** La session est
> déjà connectée avec le compte de Maria Maroun. N'essaie pas de changer
> de compte.

## Règles absolues

1. **N'invente aucun résultat.** Si tu n'as pas pu exécuter une étape,
   le verdict est `BLOQUÉ`, jamais `OK`. Un test non fait n'est pas un
   test réussi.
2. **Rapporte ce que tu vois, pas ce que tu déduis.** Recopie les
   montants et libellés exacts affichés à l'écran.
3. **Interdits, sans exception** : supprimer un projet ; supprimer une
   tâche, une ligne ou une pièce que tu n'as pas créée toi-même pendant
   cette session ; modifier le rôle d'un membre ; modifier le montant
   voté d'un projet.
4. **Deux tests DOIVENT échouer** — M7 et M8a-4. Un refus y est le
   résultat attendu : verdict `OK`. Ne les signale pas comme défauts.
5. **Ne nettoie pas ce que M8 dépose.** Le devis et la facture servent
   à la recette suivante.
6. À la fin, produis le **tableau de synthèse** demandé plus bas.

## Prérequis matériels

Tu auras besoin de **trois petits fichiers locaux** (moins de 10 Mo) :
un PDF ou une image nommée `justificatif-test.pdf`, une image
`photo-test.jpg`, et une seconde image `photo-test-2.jpg`. Si tu ne
peux pas téléverser de fichier, marque les tests concernés `BLOQUÉ —
téléversement impossible` et poursuis les autres.

## Vocabulaire

- « Projet Triade » = **CEM Liban — Triade Villepreux · Azour · LEY**
- « Projet Coordination » = **CEM Liban — Coordination et actions communes**

---

## M1 — Menu de navigation

**Étapes** : ouvre l'application, affiche le menu latéral (ou ☰).

**Attendu** : les entrées **Tableau de bord, Projets, À valider,
Organisations, Import, Pilotage, Roadmap, Aide**.

**Critère `KO`** : la présence d'une section **Administration**
(Utilisateurs, Stockage, Configuration, Accès & rôles). Ce compte ne
doit plus y avoir accès.

**À reporter** : la liste exacte des entrées visibles.

## M2 — Périmètre des projets

**Étapes** : menu **Projets**.

**Attendu** : exactement **2 projets** — Triade Villepreux et
Coordination. La Triade Jouy-en-Josas ne doit **pas** apparaître.

**Puis** : ouvre le projet Triade → onglet **Aperçu** → bloc des
membres.

**Attendu** : Maria Maroun y figure avec le rôle **Contributeur ·
Terrain**.

**À reporter** : le nombre de projets et le libellé exact du rôle.

## M3 — Modifier une tâche

**Étapes** : projet Triade → onglet **Tâches** → trouve la tâche
assignée à Maria Maroun → bouton crayon → change l'**avancement** à
`20` → Enregistrer.

**Attendu** : la valeur affichée passe à 20 %, et le pourcentage de la
phase change.

**Puis, obligatoire** : remets la valeur d'origine et enregistre.

**À reporter** : l'avancement de la phase avant et après.

## M4 — Déposer un justificatif

**Étapes** : sur une tâche → **« + pièce »** → fichier
`justificatif-test.pdf` → Nature **Justificatif** → Déposer.

**Attendu** : le compteur de la tâche passe de « 0 doc » à « 1 doc ».

**Puis** : déplie le compteur, clique sur le nom du fichier.

**Attendu** : le document s'ouvre dans un nouvel onglet.

**À reporter** : le compteur avant/après, et si l'ouverture a réussi.

## M5 — Photos avant / après

**Étapes** : onglet **Tâches** → sous la barre d'avancement d'une phase
→ **« Ajouter une photo »** → moment **Avant** → `photo-test.jpg`.
Recommence avec moment **Après** et `photo-test-2.jpg`. Déplie la
galerie.

**Attendu** : trois colonnes **Avant / Pendant / Après**, chaque photo
dans la bonne colonne, vignette visible et non vide.

**À reporter** : la présence des trois colonnes, et si les vignettes
s'affichent ou apparaissent vides.

> Le test avec une photo iPhone au format HEIC est réservé à un humain :
> ne tente pas de le simuler.

## M6 — Lecture du budget

**Étapes** : projet Triade → onglet **Budget**.

**Attendu** : des lignes groupées par phase, avec les colonnes
**Prévu**, **Engagé**, **Payé**.

**À reporter** : les trois totaux du projet, recopiés exactement.

## M7 — ⚠️ TEST QUI DOIT ÉCHOUER

**Ce test vérifie une INTERDICTION. Un refus est le résultat attendu.**

**Étapes** : projet Triade (rôle Terrain) → onglet **Tâches** →
cherche un bouton **« + ligne budgétaire »**.

**Attendu** : le bouton est **absent**. S'il existe et que tu
l'utilises, l'enregistrement doit être **refusé**.

**Verdict `OK`** = bouton absent, ou refus explicite.
**Verdict `KO`** = la ligne budgétaire est créée.

**À reporter** : bouton présent ou absent ; si présent, le message
obtenu.

## M8 — Le circuit de validation — ⚠️ change de projet

**Ouvre le projet Coordination.** Maria y est **Chef de projet**, ce
qui ouvre le budget. Sur la Triade elle est Terrain : le trombone n'y
affiche que la lecture. Ce n'est pas un défaut, c'est M7.

### M8a — Dépôt du devis

**Étapes** : onglet **Budget** → n'importe quelle ligne → icône
**trombone 📎** → **Déposer une pièce** → `justificatif-test.pdf`,
Nature **Devis**, Montant `300` → Déposer.

**Attendu 1** : la pièce apparaît avec la mention **« en attente »** et
le nom d'une organisation, sans action supplémentaire.

**Attendu 2** : la colonne **Engagé** de la ligne n'a **pas** bougé.

**Attendu 3 — ⚠️ DOIT ÉCHOUER** : cherche un bouton pour valider ce
devis. **Il ne doit pas y en avoir** — le déposant ne valide pas son
propre devis. Verdict `OK` si aucun bouton n'est proposé.

**À reporter — le plus important** : le **nom exact de l'organisation
sollicitée**, et le nombre d'étapes affichées.

### M8b — Facture et paiement

**Étapes** : même ligne → **Déposer une pièce** → un fichier, Nature
**Facture**, Montant `200` → Déposer → **« Marquer payée »**.

**Attendu** : un champ **date** apparaît **dans le panneau** (pas une
boîte de dialogue grise du navigateur), pré-rempli à la date du jour.
Confirme.

**Attendu** : la mention « payé le … » apparaît, la colonne **Payé** se
met à jour.

**Puis** : **Annuler le paiement**. **Ne supprime pas les deux pièces.**

**À reporter** : si le champ date est bien intégré au panneau, et la
valeur de Payé avant/après.

## M9 — Retrouver un document

**Étapes** : onglet **Documents** → saisis un mot d'un titre de tâche
dans la recherche → observe → clique **Réinitialiser** → clique
**Télécharger**.

**Attendu** : la recherche filtre ; Réinitialiser vide tous les filtres
y compris le champ de recherche ; le téléchargement produit une archive
ZIP dont le nombre de fichiers correspond au nombre annoncé sur le
bouton.

**À reporter** : le nombre annoncé sur le bouton, et si l'archive a bien
été produite.

## M10 — Rapport d'expert IA

**Étapes** : sur le projet Triade → **Rapport d'expert IA** →
**Générer**. Compte jusqu'à 90 secondes.

**Attendu** : un rapport s'affiche. En en-tête, une mention
« Périmètre analysé : N phase(s) ».

**Critère `KO` déterminant** : **N vaut 0**.

**À reporter** : la valeur exacte de N, et le nombre de sections du
rapport.

## M11 — Rôle Chef de projet — sur la Coordination

**Étapes** :

1. Projet Coordination → onglet **Budget** → **« + Ligne budgétaire »**
   → poste `Test agent`, montant `500` → Enregistrer.
2. Sur cette ligne → **« Créer la tâche »**.
3. **Immédiatement**, clique de nouveau **« Créer la tâche »** sur la
   même ligne.

**Attendu 1** : la ligne apparaît, le total de la phase augmente de 500.
**Attendu 2** : une tâche « Test agent » est créée.
**Attendu 3 — ⚠️ DOIT ÉCHOUER** : le second clic est **refusé** avec un
message indiquant que la tâche existe déjà. Verdict `KO` si **deux**
tâches sont créées.

4. Onglet **Aperçu** → bloc des membres : vérifie qu'un **menu
   déroulant de rôle** est présent. **Ne le modifie pas.**

5. **Nettoyage** : supprime la tâche « Test agent », puis la ligne
   « Test agent ». Ne touche à rien d'autre.

**À reporter** : le résultat du second clic (message exact), et si le
nettoyage a réussi.

---

## Tests réservés à un humain — ne pas tenter

- Clavier virtuel sur téléphone réel.
- Photo iPhone au format HEIC non convertie.
- Jugements de valeur : « ce rapport est-il présentable en COPIL »,
  « ces libellés sont-ils clairs ».

---

## Format du rapport final

Produis ce tableau, puis les détails.

| Test | Verdict | Observation |
|---|---|---|
| M1 | OK / KO / BLOQUÉ | … |
| … | | |

Puis, obligatoirement :

1. **Les valeurs relevées** : nombre de projets (M2), organisation
   sollicitée (M8a), N du rapport (M10), Engagé/Payé avant-après.
2. **Les écarts** : pour chaque `KO`, ce qui était attendu et ce qui
   s'est produit, avec le message d'erreur exact s'il y en a un.
3. **Ce que tu n'as pas pu faire**, et pourquoi.
4. **Confirmation de nettoyage** : ce que tu as supprimé, et
   confirmation que le devis et la facture de M8 sont **toujours en
   place**.
