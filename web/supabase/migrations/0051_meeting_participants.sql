-- ============================================================
-- MIGRATION 0051 — Calendrier des réunions : invités et réponses
-- ============================================================
-- Priorisation du 28/07 : « la mise en place du calendrier des
-- réunions est très importante — urgence ». L'idée COPIL de la
-- roadmap passe en chantier : programmer un COPIL ou une réunion,
-- notifier automatiquement les invités, qui acceptent ou refusent
-- DANS l'application.
--
-- Le socle existait déjà (onglet COPIL, table meetings, cloche de
-- notifications, envoi d'emails) ; il manquait les invités par COMPTE.
-- meetings.attendees (texte libre) est CONSERVÉ pour les invités
-- extérieurs sans compte — élus, partenaires hors application (règle
-- n°4 : pas de suppression de colonne).
--
-- Arbitrage inchangé : les réponses se font dans l'application, pas
-- de service de calendrier externe. Extensions chiffrées à part dans
-- la roadmap (rappel de la veille, fichier .ics) : NON comprises ici.

-- 1. Une réunion a une heure et un lieu — une date seule ne suffit
--    pas à accepter en connaissance de cause.
alter table meetings add column if not exists start_time time;
alter table meetings add column if not exists location text;

-- 2. Les invités, par compte, avec leur réponse
create table if not exists meeting_participants (
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  response text not null default 'en_attente'
    check (response in ('en_attente', 'acceptee', 'refusee')),
  responded_at timestamptz,
  primary key (meeting_id, user_id)
);

alter table meeting_participants enable row level security;

-- Lire : les membres du projet voient qui est invité et qui a répondu
-- (même visibilité que la réunion elle-même).
create policy "Members see meeting participants" on meeting_participants
  for select using (
    is_project_member((select project_id from meetings where id = meeting_participants.meeting_id))
  );

-- Gérer la liste des invités : ceux qui tiennent les réunions — mêmes
-- rôles que la gestion des phases, plus les admins (0011).
create policy "Editors manage meeting participants" on meeting_participants
  for all using (
    is_admin() or is_lead_org_admin()
    or exists (
      select 1 from project_members pm
      where pm.project_id = (select project_id from meetings where id = meeting_participants.meeting_id)
        and pm.user_id = auth.uid()
        and pm.role in ('chef_projet', 'referent_mairie')
    )
  )
  with check (
    is_admin() or is_lead_org_admin()
    or exists (
      select 1 from project_members pm
      where pm.project_id = (select project_id from meetings where id = meeting_participants.meeting_id)
        and pm.user_id = auth.uid()
        and pm.role in ('chef_projet', 'referent_mairie')
    )
  );

-- Répondre : chacun SA ligne, et seulement la sienne. L'invitation ne
-- se refuse pas au nom d'un autre.
create policy "Participants answer their invitation" on meeting_participants
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select m.title, count(mp.user_id) as invites,
--          count(*) filter (where mp.response = 'acceptee') as acceptees
--     from meetings m left join meeting_participants mp on mp.meeting_id = m.id
--    group by m.id order by m.date desc;
