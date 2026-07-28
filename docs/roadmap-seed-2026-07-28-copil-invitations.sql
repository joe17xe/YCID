-- ============================================================
-- Roadmap — COPIL : invitations, réponses, notifications (28/07)
-- ============================================================
-- Demande du 28/07 : « programmer un COPIL ou une réunion sur le
-- projet et notifier les gens automatiquement, qui doivent accepter
-- et répondre ». Décision : dans la roadmap, pas en chantier immédiat
-- (« pas forcément maintenant ») — statut « idee », à prioriser par
-- le vote.
--
-- Même règle que les seeds précédents : ce n'est PAS une migration,
-- c'est de la donnée, à passer une fois dans le SQL Editor.
-- Idempotent : l'idée n'est insérée que si son titre n'existe pas.

with auteur as (
  select id from profiles where lower(email) = 'joe.abinader@gmail.com' limit 1
),
nouvelles(title, description, status, priority, difficulty, tags) as (
  values
  ('COPIL et réunions : invitations, réponses et notifications automatiques',
   E'Demande du 28/07 : programmer un COPIL ou une réunion sur un projet et notifier automatiquement les personnes invitées, qui acceptent ou refusent dans l''application.\n\nCE QUI EXISTE DÉJÀ — le coût est celui d''un raccord, pas d''une construction :\n- l''onglet COPIL et la table meetings (titre, type, date, compte rendu, décisions rattachées) ;\n- la cloche de notifications in-app (notifyUser) et l''envoi d''emails (lib/mailer), déjà branchés sur le circuit de validation.\nMais les « participants » d''une réunion sont du TEXTE LIBRE (meetings.attendees) : personne n''est prévenu, personne ne répond.\n\nÀ CONSTRUIRE (~2 jours, risque faible) :\n1. Migration : meeting_participants (réunion, compte, réponse acceptée/refusée/en attente, date de réponse) + heure et lieu sur la réunion + policies RLS (les participants suivent la visibilité projet) — ~0,5 j ;\n2. Fiche COPIL : sélection des participants parmi les membres du projet, badges de réponse sur chaque réunion, boutons Accepter / Refuser pour l''invité connecté — ~1 j ;\n3. Notifications : cloche + email à l''invitation et à la modification ; la réponse est notifiée à l''organisateur — ~0,5 j.\n\nARBITRAGES :\n- meetings.attendees (texte libre) est CONSERVÉ pour les invités extérieurs sans compte — élus, partenaires hors application (règle n°4 : pas de suppression de colonne) ;\n- les réponses se font DANS l''application — pas de service de calendrier externe (même logique que la carte : réseau, RGPD).\n\nEXTENSIONS chiffrées à part, non comprises dans les 2 jours :\n- rappel automatique la veille : +0,5 à 1 j — il n''existe AUCUNE infrastructure de tâches planifiées dans l''application (tout est événementiel) ; pg_cron côté Supabase ou cron sur le VPS, à arbitrer avant ;\n- fichier .ics joint à l''email d''invitation (ajout au calendrier Outlook/Google en un clic, sans service externe) : +0,5 j.',
   'idee', 'moyenne', 3, array['copil','reunions','notifications'])
)
insert into ideas (title, description, status, priority, difficulty, tags, author_id)
select n.title, n.description, n.status, n.priority, n.difficulty, n.tags, a.id
  from nouvelles n
  cross join auteur a
 where not exists (select 1 from ideas i where i.title = n.title);

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select title, status, priority from ideas
--    where title like 'COPIL%';
