-- ============================================================
-- Alimentation de la roadmap — arbitrages et backlog du 27-28/07/2026
-- ============================================================
-- Suite de docs/roadmap-seed-2026-07.sql. Ce n'est PAS une migration :
-- c'est de la donnée, à passer une fois dans le SQL Editor.
--
-- Objet : que la roadmap DE L'APPLICATION porte tout le travail restant,
-- pour qu'une autre session — un autre compte, un autre assistant —
-- puisse reprendre le fil sans lire l'historique des conversations.
-- Chaque description contient le POURQUOI et les contraintes arbitrées :
-- c'est le cahier des charges, pas un pense-bête.
--
-- Idempotent : chaque idée n'est insérée que si son titre n'existe pas.
--
-- Statuts : « acceptee » = arbitré et programmé (feuille de route V1) ;
-- « idee » = backlog non engagé, à prioriser par le vote.

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values

  -- ================= Feuille de route V1 (arbitrée le 27/07) =========
  -- Référence : docs/feuille-de-route-v1-tableau-de-bord.md. Règle de
  -- lecture de la maquette : on prend la mise en scène, on garde NOS
  -- données. Cases à cocher et messagerie écartées (décor sans fonction).

  ('V1 — Barre latérale sombre et groupée',
   E'Maquette du 27/07 : fond sombre teinté de la couleur de marque, sections nommées (Projets, Suivi, Paramètres), état actif en pastille claire.\n\nContraintes arbitrées :\n- Sidebar.tsx et MobileNav.tsx partagent les entrées — UNE seule liste, pas deux copies ;\n- les couleurs restent des variables de marque : le white-label (0018) doit continuer de fonctionner pour une autre collectivité ;\n- contraste texte clair / fond sombre à vérifier (RGAA).\n\nEstimation : 1 jour. Risque faible, aucun SQL.',
   'acceptee', 'haute', 2, array['design','v1']),

  ('V1 — Tableau des projets enrichi (Pilotage)',
   E'Vers la maquette : colonne partenaires (project_organizations, déjà en base), drapeau du pays (Unicode, pas d''emoji image), tri par avancement / pays / nom, menu « ⋯ » par ligne (Ouvrir · Budget · Vitrine publique).\n\nPagination SEULEMENT au-delà de ~20 projets — trois projets paginés, c''est du décor.\n\nContrainte : le tableau reste en `table-cards` (rien ne sort du cadre du téléphone, contrôlé en CI par check:mobile).\n\nEstimation : 0,5 jour.',
   'acceptee', 'haute', 2, array['pilotage','design','v1']),

  ('V1 — Carte des interventions Yvelines-Liban',
   E'Le morceau neuf de la maquette : deux panneaux (Yvelines, Liban) avec un repère par projet, cliquable vers la fiche.\n\nChoix technique ARBITRÉ le 27/07 : SVG dessiné, zéro dépendance. Une bibliothèque cartographique (Leaflet…) tirerait des fonds de carte d''un serveur tiers — réseau, poids, RGPD — pour deux territoires qui ne changeront jamais.\n\n- Migration 0050 (numéro à vérifier) : projects.lat / projects.lng, saisies dans « Modifier la fiche du projet ». PAS de géocodage automatique.\n- Passe de saisie des coordonnées : Azour (Jezzine), Jeïta, Villepreux, Jouy-en-Josas…\n- Sur téléphone, les panneaux s''empilent.\n\nEstimation : 1,5 à 2 jours. Le soin du tracé fait la qualité perçue. Peut glisser d''une semaine sans rien casser : le plus visible, le moins structurant.',
   'acceptee', 'moyenne', 4, array['pilotage','design','v1','carte']),

  -- ================= Fiabilité (le seul risque non traité) ===========

  ('Sauvegardes vérifiées : couverture réelle + restauration éprouvée',
   E'Le seul risque du projet jamais regardé en face, arbitré le 27/07 pour la semaine de recette.\n\nATTENTION à un malentendu déjà survenu : ouvrir une pièce jointe et relire un devis prouve que le STOCKAGE fonctionne, pas qu''une sauvegarde existe. Une sauvegarde est une copie séparée qui survit à une suppression, une corruption, la perte du compte. Une sauvegarde jamais restaurée est une intention, pas une sauvegarde.\n\nÀ livrer :\n1. documenter ce que couvre l''offre Supabase du projet (base ET Storage — les devis, factures, feuilles d''émargement sont dans le bucket) ;\n2. une restauration RÉELLE éprouvée sur un environnement jetable, procédure écrite pas à pas ;\n3. un point de contrôle mensuel (date de la dernière sauvegarde vérifiable par l''admin).\n\nPour des justificatifs MEAE et de l''argent public, c''est l''exposition la plus sérieuse restante — elle est irréversible.',
   'acceptee', 'haute', 3, array['fiabilite','sauvegardes']),

  -- ================= Backlog fonctionnel =============================

  ('Export CSV du budget',
   E'Le compte rendu au Département et au MEAE se fait sur tableur. Exporter les lignes (poste, phase, financeur, année, prévu, engagé, payé, statut) avec les mêmes règles de calcul que l''écran — engagé = devis validés par TOUTES les organisations sollicitées, payé = pièces marquées réglées hors devis (lib/budget.ts, source unique).',
   'idee', 'moyenne', 2, array['budget','export']),

  ('Journal d''audit paginé et filtrable',
   E'Le Journal s''arrête aux 20 derniers événements, sans filtre. Pour un contrôleur : pagination, filtres par entité / personne / période, et lien vers l''objet concerné quand il existe encore.',
   'idee', 'moyenne', 2, array['audit']),

  ('Colonnes engagé / payé dans le Pilotage portefeuille',
   E'Le Pilotage montre le montant voté par projet, pas son exécution. Ajouter engagé et payé agrégés — mêmes sources que l''onglet Budget (lib/budget.ts), pour que le portefeuille et le projet ne puissent pas se contredire.',
   'idee', 'moyenne', 2, array['pilotage','budget']),

  ('Photos multiples et prise en charge HEIC',
   E'Le dépôt de photos de phase est unitaire, et un iPhone produit du HEIC que le navigateur n''affiche pas. Dépôt multiple + conversion ou repli HEIC. Les photos avant/pendant/après sont la preuve de réalisation attendue par les financeurs.',
   'idee', 'moyenne', 3, array['documents','photos','mobile']),

  ('Vitrine publique enrichie',
   E'La page publique (0021) est minimale. Y montrer ce qui vaut d''être montré : photos, montant voté, valorisation (part du cofinancement en nature), avancement — SANS les pièces ni le journal. Le lien reste non devinable et opt-in.',
   'idee', 'basse', 2, array['vitrine','communication']),

  ('Visibilité graduée par rôle d''organisation',
   E'Règle écrite le 27/07 dans docs/modele-appartenance-et-roles.md, volontairement NON construite : après reclassement des communes libanaises en partenaire, aucune organisation n''est réellement observatrice — des policies pour zéro utilisateur.\n\nLa construire LE JOUR où un vrai cas se présente (financeur institutionnel invité à suivre sans voir les pièces, bénéficiaire final) : un membre d''une organisation observateur/beneficiaire verrait le projet, les phases, l''avancement, les photos — ni budget, ni pièces, ni journal. is_project_member() ne distingue pas ces rôles aujourd''hui : c''est une migration, et une seule.',
   'idee', 'basse', 4, array['roles','rls']),

  ('Contrôle du format des emails à l''import CSV',
   E'L''import de comptes a laissé passer deux adresses malformées (point en tête) — dont celle d''un référent mairie, donc injoignable par notification. Valider le format à l''import, signaler les rejets dans le rapport, et proposer un écran de correction des adresses existantes.',
   'idee', 'moyenne', 1, array['import','email','qualite']),

  ('Alléger la page projet (plus de 1 100 lignes)',
   E'app/(app)/projets/[id]/page.tsx dépasse 1 100 lignes : chaque onglet mériterait son composant serveur. Dette nommée depuis le 26/07 ; le pouls (ProjectPulse), les prochaines étapes (NextSteps) et les tuiles (StatTile) sont déjà sortis. Poursuivre onglet par onglet, SANS big-bang : un onglet extrait = une PR.',
   'idee', 'basse', 3, array['dette','code']),

  ('Résorber les erreurs de lint (104)',
   E'La CI tolère le lint en continue-on-error : 104 erreurs au 27/07, en hausse. Résorber par lots jusqu''à pouvoir rendre le lint bloquant — après quoi plus aucune nouvelle erreur n''entre.',
   'idee', 'basse', 2, array['dette','ci']),

  -- ================= Processus (la question du 28/07) ================

  ('De la roadmap au déploiement : documenter et outiller la chaîne',
   E'Question posée le 28/07 : « je n''ai toujours pas compris comment on lance une proposition de la roadmap en PR et on déploie à travers cette app ».\n\nRéponse courte : l''application ne déploie PAS. La chaîne réelle est :\n1. l''idée vit ici (roadmap participative, votes) ;\n2. un assistant (Claude) l''implémente sur une branche et ouvre une PR GitHub — c''est un geste de développement, hors application ;\n3. la CI vérifie (types, 4 garde-fous, build), le merge est automatique quand elle passe ;\n4. le push sur master déclenche GitHub Actions sur le runner du serveur, qui exécute deploy.sh — c''est LE déploiement ;\n5. l''onglet « Déploiements » de la roadmap montre ce qui est en ligne (version affichée en pied de page).\n\nÀ livrer au titre de cette idée :\n- documenter cette chaîne dans la page Aide (elle n''est écrite nulle part pour un non-développeur) ;\n- sur une idée de la roadmap, un champ « référence PR » (lien GitHub) renseignable à la main, pour suivre idée → PR → livraison ;\n- au passage en « livrée », l''idée porte le lien de la PR qui l''a réalisée.\n\nNON retenu : créer des PR depuis l''application. Une PR se crée avec du code relu et des contrôles passés — un bouton qui ouvre une PR vide inverserait la chaîne.',
   'idee', 'moyenne', 2, array['processus','roadmap','aide'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n
  cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

-- Marquer livré ce qui l'a été depuis le seed du 26/07 : la roadmap
-- doit dire la vérité sur ce qui est en ligne.
update ideas set status = 'livree', updated_at = now()
 where title in (
   'File « À valider » + notifications in-app et email',
   'Dépôt d''une pièce au niveau projet ou phase',
   'Édition de la fiche projet, dont le montant voté',
   'Renommer « Budget » en « Montant voté » partout',
   'Validation des devis à l''unanimité'
 )
   and status <> 'livree';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select status, count(*) from ideas group by status order by status;
