-- ============================================================
-- Alimentation de la roadmap participative — programme du 26/07/2026
-- ============================================================
-- Issu de docs/relecture-produit-2026-07.md. Ce n'est PAS une migration
-- (aucun changement de schéma) : c'est de la donnée, à passer une fois
-- dans le SQL Editor.
--
-- Idempotent : chaque idée n'est insérée que si son titre n'existe pas
-- déjà. Rejouer le script ne crée pas de doublons.
--
-- Statuts retenus : « acceptee » pour ce qui est arbitré et programmé
-- (P1, P2), « idee » pour le backlog non engagé (P3). Cela distingue à
-- l'écran ce qui est décidé de ce qui reste à décider.

with auteur as (
  -- Rattaché au compte administrateur : sans auteur, l'idée s'affiche
  -- sans nom et son édition depuis l'interface est refusée par la RLS.
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  -- ---------- P1 — matin du 26/07 ----------
  ('File « À valider » + notifications in-app et email',
   E'Le circuit de validation des devis (PR 38b) fonctionne, mais personne n''est prévenu qu''une décision est attendue : il faut ouvrir projet par projet, ligne par ligne, pour découvrir un devis en attente. Un validateur qui ne fouille pas ne valide jamais, et « engagé » reste à zéro.\n\nÀ livrer : une file « À valider » listant les décisions attendues de l''utilisateur, et des notifications à chaque étape — soumission vers l''organisation sollicitée, décision vers le déposant, tâche terminée vers le chef de projet.\n\nInfrastructure email entièrement configurable (SMTP saisi dans Configuration, jamais en dur), sur le modèle de la configuration IA. Bouton d''envoi de test, et repli silencieux tant que rien n''est configuré.\n\nD''autant plus urgent que la règle d''unanimité rend l''attente bloquante.',
   'acceptee', 'haute', 4, array['notifications','email','validation','budget']),

  ('Dépôt d''une pièce au niveau projet ou phase',
   E'La migration 0029 a élargi le rattachement des documents au projet et à la phase, mais aucune interface ne propose ce dépôt : on ne peut joindre une pièce qu''à une tâche, une ligne budgétaire, ou en photo de phase.\n\nConséquence : une convention de financement — la pièce fondatrice d''un projet — n''a nulle part où aller. L''onglet Documents est un inventaire seul, sans bouton de dépôt.',
   'acceptee', 'haute', 2, array['documents']),

  ('Édition de la fiche projet, dont le montant voté',
   E'Aucun écran ne permet de modifier un projet après sa création : ni le nom, ni les dates, ni la description, ni le montant. Seuls le programme et le lien public ont un chemin de mise à jour.\n\nDepuis la PR 39, le montant du projet est devenu LE montant voté, référence de toute l''analyse budgétaire. Une erreur de saisie à la création est aujourd''hui définitive — figée par accident, pas par choix.\n\nModification à tracer au Journal, le montant voté étant une donnée contractuelle.',
   'acceptee', 'haute', 3, array['projet','budget']),

  ('Renommer « Budget » en « Montant voté » partout',
   E'La PR 39 a donné un sens précis à projects.budget : le montant voté, référence contractuelle contre laquelle on compare la répartition des lignes. Les libellés n''ont pas suivi — création de projet, aperçu, liste des projets et pilotage affichent encore « Budget », mot qui désigne aussi la somme des lignes.\n\nDeux notions distinctes sous le même mot, c''est exactement ce qui a produit les divergences de phases.budget.',
   'acceptee', 'haute', 1, array['budget','clarte']),

  ('Validation des devis à l''unanimité',
   E'Aujourd''hui un devis compte comme engagé dès qu''UNE organisation sollicitée l''a validé. Arbitrage YCID du 25/07 : il faut l''accord de CHACUNE ; un seul refus rejette.\n\nConséquence assumée : une organisation qui ne répond pas bloque l''engagé. C''est précisément ce qui rend les notifications email indispensables.',
   'acceptee', 'haute', 2, array['validation','budget']),

  ('Avancement de phase pondéré, avec plancher à 2 %',
   E'La pondération par le budget ne s''active que si TOUTES les tâches d''une phase ont un budget supérieur à zéro. Avec la règle « toute tâche porte un budget, 0 compris », une phase réelle contient presque toujours une tâche à 0 € — le mode pondéré ne se déclenche donc jamais. C''est du code mort.\n\nArbitrage YCID du 25/07 : pondération systématique dès que la phase a du budget, avec un poids plancher — poids = max(budget de la tâche, 2 % du budget de la phase).\n\nUne tâche à 0 € pèse ainsi toujours au moins 2 % : la phase ne peut pas afficher 100 % tant que « signer la convention » n''est pas faite. Le plancher vaut pour toutes les tâches, sinon une tâche à 100 € pèserait moins qu''une tâche à 0 €.',
   'acceptee', 'haute', 2, array['avancement','budget']),

  ('Dédoublonner la règle « engagé » et les agrégats budgétaires',
   E'BudgetLineDocuments.tsx embarque sa propre fonction isEngaged, copie de lib/budget.isEngagedDoc — exactement la divergence que lib/budget.ts avait pour but d''empêcher.\n\nLa page projet calcule par ailleurs plannedByPhase en parallèle de finByPhase, dont le champ planned porte la même valeur.\n\nDette courte à solder avant qu''une règle ne change d''un côté seulement.',
   'acceptee', 'haute', 1, array['dette','budget']),

  -- ---------- P2 — après-midi du 26/07 ----------
  ('Répartition budgétaire par financeur',
   E'Livrable explicite de la spécification (§10.4, « c''est la vue qu''attend un financeur »), non livré par la PR 39 : prévu, engagé et payé ventilés par organisation financeuse.\n\nC''est la vue dont YCID et le Département ont besoin pour savoir ce que leur propre financement a produit, indépendamment des autres contributeurs.',
   'acceptee', 'moyenne', 3, array['budget','financeur','reporting']),

  ('Journal d''audit complet : pagination et filtres',
   E'Le Journal est plafonné aux 20 dernières entrées, sans pagination ni filtre. Pour l''auditeur, dont c''est la fonction première, c''est décoratif.\n\nCas concret : les budgets de phase archivés par la migration 0033 y sont déjà hors de portée sur un projet actif.\n\nÀ livrer : pagination, et filtres par entité, par action et par période.',
   'acceptee', 'moyenne', 2, array['audit','tracabilite']),

  ('Pilotage : engagé et payé par projet',
   E'La page Pilotage n''affiche que le montant de chaque projet. Depuis la PR 39, l''engagé et le payé sont calculables par lib/budget — les ajouter donne enfin une vue portefeuille de l''exécution réelle, et non du seul prévisionnel.',
   'acceptee', 'moyenne', 2, array['pilotage','budget']),

  ('Photos : dépôt multiple et repli d''affichage HEIC',
   E'Deux limites constatées en relecture.\n\nLe dépôt se fait une photo à la fois (pas d''attribut multiple) : au retour d''un chantier on en a vingt, pas une.\n\nLe bucket accepte le HEIC — voulu, c''est le format par défaut des iPhone donc de la majorité des photos de terrain — mais une balise img ne le rend ni dans Chrome ni dans Firefox. Les vignettes sont cassées pour tout le monde sauf l''auteur sous Safari. Prévoir un repli d''affichage (icône et nom de fichier) ou une conversion.',
   'acceptee', 'moyenne', 3, array['photos','mobile','terrain']),

  -- ---------- P3 — backlog non engagé ----------
  ('Vitrine publique : photos avant/après et montant voté',
   E'La page vitrine ignore tout ce que la Phase 5 a produit. Les photos avant/après ont pourtant été pensées dès la PR 38c comme « matière première des supports de communication », et le montant voté est une information de transparence attendue d''un programme public.\n\nC''est la fenêtre par laquelle les bénéficiaires et le grand public voient le projet : elle mérite les preuves.',
   'idee', 'moyenne', 3, array['vitrine','communication','photos']),

  ('Export CSV du budget avec les trois montants',
   E'Le reporting aux financeurs se fait aujourd''hui par recopie manuelle depuis l''écran. Un export reprenant prévu, engagé et payé — par ligne et par financeur — supprimerait cette recopie et les erreurs qu''elle produit.',
   'idee', 'moyenne', 2, array['budget','export','reporting']),

  ('Tableau Budget en cartes sur mobile',
   E'Le tableau budget compte désormais neuf colonnes. Sous la taille sm, le défilement horizontal le rend pénible à lire sur téléphone, alors que c''est le support de consultation en déplacement.\n\nPassage en cartes empilées plutôt qu''en tableau.',
   'idee', 'basse', 2, array['mobile','budget']),

  ('Onglet Déploiements / changelog',
   E'Reliquat de la PR 18. Le fil des livraisons n''est aujourd''hui visible que dans GitHub, donc inaccessible au Product Owner et aux partenaires.\n\nNeuf PR ont été livrées le 25/07 sans qu''aucune trace n''en apparaisse dans l''application. Pour un produit qui se date à chaque déploiement, c''est un signal de confiance perdu.',
   'idee', 'moyenne', 2, array['transparence','produit']),

  ('Découpage de la page projet par onglet',
   E'La page projet approche 800 lignes et porte huit onglets dans un seul fichier. Chaque nouvelle fonction l''alourdit et augmente le risque de régression sur un onglet voisin.\n\nDette technique, pas urgence : à programmer avant la prochaine grosse phase.',
   'idee', 'basse', 3, array['dette','technique']),

  ('Tests automatisés, monitoring et sauvegardes',
   E'PR 20 du backlog historique, jamais traitée. Neuf PR ont été déployées en une session sans un seul test automatisé — c''est un choix assumé, pas un oubli, mais il se paiera.\n\nDeux incidents de la session illustrent le manque : le circuit de validation était structurellement impossible depuis l''origine (aucune policy d''insertion), et le rapport IA s''est mis à se générer sans aucune phase après une suppression de colonne, sans message d''erreur.\n\nÀ livrer : tests des parcours critiques, remontée d''erreurs en production, sauvegardes documentées.',
   'idee', 'haute', 5, array['qualite','exploitation'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n
  left join auteur a on true
 where not exists (select 1 from ideas i where i.title = n.title);

-- Contrôle : liste ce qui vient d'être créé
select status, priority, difficulty, title
  from ideas
 order by case status when 'acceptee' then 0 else 1 end,
          case priority when 'haute' then 0 when 'moyenne' then 1 else 2 end,
          title;
