-- ============================================================
-- Roadmap — l'idée COPIL passe en « livrée » (28/07/2026, soir)
-- ============================================================
-- Priorisée « urgence » par l'utilisateur le jour même de son entrée
-- en roadmap, livrée dans la foulée : invitations par compte, réponse
-- acceptée/refusée dans l'application, notifications cloche + email à
-- l'invitation et à la réponse (migration 0051).
--
-- À passer APRÈS la migration 0051 et après avoir constaté le
-- déploiement. Les extensions restent chiffrées à part dans la
-- description (rappel de la veille, fichier .ics) : NON livrées, à
-- re-proposer en idées propres le jour venu.
--
-- Idempotent, et autonome : si le seed d'entrée du 28/07 n'a pas
-- encore été passé, l'idée est d'abord insérée, puis marquée livrée.

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  ('COPIL et réunions : invitations, réponses et notifications automatiques',
   E'Demande du 28/07 : programmer un COPIL ou une réunion sur un projet et notifier automatiquement les personnes invitées, qui acceptent ou refusent dans l''application.\n\nLIVRÉ le 28/07 (migration 0051) :\n- invités par compte sur chaque réunion, heure et lieu ;\n- notification cloche + email à l''invitation ;\n- réponse Accepter / Refuser dans l''onglet COPIL, notifiée à l''organisateur, tracée au Journal ;\n- meetings.attendees (texte libre) conservé pour les invités extérieurs sans compte.\n\nEXTENSIONS non comprises, à re-proposer en idées propres le jour venu :\n- rappel automatique la veille : +0,5 à 1 j — demande une infrastructure de tâches planifiées qui n''existe pas (pg_cron ou cron VPS, à arbitrer) ;\n- fichier .ics joint à l''email d''invitation : +0,5 j, sans service externe.',
   'idee', 'moyenne', 3, array['copil','reunions','notifications'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n
  cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

update ideas set status = 'livree', updated_at = now()
 where title = 'COPIL et réunions : invitations, réponses et notifications automatiques'
   and status <> 'livree';

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status from ideas where title like 'COPIL%';
