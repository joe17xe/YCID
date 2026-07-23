# PR 18 — Roadmap participative & Déploiements — spécification

Référence : module « Roadmap » d'OrthoPilot (même auteur/produit).
Objectif : faire des associations partenaires des **co-constructrices** de
Solid'Pilot — elles proposent, votent, commentent ; YCID arbitre en
transparence ; le changelog prouve que le produit avance.

---

## 1. Vues

### Onglet « Roadmap » (liste)
- En-tête : titre + sous-titre « Idées et propositions d'évolution — votez pour prioriser ».
- Bouton **« Proposer une idée »** (ouvert à tout utilisateur connecté).
- Barre de filtres : recherche plein texte, filtre **Statut**, filtre **Priorité**,
  filtre **Tags**, tri (**votes** par défaut, ou date), compteur « N idées ».
- Grille de cartes. Chaque carte affiche :
  - pastille **Statut** + pastille **Priorité** ;
  - **Difficulté** en points (jauge 1–5) ;
  - titre ; extrait de description (tronqué) ;
  - **tags** ;
  - pied : nombre de **votes** (↑ N), nombre de **commentaires**, auteur + date.

### Détail d'une idée
- « ← Retour à la roadmap ».
- Boutons **Modifier / Supprimer** (admin, ou auteur pour sa propre idée).
- Colonne gauche :
  - **Voter** + « N votes de l'équipe » (un vote par utilisateur, réversible) ;
  - **Fiche** : statut, priorité, difficulté (N/5), tags, « Proposée par X le … » ;
  - **Gestion produit — Réservé à l'administrateur** : sélecteurs Statut,
    Priorité, Difficulté (1–5) + « Enregistrer ».
- Colonne droite :
  - **Description** (multi-lignes) ;
  - **Commentaires** : liste (auteur, date, suppression par admin/auteur) +
    zone de saisie + « Publier ».

### Onglet « Déploiements » (changelog)
- Liste des livraisons, alimentée par les **PR fusionnées** (titre, numéro,
  auteur, date, statut « fusionnée »). Source : API GitHub ou table alimentée
  au merge. Compteur « N fusionnées ».

### Onglet « Aide »
- Documentation / prise en main (contenu à définir, hors périmètre initial).

---

## 2. Référentiels (valeurs)

- **Statut** : `idee` (gris), `acceptee` (violet), `en_cours`, `livree` (vert),
  `refusee`. Libellés FR : Idée / Acceptée / En cours / Livrée / Refusée.
- **Priorité** : `basse`, `moyenne`, `haute`.
- **Difficulté** : entier 1–5 (jauge à points).
- **Tags** : libres (ex. Rapports, Amélioration, Amélioration UX,
  Innovation / Fonctionnalité, Amélioration technique).

---

## 3. Modèle de données (à adapter au schéma réel de production)

> ⚠️ Le schéma réel utilise des identifiants texte courts, `profiles.auth_user_id`
> pour le lien d'authentification, et pas de table `memberships`. Les noms de
> tables/colonnes ci-dessous sont indicatifs et devront être alignés sur les
> conventions réelles (colonnes courtes : `by`, `at`, `date`…).

- `ideas` : id, title, description, status, priority, difficulty (int 1–5),
  tags (jsonb/array), author_id (→ profiles), created_at, updated_at.
- `idea_votes` : idea_id, user_id — unicité (idea_id, user_id), vote réversible.
- `idea_comments` : id, idea_id, author_id, body, created_at.

Compteurs (votes, commentaires) calculés par agrégation ou colonnes dénormalisées.

---

## 4. Droits (RBAC — cohérent avec `lib/rbac.ts`)

| Action | Tout utilisateur connecté | Admin |
|---|---|---|
| Voir la roadmap / le détail | ✓ | ✓ |
| Proposer une idée | ✓ | ✓ |
| Voter / retirer son vote | ✓ | ✓ |
| Commenter | ✓ | ✓ |
| Modifier / supprimer SA propre idée ou son commentaire | ✓ | ✓ |
| Changer Statut / Priorité / Difficulté (« Gestion produit ») | — | ✓ |
| Supprimer l'idée / le commentaire d'un autre | — | ✓ |

Permissions suggérées : `roadmap.propose`, `roadmap.vote`, `roadmap.comment`,
`roadmap.manage` (admin).

---

## 5. Points transversaux remarqués (à ne pas oublier)

- **Pied de page dynamique** (voir PR 17) : version + horodatage précis
  (`… 21:11`), mis à jour à chaque déploiement — pas codé en dur.
- **Badge de synchronisation** persistant dans l'en-tête (chez OrthoPilot :
  « Orthokis · jamais synchronisé ») : indicateur d'état d'une intégration
  externe, visible sur toutes les pages. Équivalent Solid'Pilot ultérieur si
  une source externe est branchée ; sinon sans objet.
- **Attribution nominative** systématique (auteur d'une idée, d'un commentaire).
- **Cohérence produit** : la séparation « chacun propose/vote/commente, seul
  l'admin arbitre » est le même patron RBAC que partout ailleurs — à réutiliser.
