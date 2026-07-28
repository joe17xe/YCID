-- ============================================================
-- Roadmap — Appels de fonds : promesses annuelles et relances (28/07)
-- ============================================================
-- Demande du 28/07, challengée et affinée — à passer une fois dans le
-- SQL Editor (donnée, pas migration). Idempotent.

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  ('Appels de fonds : les promesses annuelles et leurs relances',
   E'Demande du 28/07 : chaque année, des promesses de financement sont faites (YCID, mairies, LEY, MEAE, comités de jumelage…) et Bérengère doit relancer chacun pour le versement. Exemple 2026 : demander à la mairie de Villepreux de VERSER 2 000 € à LEY ; à LEY de RÉSERVER 1 000 € pour le projet ; à YCID de verser 17 000 € au comité de jumelage — et cela pour chaque projet.\n\nSPÉCIFICATION AFFINÉE (challenge du 28/07) :\n- une promesse est un FLUX entre organisations : projet, année, organisation payeuse (liste déroulante des organisations), organisation bénéficiaire (liste — vide = pour le projet lui-même, cas « réserver »), montant en saisie LIBRE, note, état : promis → demandé → reçu, chacun daté ;\n- saisie sur l''onglet Budget du projet, section « Appels de fonds » — mêmes droits que le budget (budget.manage : resp. financier, chef) ;\n- « en respect du budget si possible » : à côté de la saisie, l''écran affiche ce que budget_lines prévoit pour ce financeur cette année-là (funder_org_id + year) et SIGNALE l''écart — sans jamais bloquer : la promesse est la réalité politique, le budget la référence ;\n- bouton « Envoyer un rappel » par promesse : notification cloche + email aux comptes membres de l''organisation payeuse (canal notifyPeople existant) — texte : qui doit verser combien, à qui, pour quel projet ; trace last_reminder_at + Journal. Si l''organisation n''a AUCUN compte avec email, le bouton le DIT au lieu de laisser croire qu''un rappel est parti (« si on a l''info »).\n\nARBITRAGES :\n- ne PAS dupliquer le budget : l''appel de fonds est un flux org → org, la ligne budgétaire une dépense planifiée — les deux se comparent, ne se confondent pas ;\n- relances MANUELLES en v1 : relancer une mairie est un geste politique, c''est Bérengère qui appuie — jamais un robot. Extension v2 possible : un digest hebdomadaire à la responsable (promesses sans versement à l''approche de l''échéance) via le cron du VPS, qui existe depuis les sauvegardes ;\n- v1 sans rapprochement automatique avec le « payé » des pièces (lib/budget) : le passage à « reçu » est constaté à la main.\n\nEstimation : ~2 jours (migration 0,5 j + écran 1 j + notifications 0,5 j). Risque faible : tous les canaux existent.',
   'idee', 'haute', 3, array['budget','financement','relances','notifications'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status, priority from ideas where title like 'Appels de fonds%';
