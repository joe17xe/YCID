# Plan de tests manuels — état du 25/07/2026 (22h46)

Production : `62e9526`. Couvre les neuf PR de la session (40/40b/40c,
38a→38e, 39, 41) et le correctif P0 du rapport IA.

**Priorité au doute.** Les tests sont classés par risque réel, pas par
ordre d'écran. Chaque test indique ce qui est attendu ET ce que
signifie un échec, pour que le retour soit exploitable sans
aller-retour.

## Ce qui n'est PAS encore livré — ne pas le chercher

Ces règles sont arbitrées mais programmées pour le 26/07 :
- **unanimité des validations** (aujourd'hui : UNE validation suffit) ;
- **pondération plancher 2 %** (aujourd'hui : moyenne simple, la
  mention « pondéré » n'apparaîtra probablement jamais) ;
- **emails** (aujourd'hui : notifications in-app uniquement) ;
- file « À valider », dépôt de pièce au niveau projet, édition de la
  fiche projet.

## Convention

- 🔴 **P0** — jamais testé + risque élevé, ou corrigé à l'aveugle
- 🟠 **P1** — jamais testé, conséquence visible
- 🟡 **P2** — vérification de non-régression
- ⚠️ **destructif** — action irréversible

---

# 🔴 P0 — À faire en premier

## T1. Rapport IA — le correctif du soir ⚠️ le plus important

Ce rapport se générait **avec zéro phase** depuis la migration 0033,
sans message d'erreur. Corrigé il y a moins d'une heure, jamais rejoué.

1. Ouvrir un projet ayant des phases → bouton **Rapport d'expert IA** → Générer.
2. Lire **l'en-tête** du rapport.

**Attendu** : « Périmètre analysé : N phase(s), … » avec **N ≥ 1**, et
le corps du rapport cite des noms de phases et de tâches réels.

**Si N = 0** : le correctif n'a pas pris — arrêter et me le dire, tout
le reste des tests budget sera faussé.

**À vérifier aussi** : la section « Analyse budgétaire » doit parler de
**prévu, engagé et payé** (trois montants distincts), et non d'un seul
montant. Et si vos phases ont des tâches terminées sans pièce, la
section « Risques » devrait distinguer déclaré et prouvé.

## T2. Aucun écran ne casse après la suppression de `phases.budget`

La colonne a été supprimée ce soir. Un seul select explicite oubliée
suffit à vider un écran en silence — c'est exactement ce qui est arrivé
au rapport.

Ouvrir successivement et vérifier qu'aucun n'est vide ni en erreur :

| Écran | Attendu |
|---|---|
| Projet ▸ Aperçu | organisations et membres listés |
| Projet ▸ Tâches | phases et tâches présentes |
| Projet ▸ Budget | lignes présentes |
| Projet ▸ Documents | pièces listées |
| Projet ▸ Impact / COPIL / Journal | contenu normal |
| Liste des projets | tous les projets |
| Pilotage | portefeuille complet |
| Dashboard | compteurs non nuls |
| Page vitrine publique `/p/<token>` | phases affichées |

**Un écran vide alors qu'il devrait contenir des données = régression à
me signaler immédiatement.**

## T3. Dialogue de phase — le champ Budget doit avoir disparu

1. Projet ▸ Tâches → crayon sur une phase.
2. **Attendu** : plus de champ « Budget (€) ». Nom, statut, dates seulement.
3. Modifier le nom → Enregistrer.

**Attendu** : enregistrement réussi. Un échec ici signifierait que
l'action serveur envoie encore la colonne supprimée.

## T4. Trois montants — cohérence arithmétique ⚠️ jamais vus avec vos données

Onglet **Budget** d'un projet ayant au moins un devis validé.

1. Relever les six indicateurs : voté, prévu, engagé, payé, reste à engager, valorisations.
2. Vérifier **à la main** :
   - `prévu` = somme de la colonne Prévu **hors lignes valorisation** ;
   - `reste à engager` = prévu − engagé ;
   - `engagé` = somme des devis **validés** uniquement (un devis en
     attente ne compte pas) ;
   - `payé` = somme des pièces marquées payées.
3. Vérifier que les **sous-totaux de phase** (lignes grises) égalent la
   somme des lignes de la phase, sur les trois colonnes.

**Attendu** : cohérence parfaite. Le calcul est partagé avec le rapport
IA — une incohérence ici se retrouverait dans un document envoyé à un
financeur.

## T5. Alerte d'enveloppe

Sur CEM Liban : montant voté 48 650 €.

1. Onglet Budget → regarder le bandeau ambre en haut.
2. **Attendu** : s'il apparaît, il indique voté / réparti / écart signé
   et en pourcentage. S'il n'apparaît pas, c'est que la somme des
   lignes hors valorisation vaut exactement 48 650 €.
3. Vérifier le **signe** : un réparti inférieur au voté doit afficher un
   écart **négatif** (ex. `−4 500 €`), pas une valeur absolue.

## T6. Écran Stockage — inventaire ⚠️ jamais testé

**Administration ▸ Stockage**.

1. **Attendu** : trois espaces listés (Pièces des projets, Photos de
   profil, Marque) avec taille et nombre de fichiers.
2. Le total en tête = somme des trois lignes.
3. Section « Par projet » : vos projets ayant des pièces.

**Si l'écran affiche « Statistiques indisponibles »** : la migration
0034 n'est pas appliquée — me le dire.

## T7. Purge des orphelins ⚠️⚠️ DESTRUCTIF — lire avant de cliquer

**Ne cliquez PAS sur « Purger » avant d'avoir fait l'étape 1.**

1. **Lire la liste** des fichiers orphelins affichée. Chaque chemin doit
   ressembler à `projets/<uuid>/<uuid>/<uuid>-nom.png`.
2. **Contrôle croisé** : pour un ou deux chemins, vérifier dans l'onglet
   Documents du projet correspondant qu'aucune pièce ne porte ce nom.
3. Seulement ensuite : **Purger** → confirmer.

**Attendu** : message « N fichier(s) supprimé(s) », liste vide au
rafraîchissement, espace occupé réduit.

**Danger réel** : si un fichier **encore visible** dans l'onglet
Documents apparaît dans cette liste, la détection d'orphelins est
fausse. **Ne purgez pas** et signalez-le — ce serait une perte de
données.

Si la liste est vide, tant mieux : rien à tester, les suppressions se
sont bien déroulées.

---

# 🟠 P1 — Jamais testé, conséquence visible

## T8. Archive ZIP ⚠️ doute technique réel

Onglet **Documents** d'un projet ayant au moins 3 pièces.

1. Sans filtre : noter le compte annoncé sur le bouton (« Télécharger (N) »).
2. Cliquer → suivre la progression → l'archive se télécharge.
3. **Ouvrir l'archive et COMPTER les fichiers.**

**Attendu** : exactement N fichiers.

**Doute assumé** : mon code ignore silencieusement un fichier qu'il
n'arrive pas à récupérer (`if (!r.ok) continue`). Si l'archive contient
**moins** de fichiers qu'annoncé, c'est ce défaut — probablement un
blocage CORS sur les URL signées. **Comptez vraiment**, c'est le seul
moyen de le détecter.

4. **Test des filtres** : filtrer sur une nature (ex. Photo), vérifier
   que le compte du bouton change, retélécharger, vérifier que
   l'archive ne contient que ces pièces.

5. **Test des doublons** : si deux pièces portent le même nom de
   fichier, l'archive doit contenir `nom.png` **et** `nom (2).png`,
   pas un seul des deux.

## T9. Galerie photos avant / après ⚠️ limitation connue

Onglet **Tâches** → sous la barre d'avancement d'une phase.

1. « Ajouter une photo » → choisir un **JPG ou PNG** → moment « Avant » → Déposer.
2. Recommencer avec moment « Après ».
3. Déplier la galerie.

**Attendu** : trois colonnes Avant / Pendant / Après, vignettes
visibles, clic ouvrant l'image en grand.

4. **Test HEIC** — recommencer avec une photo prise directement à
   l'iPhone (format HEIC, non convertie).

**Attendu connu et documenté** : le dépôt réussit, mais la **vignette
ne s'affiche pas** dans Chrome ni Firefox (elle s'affiche dans Safari).
C'est la limitation identifiée en relecture, corrigée demain (P2-⑨).
Confirmez juste que le dépôt lui-même fonctionne.

## T10. Création croisée — depuis une ligne

Onglet **Budget**, sur une ligne **rattachée à une phase** et non
valorisation.

1. Colonne « Tâche financée » → bouton **« Créer la tâche »**.
2. **Attendu** : la tâche apparaît dans l'onglet Tâches, dans la phase
   de la ligne, avec pour titre le **poste** de la ligne, et le montant
   **non encore réparti** de la ligne lui est affecté.
3. Retourner sur la ligne : la tâche y figure avec son montant.

4. **Cas d'erreur attendu** : sur une ligne **sans phase**, le bouton
   ne doit pas apparaître du tout.

## T11. Création croisée — depuis une tâche

Onglet **Tâches**, sur une tâche.

1. Lien **« + ligne budgétaire »** à côté du montant.
2. **Attendu** : le dialogue s'ouvre avec la **phase déjà renseignée**
   et la **tâche déjà présente** dans le bloc « Tâches financées ».
3. Compléter poste + montant + montant de répartition → Créer.
4. **Attendu** : la tâche affiche désormais ce montant au lieu de 0 €.

## T12. Répartition d'une ligne sur deux tâches

C'est le cœur de votre demande d'hier (40 000 € = 10 000 + 30 000).

1. Ouvrir une ligne de 40 000 € (ou en créer une).
2. Bloc « Tâches financées » → ajouter tâche A à 10 000, tâche B à 30 000.
3. **Attendu** : compteur `Réparti 40 000 € · reste 0 €`.
4. Porter A à 15 000 → **Attendu** : compteur en **rouge**, bouton
   Enregistrer **bloqué**.
5. Revenir à 10 000 → Enregistrer.
6. Onglet Tâches : A affiche 10 000 €, B affiche 30 000 €.
7. Onglet Budget : la ligne montre le détail des deux tâches.

## T13. Badge « sans justificatif »

1. Repérer une tâche **terminée sans aucune pièce**.
2. **Attendu** : badge ambre « sans justificatif » sur la tâche, et
   compteur « N sans justificatif » sur l'en-tête de la phase.
3. Déposer une pièce sur cette tâche.
4. **Attendu** : le badge disparaît, le compteur de phase décrémente.

**Point de conception à confirmer** : le dépôt doit rester possible sur
une tâche terminée — c'est le seul moyen de régulariser. Si le bouton
« + pièce » est absent sur une tâche terminée, dites-le-moi.

## T14. Natures de pièces — la séparation tâche / ligne

1. Sur une **tâche** → « + pièce » → dérouler « Nature ».
   **Attendu** : justificatif, photo, livrable, note, étude, rapport,
   convention. **PAS** devis, facture, reçu. Et un texte renvoyant vers
   l'onglet Budget.
2. Sur une **ligne budgétaire** → « Déposer une pièce » → Nature.
   **Attendu** : devis, facture, reçu, justificatif uniquement.

## T15. Marquer une facture payée

1. Sur une ligne, déposer une **facture** avec un montant.
2. « Marquer payée » → saisir une date.
3. **Attendu** : mention « payé le JJ/MM/AAAA », compteur `payé` de la
   ligne mis à jour, colonne **Payé** du tableau mise à jour, et
   indicateur **Payé** du projet augmenté d'autant.
4. « Annuler le paiement » → tout redescend.

---

# 🟡 P2 — Non-régression

## T16. Clavier virtuel sur mobile ⚠️ corrigé deux fois, jamais confirmé

**Au téléphone, en portrait.**

1. Projet ▸ Budget → crayon sur une ligne.
2. Taper **au moins dix caractères** dans le champ « Poste ».
3. **Attendu** : le clavier reste ouvert du premier au dernier
   caractère, et le champ actif ne se déplace pas sous les doigts.
4. Recommencer dans le champ « Montant prévisionnel ».
5. Recommencer dans le bloc de répartition (champ Montant d'une tâche)
   — c'est le cas le plus dur, la hauteur du dialogue y change en cours
   de frappe.

**Le correctif touche le composant modal partagé** : si ça marche ici,
tester rapidement un autre dialogue (nouvelle tâche, nouvel indicateur)
pour confirmer qu'il n'y a pas de régression ailleurs.

## T17. En-tête projet en portrait

1. Ouvrir un projet au téléphone, en portrait.
2. **Attendu** : les trois boutons (page publique, rapport IA,
   supprimer) sont réduits à leurs **icônes**, ne débordent pas et ne
   chevauchent plus le fil d'Ariane « Projets ».
3. Passer en paysage ou sur ordinateur → **Attendu** : les libellés
   réapparaissent.

## T18. Filtres de l'onglet Documents

1. Onglet Documents : vérifier que chaque pièce affiche son
   **rattachement** (Tâche : … / Ligne : … / Phase : … / Projet).
2. Filtrer par **nature** → le compte change.
3. Filtrer par **phase** → seules les pièces de cette phase restent.
4. Saisir dans **Rechercher** un morceau de nom de tâche → les pièces
   de cette tâche remontent (la recherche couvre nom de fichier, tâche
   et poste).
5. **Réinitialiser** → tout revient.
6. Dates « depuis » / « jusqu'au » → filtrage cohérent.

## T19. Téléchargement d'une pièce et lien signé

1. Cliquer sur le nom d'une pièce → l'aperçu s'ouvre dans un onglet.
2. **Copier l'URL**, attendre **6 minutes**, la recoller.
3. **Attendu** : le lien a **expiré** (erreur Supabase). C'est voulu —
   le bucket est privé, un lien transféré ne doit pas rester valable.

## T20. Import CSV budget avec tâche

1. Import ▸ Lignes budgétaires : colonnes attendues affichées, incluant
   `tache` et `montant_tache`.
2. Préparer un CSV avec une ligne comportant `phase` + `tache`
   (titre exact d'une tâche existante) + `montant_tache` inférieur au
   `montant_previsionnel`.
3. Importer.
4. **Attendu** : la ligne est créée, rattachée à la phase, et la tâche
   reçoit le `montant_tache` — visible dans l'onglet Tâches.
5. **Cas d'erreur attendus**, à vérifier :
   - `tache` sans `phase` → refus explicite ;
   - `tache` inexistante dans la phase → refus ;
   - `montant_tache` > `montant_previsionnel` → refus.

## T21. Mention REFLEY / EZRYA

1. Pied de page de l'application : « Application développée par
   l'association REFLEY — powered by EZRYA ».
2. Page **Mentions légales** : section « Conception et développement »,
   distincte de l'éditeur.
3. Page vitrine publique `/p/<token>` : mention présente en pied.

---

# 🔒 Droits et rôles — à faire avec un second compte

Si vous disposez d'un compte non-admin (ou pouvez en créer un de test) :

## T22. Un non-admin ne voit pas Stockage
**Attendu** : l'entrée « Stockage » est absente du menu ; l'accès
direct à `/admin/stockage` redirige vers le tableau de bord.

## T23. Rôles projet et boutons de dépôt
| Rôle | Attendu |
|---|---|
| contributeur | voit « + pièce », peut déposer |
| lecteur / auditeur | **ne voit pas** « + pièce » ni « Ajouter une photo » |
| contributeur | ne peut **pas** supprimer une pièce déposée par un autre |
| chef de projet / resp. financier | peut supprimer n'importe quelle pièce du projet |

## T24. Validation d'un devis
Avec un compte membre de l'organisation sollicitée : les boutons
**Valider / Refuser** doivent être actionnables et la décision
enregistrée avec son auteur.

**Rappel** : aujourd'hui **une seule** validation suffit à rendre le
devis « engagé ». L'unanimité arrive demain.

---

## T25. Roadmap participative — après alimentation

Prérequis : avoir passé `docs/roadmap-seed-2026-07.sql` dans le SQL
Editor (17 idées issues du programme du 26/07).

1. Menu **Roadmap** → **Attendu** : les 17 idées, celles marquées
   « Acceptée » (P1/P2) distinguées de celles au statut « Idée » (P3).
2. **Voter** pour une idée → le compteur s'incrémente ; revoter →
   le vote se retire.
3. Ouvrir une idée → **commenter** → le commentaire apparaît avec votre nom.
4. **Gestion produit** (admins) : changer le statut d'une idée en
   « En cours », sa priorité, sa difficulté → les badges suivent.
5. **Proposer une idée** depuis l'interface — c'est le seul chemin que
   l'insertion SQL ne teste pas, puisqu'elle contourne l'action
   serveur `proposeIdea`. À faire au moins une fois.
6. Supprimer l'idée de test créée à l'étape 5.

**Point à vérifier au passage** : le compte de Bérengère Ayoub doit
voir le panneau « Gestion produit ». S'il est absent, c'est le
prérequis de droits signalé dans le README — `is_platform_admin` ou
`admin_org` YCID/LEY — et il faut le corriger dans
Administration ▸ Utilisateurs.

# Retour attendu

Pour chaque échec, m'indiquer : **le numéro du test**, ce que vous avez
vu, et le message d'erreur **tel quel** s'il y en a un. Les captures
d'écran sont précieuses — celles d'hier ont permis de trouver deux
défauts que je n'aurais pas vus autrement.

Ordre conseillé si le temps manque : **T1, T2, T4, T7, T8, T16** — ce
sont les six où le risque est le plus élevé.
