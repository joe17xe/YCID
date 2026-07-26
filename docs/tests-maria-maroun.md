# Tests Solid'Pilot — Maria Maroun

Bonjour Maria,

Votre compte portait par erreur un rôle d'administration qui ne
correspondait pas à votre fonction. C'est corrigé : ces tests servent
d'abord à vérifier que vous avez maintenant **exactement les droits de
votre métier**, et que vous pouvez travailler normalement.

Vos rôles : **Terrain** sur la Triade Villepreux · Azour · LEY, et
**Chef de projet** sur la Coordination.

Les tests **M1 à M7, M9 et M11** portent sur la **Triade** — votre rôle
Terrain. Les tests **M8, M10 et M12** portent sur la **Coordination** —
votre rôle Chef de projet, qui ouvre le budget. Le changement de projet
est signalé à chaque fois ; il n'est pas anodin, les deux rôles ne
donnent pas les mêmes boutons.

Comptez **40 minutes**. Ce qui compte le plus est marqué ⭐.

## ⚠️ Deux choses à ne pas faire

- **Ne supprimez pas de projet** (bouton définitif).
- Ne supprimez pas de tâches, pièces ou lignes que vous n'avez pas
  créées pendant ces tests.

Tout ce que vous créez ci-dessous, vous pourrez le retirer ensuite.

---

## M1. ⭐ Ce que vous voyez au menu — le test central

1. Connectez-vous.
2. Regardez le menu de gauche (ou ☰ sur téléphone).

**Attendu** : Tableau de bord, Projets, Organisations, Import, Pilotage,
Roadmap, Aide.

Vous ne devez **PLUS** voir de section **Administration** (Utilisateurs,
Stockage, Configuration). Hier elle apparaissait sur votre compte —
c'était l'erreur que nous corrigeons.

**Si vous la voyez encore, dites-le tout de suite.**

## M2. Vos projets

1. Menu **Projets**.

**Attendu** : **2 projets** — la Triade Villepreux et la Coordination.
Vous ne verrez plus la Triade Jouy-en-Josas, dont vous n'êtes pas membre.
C'est normal.

2. Ouvrez la Triade Villepreux → onglet **Aperçu**.

**Attendu** : les organisations partenaires et les membres, dont vous,
avec la mention **« Terrain »**. C'est bien votre rôle sur ce projet.

## M3. ⭐ Vos tâches

1. Onglet **Tâches**.
2. Trouvez **« Réalisation de la sécurisation du site »** (Action 1) —
   la seule à votre nom sur ce projet.
3. Crayon → changez l'**avancement** (0 % → 20 %) → enregistrez.

**Attendu** : le pourcentage change, et celui de la phase se recalcule.

4. Remettez la valeur d'origine.

**Question de fond** : ce que la tâche affiche vous suffit-il pour savoir
où vous en êtes ? Que manque-t-il ?

## M4. ⭐ Justifier une tâche faite

C'est le cœur du métier : prouver, pas seulement déclarer.

1. Sur une tâche → **« + pièce »** → un fichier de moins de 10 Mo →
   Nature **Justificatif** → Déposez.

**Attendu** : la tâche passe de « 0 doc » à « 1 doc ».

2. Cliquez sur le compteur pour déplier, puis sur le nom du fichier.

**Attendu** : le document s'ouvre dans un nouvel onglet.

3. S'il existe une tâche **terminée sans aucune pièce**, elle porte un
   badge orange **« sans justificatif »**. S'il n'y en a aucune, passez.

**Question** : ce signalement vous paraît-il utile ou pénible ? Il ne
bloque rien — on vous le signale, c'est tout.

## M5. ⭐ Photos avant / après

1. Onglet **Tâches**, sous la barre d'avancement d'une phase →
   **« Ajouter une photo »** → moment **Avant** → Déposez.
2. Recommencez avec **Après**, puis dépliez la galerie.

**Attendu** : trois colonnes — Avant, Pendant, Après — vos photos dans
les bonnes.

3. **Le test qui nous intéresse** : refaites-le avec une photo prise
   **directement depuis votre iPhone**, sans la convertir.

**Ce qu'on cherche** : la photo se dépose-t-elle ? La vignette
s'affiche-t-elle, ou voyez-vous un carré vide ? **Précisez votre
navigateur** (Safari, Chrome…) — c'est déterminant.

## M6. Le budget de votre projet

1. Onglet **Budget**.

**Attendu** : les lignes regroupées par phase, avec **Prévu**, **Engagé**
et **Payé**.

**Question** : comprenez-vous ces trois mots sans explication ? Si un
doute subsiste, dites lequel.

2. Onglet **Tâches** : chaque tâche affiche un montant, parfois 0 €.
   C'est ce que les lignes budgétaires lui affectent.

## M7. Ce que votre rôle Terrain ne permet pas

⚠️ **Ce test doit échouer, et c'est le résultat attendu.**

1. Onglet **Tâches**, sur une tâche → cherchez **« + ligne budgétaire »**.

**Attendu** : le bouton est **absent**, ou l'enregistrement est refusé.
Créer une ligne budgétaire est réservé au responsable projet et au
responsable financier — pas au rôle Terrain.

Dites-moi simplement ce que vous constatez. Un refus ici est une bonne
nouvelle : les droits font ce qu'ils annoncent.

## M8. Déposer une facture — ⚠️ sur la **Coordination**

**Changez de projet ici.** Ouvrez **CEM Liban — Coordination et actions
communes**, où vous êtes **Chef de projet**. Sur la Triade, votre rôle
Terrain ne donne pas accès au dépôt : le trombone n'y affiche que la
lecture, sans « Déposer une pièce » ni « Marquer payée ». C'est cohérent
avec M7, pas un défaut.

Ce test éprouve donc votre **second rôle** — et il n'a encore jamais été
essayé par personne.

**Ne supprimez rien à la fin de ce test** : ce que vous déposez ici sert
de matière aux tests de Bérengère et de Joe. Le nettoyage viendra après.

### M8a. Le devis part tout seul en validation

1. Sur la **Coordination**, onglet **Budget**, la ligne que Joe vous aura
   indiquée → icône trombone 📎.
2. **Déposer une pièce** : un fichier, Nature **Devis**, Montant 300 €.

**Attendu** : la pièce apparaît **« en attente de validation »**, sans
que vous ayez rien cliqué de plus. Un devis part automatiquement vers
l'organisation qui finance la ligne.

3. Regardez **« Engagé (devis validés) »** sur la ligne.

**Attendu** : il n'a **pas** bougé. Un devis déposé n'engage rien — il
n'engagera qu'une fois validé, par quelqu'un d'autre.

4. Cherchez un bouton pour valider **votre propre** devis.

**Attendu** : il n'y en a pas. C'est voulu : vous êtes la déposante, et
se valider soi-même viderait le circuit de son sens. La décision revient
à l'organisation sollicitée.

**Dites-moi vers quelle organisation le devis est parti** — c'est
l'information que j'attends le plus de ce test.

### M8b. La facture et le paiement

1. Sur la même ligne → **Déposer une pièce** : Nature **Facture**,
   Montant 200 €.
2. **« Marquer payée »**.

**Attendu** : un champ **date** apparaît dans le panneau — pas une
fenêtre grise du navigateur — pré-rempli à aujourd'hui. Confirmez.

**Attendu** : « payé le … » apparaît et la colonne **Payé** se met à jour.

3. **Annulez le paiement** — et **laissez les deux pièces en place**.

## M9. Retrouver un document

1. Onglet **Documents** : toutes les pièces du projet, avec leur
   rattachement.
2. **Rechercher** un mot d'un titre de tâche → les pièces remontent.
3. **Réinitialiser** → tous les filtres se vident, champ de recherche
   compris.
4. **Télécharger** → une archive ZIP. Ouvrez-la : elle doit contenir
   autant de fichiers que le bouton l'annonçait.

## M10. ⭐ Sur téléphone — le test le plus attendu

Personne n'a encore pu le faire, et vous travaillez sans doute surtout
sur téléphone.

**Restez sur la Coordination** — comme M8, ce test passe par le crayon
d'une ligne budgétaire, absent sur la Triade où vous êtes Terrain.

1. En **portrait**, sur la **Coordination**, onglet **Budget** → crayon
   d'une ligne.
2. Dans **Poste**, tapez **au moins dix caractères**.

**Attendu** : le clavier reste ouvert du premier au dernier caractère, et
le champ ne se déplace pas sous vos doigts.

3. Recommencez dans **Montant**, puis dans un champ Montant de la zone
   **« Tâches financées »** — c'est le cas le plus difficile, la fenêtre
   change de hauteur pendant la frappe.

**Si le clavier se referme à chaque lettre, dites-le tout de suite.**

4. Regardez le haut de l'écran du projet : les boutons doivent être de
   petites icônes, sans déborder.

## M11. Le rapport d'expert IA

1. Sur la **Triade**, → **Rapport d'expert IA** → **Générer**.

**Question** : y reconnaissez-vous votre projet ? S'il se trompe sur un
fait, c'est important à savoir.

## M12. ⭐ Votre rôle Chef de projet — sur la **Coordination**

Ce rôle n'a jamais été éprouvé. Vous êtes la seule à pouvoir le faire.

1. Sur la **Coordination**, onglet **Budget** → **« + Ligne
   budgétaire »** → un poste « Test Maria », montant 500 € →
   enregistrez.

**Attendu** : la ligne apparaît, et le total de la phase augmente de
500 €.

2. Sur cette ligne → **« Créer la tâche »**.

**Attendu** : une tâche « Test Maria » est créée dans la phase, avec le
montant affecté.

3. Recommencez **immédiatement** « Créer la tâche » sur la même ligne.

**Attendu** : c'est **refusé**, avec un message disant que la tâche
existe déjà. Un doublon s'était créé hier faute de ce garde-fou — dites
si vous obtenez malgré tout deux tâches.

4. Onglet **Tâches** → supprimez la tâche « Test Maria », puis revenez
   au Budget supprimer la ligne.

**Attendu** : les deux disparaissent, et le total de la phase revient à
sa valeur d'origine.

---

## Ce que j'attends de vous

Le numéro du test + ce que vous avez vu. Une capture d'écran est idéale.

Et surtout : **qu'est-ce qui vous manque pour travailler ?** Vous êtes la
personne qui utilisera cet outil au quotidien.

**Pensez à retirer** en fin de test les pièces et photos déposées sur la
**Triade** (M4, M5), ainsi que la ligne et la tâche « Test Maria » de
M12.

**En revanche, laissez en place le devis et la facture de M8**, sur la
Coordination : Bérengère et Joe en ont besoin pour leurs propres tests.
Joe les supprimera ensuite.
