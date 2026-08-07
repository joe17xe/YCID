-- ============================================================
-- Roadmap — l'idée Appels de fonds passe en « livrée » (07/08/2026)
-- ============================================================
-- Chantier lancé sur « On peut les appels de fonds » (07/08), spécifié
-- et arbitré en roadmap le 28/07, livré avec la migration 0066.
--
-- À passer APRÈS la migration 0066 et après avoir constaté le
-- déploiement. Idempotent, et autonome : si le seed d'entrée du 28/07
-- n'a pas encore été passé, l'idée est d'abord insérée, puis marquée
-- livrée. La description passe au récit « LIVRÉ » dans les deux cas —
-- même bloc `values` répété : un `with` ne porte que sur la requête
-- qui le suit.

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  ('Appels de fonds : les promesses annuelles et leurs relances',
   E'Demande du 28/07 : chaque année, des promesses de financement sont faites (YCID, mairies, LEY, MEAE, comités de jumelage…) et la directrice de programme doit relancer chacun pour le versement.\n\nLIVRÉ le 07/08 (migration 0066) :\n- section « Appels de fonds » sur l''onglet Budget de chaque projet : projet, année, organisation payeuse, bénéficiaire (vide = « réserver » pour le projet), montant en saisie LIBRE, note ;\n- états promis → demandé → reçu, chacun daté, retour en arrière permis (les dates des états quittés s''effacent) ;\n- la référence budgétaire s''affiche à côté de la saisie (ce que budget_lines prévoit pour ce financeur cette année-là, hors valorisation) et l''écart se signale — sans jamais bloquer : la promesse est la réalité politique, le budget la référence ;\n- bouton « Envoyer un rappel » : cloche + email aux comptes membres de l''organisation payeuse ; si elle n''a AUCUN compte, l''écran le dit au lieu de laisser croire qu''un rappel est parti. La relance vaut demande (promis → demandé). Relances MANUELLES — geste politique, jamais un robot ;\n- tout est tracé au Journal (création, modification, changement d''état, rappel, suppression), droits du budget (budget.manage), lecture pour tout membre du projet, auditeur compris.\n\nEXTENSION non comprise, à re-proposer en idée propre le jour venu :\n- digest hebdomadaire à la responsable (promesses sans versement à l''approche de l''échéance) via le cron du VPS : +0,5 j.',
   'idee', 'haute', 3, array['budget','financement','relances','notifications'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

with nouvelles(title, description) as (
  values
  ('Appels de fonds : les promesses annuelles et leurs relances',
   E'Demande du 28/07 : chaque année, des promesses de financement sont faites (YCID, mairies, LEY, MEAE, comités de jumelage…) et la directrice de programme doit relancer chacun pour le versement.\n\nLIVRÉ le 07/08 (migration 0066) :\n- section « Appels de fonds » sur l''onglet Budget de chaque projet : projet, année, organisation payeuse, bénéficiaire (vide = « réserver » pour le projet), montant en saisie LIBRE, note ;\n- états promis → demandé → reçu, chacun daté, retour en arrière permis (les dates des états quittés s''effacent) ;\n- la référence budgétaire s''affiche à côté de la saisie (ce que budget_lines prévoit pour ce financeur cette année-là, hors valorisation) et l''écart se signale — sans jamais bloquer : la promesse est la réalité politique, le budget la référence ;\n- bouton « Envoyer un rappel » : cloche + email aux comptes membres de l''organisation payeuse ; si elle n''a AUCUN compte, l''écran le dit au lieu de laisser croire qu''un rappel est parti. La relance vaut demande (promis → demandé). Relances MANUELLES — geste politique, jamais un robot ;\n- tout est tracé au Journal (création, modification, changement d''état, rappel, suppression), droits du budget (budget.manage), lecture pour tout membre du projet, auditeur compris.\n\nEXTENSION non comprise, à re-proposer en idée propre le jour venu :\n- digest hebdomadaire à la responsable (promesses sans versement à l''approche de l''échéance) via le cron du VPS : +0,5 j.'
  )
)
update ideas i
   set status = 'livree', description = n.description, updated_at = now()
  from nouvelles n
 where i.title = n.title
   and (i.status <> 'livree' or i.description <> n.description);

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status from ideas where title like 'Appels de fonds%';
