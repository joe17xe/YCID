# Relecture produit — 25/07/2026 (soir)

Neuf PR livrées en une session (40 / 40b / 40c, 38a → 38e, 39, 41),
migrations 0027 → 0034. Relecture à froid, par fenêtre de rôle, contre
la vision du produit (README : « adoption de Solid'Pilot par YCID pour
tous ses projets futurs, avec toutes les associations partenaires » ;
principes : plateforme auto-administrable, droits explicites,
traçabilité, interface honnête).

## P0 — corrigé pendant la relecture

**Le rapport IA se générait sans aucune phase depuis la 0033.**
`report-actions.ts` sélectionnait encore `phases.budget`, colonne
supprimée : la requête phases échouait, `data` revenait nul, et le
rapport sortait quand même — « 0 phase(s) » dans l'en-tête, aucune
erreur visible. Le pire type de panne pour une pièce destinée à un
financeur : fausse, mais plausible. Corrigé (retrait de la colonne du
select) ; aucun SQL à passer.

Leçon générique : toute migration qui supprime une colonne doit être
suivie d'un grep sur **tous** les selects explicites — `page.tsx`
utilisait `*` et n'a rien vu, seul le select explicite du rapport a
cassé.

---

## Relecture par fenêtre de rôle

### Chef de projet (association porteuse — ex. LEY)
**Fonctionne** : phases/tâches/budget synchronisés, répartition,
création croisée, avancement, alerte d'enveloppe, rapport IA.
**Manque** :
- **Aucun moyen de modifier la fiche projet après création** — nom,
  dates, description… et surtout le **montant voté**, devenu LA
  référence de la PR 39. Une erreur de saisie à la création est
  définitive (seuls `public_token` et `programme` ont un chemin de
  mise à jour).
- **Aucun point de dépôt pour une pièce de niveau projet** : la 38a a
  élargi le rattachement (`project_id`, `phase_id`), mais l'interface
  ne propose le dépôt que sur une tâche, une ligne ou une photo de
  phase. Une **convention de financement** — la pièce fondatrice — n'a
  nulle part où aller. L'onglet Documents est inventaire seul.

### Responsable financier
**Fonctionne** : lignes, répartition sur les tâches, devis/factures,
marquer payée avec date, trois montants par ligne/phase/projet.
**Manque** :
- **Répartition par financeur** (prévu/engagé/payé par organisation) —
  livrable explicite de la spec §10.4 (« c'est la vue qu'attend un
  financeur »), non livré dans la PR 39.
- **Export CSV du budget** avec les trois montants — le reporting aux
  financeurs se fait aujourd'hui par recopie manuelle.

### Validateur / financeur (CD78, YCID)
**Le rôle le plus mal servi.** Le circuit de validation fonctionne,
mais :
- **aucune notification** quand un devis attend sa décision ;
- **aucune file « À valider »** : il faut ouvrir projet par projet,
  ligne par ligne, le dialogue de pièces pour découvrir qu'une
  validation attend. Un validateur qui ne fouille pas ne validera
  jamais — et « engagé » restera à zéro.
- Symétriquement, le déposant n'est pas prévenu de la décision.

### Référent mairie
Couvert (mêmes droits que le chef sur phases/tâches/budget). RAS.

### Contributeur terrain (ex. Azour — usage mobile)
**Fonctionne** : clavier corrigé, dépôt de pièces et photos, boutons
d'en-tête compactés.
**Manque** :
- **Photos une par une** : pas d'attribut `multiple` sur l'input. Au
  retour d'un chantier on a vingt photos, pas une.
- **HEIC invisible hors Safari** : le bucket accepte le HEIC (voulu —
  format par défaut des iPhone) mais `<img>` ne le rend ni dans
  Chrome ni dans Firefox : vignettes cassées pour tout le monde sauf
  l'auteur. Prévoir un repli d'affichage (icône + nom) ou une
  conversion.
- Tableau Budget à 9 colonnes : défilement horizontal pénible sous sm.

### Auditeur / lecteur
**Manque** : le Journal est plafonné aux **20 dernières entrées**, sans
pagination ni filtre. Pour un rôle dont c'est la fonction première,
c'est décoratif. Les archives de `phases.budget` (0033) y sont
d'ailleurs déjà hors de portée si le projet est actif.

### Product Owner (Bérengère Ayoub)
Roadmap participative en place. **À vérifier** : ses droits réels sur
« Gestion produit » (exige `is_platform_admin` ou `admin_org`
YCID/LEY — voir README). Pas d'onglet Déploiements/changelog (PR 18
partielle) : le produit vit vite, le fil des livraisons n'est visible
que dans GitHub.

### Admin plateforme
Écran Stockage livré. Restent de la Phase 3 : monitoring d'erreurs,
tests des parcours critiques, sauvegardes documentées (PR 20).

### Public / bénéficiaires (page vitrine)
La vitrine ignore tout ce que la Phase 5 a produit : ni photos
avant/après (pensées dès la 38c comme « matière première des supports
de communication »), ni montant voté. C'est la fenêtre de transparence
d'un programme public — elle mérite les preuves.

---

## Simplifications identifiées

1. **Règle « engagé » dupliquée** : `BudgetLineDocuments.tsx` embarque
   son propre `isEngaged`, copie de `lib/budget.isEngagedDoc`. C'est
   précisément la divergence que `lib/budget.ts` devait empêcher.
2. **Agrégats redondants dans la page projet** : `plannedByPhase`
   coexiste avec `finByPhase` dont `planned` porte la même valeur.
   Une seule structure suffit.
3. **Moyenne pondérée quasi morte** : elle ne s'active que si TOUTES
   les tâches d'une phase ont un budget > 0. Avec la règle « toute
   tâche porte un budget, 0 compris », une phase réelle contient
   presque toujours une tâche à 0 € (« signer la convention ») → le
   mode pondéré ne se déclenchera à peu près jamais. **Décision PO** :
   la retirer (simplification) ou pondérer en excluant les 0 avec
   mention explicite.
4. **`montant_tache` dans l'import CSV** : règle ajoutée « au cas où »,
   d'usage improbable (une tâche par ligne CSV, répartitions à
   l'écran). À confirmer à l'usage ; candidate au retrait si personne
   ne s'en sert.
5. **Page projet monolithique** (~800 lignes, 8 onglets dans un seul
   fichier) : découpage par onglet à programmer — dette, pas urgence.

---

## Programme du 26/07 — ordre d'exécution proposé

### P1 — le matin (haute valeur, faible/moyen effort)
| # | Sujet | Pourquoi d'abord |
|---|---|---|
| 1 | **File « À valider » + notifications** (soumission → org sollicitée ; décision → déposant) | Sans elle le circuit 38b ne tourne pas en vrai : personne ne sait qu'on l'attend |
| 2 | **Dépôt de pièce niveau projet/phase** dans l'onglet Documents | La convention n'a aucun point de dépôt ; débloque l'usage réel de la 38a |
| 3 | **Édition de la fiche projet** (dont montant voté, tracée au Journal) | La référence de la PR 39 est aujourd'hui figée par accident, pas par choix |
| 4 | **Renommer « Budget (€) » → « Montant voté (€) »** (création projet, aperçu, pilotage) | Ancrer la sémantique PR 39 partout où le chiffre apparaît |
| 5 | **Simplifications 1 + 2** (dédup `isEngaged`, fusion des agrégats) | 30 min, évite la prochaine divergence |

### P2 — l'après-midi
| # | Sujet |
|---|---|
| 6 | **Répartition par financeur** (prévu/engagé/payé par org) dans l'onglet Budget — la « vue financeur » §10.4 |
| 7 | **Journal complet** : pagination + filtres (entité, action, période) |
| 8 | **Pilotage portefeuille** : colonnes engagé/payé par projet (via `lib/budget`) |
| 9 | **Photos** : input `multiple` + repli d'affichage HEIC |

### P3 — à programmer ensuite
| # | Sujet |
|---|---|
| 10 | Vitrine publique : photos avant/après + montant voté |
| 11 | Export CSV du budget (trois montants, par ligne et par financeur) |
| 12 | Mobile : tableau Budget en cartes sous `sm` |
| 13 | Découpage de la page projet par onglet (dette) |
| 14 | Taille du digest IA à surveiller sur gros projets (lignes × pièces × validations) |

### Décisions PO à trancher avant de coder
- Moyenne pondérée : retirer, ou pondérer hors tâches à 0 € ?
- Validation : quand `validation_rules` est configurée avec plusieurs
  organisations, une seule validation suffit-elle toujours (règle
  actuelle) ou faut-il l'accord de chacune ?
- `montant_tache` (import CSV) : conserver ?
