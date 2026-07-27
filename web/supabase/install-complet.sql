-- ============================================================================
-- SOLID'PILOT — INSTALLATION COMPLÈTE (Option A)
-- ============================================================================
-- ⚠️⚠️⚠️  SCRIPT DESTRUCTIF  ⚠️⚠️⚠️
-- Ce script SUPPRIME toutes les tables métier existantes (ancien schéma
-- simple comme nouveau schéma) puis installe le schéma complet du dépôt
-- (migrations 0001 → 0047 concaténées, à jour des correctifs).
-- À exécuter EN UNE FOIS dans le SQL Editor Supabase, uniquement après
-- avoir acté que les données actuelles sont jetables.
-- Généré depuis web/supabase/migrations/ — ne pas éditer à la main :
-- toute évolution passe par une nouvelle migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. NETTOYAGE — supprime l'existant (ancien prototype ET/OU installation
--    précédente de ce schéma). Les "if exists ... cascade" rendent le
--    script rejouable sans erreur.
-- ----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists trg_protect_profile_flags on public.profiles;

drop table if exists public.indicator_measures cascade;
drop table if exists public.indicators cascade;
drop table if exists public.decisions cascade;
drop table if exists public.meetings cascade;
drop table if exists public.notifications cascade;
drop table if exists public.ai_usage cascade;
drop table if exists public.audit_log cascade;
drop table if exists public.reviews cascade;
drop table if exists public.validations cascade;
drop table if exists public.documents cascade;
drop table if exists public.budget_lines cascade;
drop table if exists public.budget_categories cascade;
drop table if exists public.tasks cascade;
drop table if exists public.phases cascade;
drop table if exists public.validation_rules cascade;
drop table if exists public.project_members cascade;
drop table if exists public.project_organizations cascade;
drop table if exists public.projects cascade;
drop table if exists public.memberships cascade;
drop table if exists public.organizations cascade;
drop table if exists public.profiles cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.is_project_member(uuid) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_lead_org_admin() cascade;
drop function if exists public.can_edit_completed_tasks() cascade;
drop function if exists public.protect_profile_flags() cascade;
drop function if exists public.is_org_admin_of(uuid) cascade;
drop function if exists public.is_chef_projet(uuid) cascade;

drop type if exists org_type cascade;
drop type if exists org_status cascade;
drop type if exists membership_role cascade;
drop type if exists project_status cascade;
drop type if exists project_org_role cascade;
drop type if exists project_member_role cascade;
drop type if exists phase_status cascade;
drop type if exists task_status cascade;
drop type if exists doc_type cascade;
drop type if exists validation_decision cascade;
drop type if exists review_state cascade;
drop type if exists review_entity cascade;
drop type if exists line_status cascade;
drop type if exists line_category cascade;
drop type if exists indicator_kind cascade;
drop type if exists indicator_periodicity cascade;
drop type if exists indicator_source cascade;
drop type if exists meeting_kind cascade;
drop type if exists decision_status cascade;
drop type if exists audit_action cascade;


-- ════════════════ 0001_schema.sql ════════════════

-- ============================================================
-- SOLID'PILOT — YCID — Schéma Supabase complet (phases 1-4)
-- Coller dans l'éditeur SQL de votre projet Supabase
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- ÉNUMÉRATIONS
-- ============================================================
create type org_type as enum ('association','collectivite','partenaire_local','partenaire_medical','expert','financeur','financeur_public','mecene','autre');
create type org_status as enum ('active','inactive');
create type membership_role as enum ('admin_org','membre');
create type project_status as enum ('en_preparation','en_cours','suspendu','termine');
create type project_org_role as enum ('porteur','partenaire','financeur','observateur','partenaire_terrain','partenaire_medical','beneficiaire');
create type project_member_role as enum ('chef_projet','referent_mairie','resp_financier','contributeur','validateur','auditeur','lecteur');
create type phase_status as enum ('a_venir','en_cours','terminee');
create type task_status as enum ('a_faire','en_cours','terminee','bloquee');
create type doc_type as enum ('devis','facture','recu','justificatif','convention','note','etude','photo','livrable','rapport');
create type validation_decision as enum ('en_attente','valide','refuse');
create type review_state as enum ('brouillon','soumis','en_revue','valide','rejete');
create type review_entity as enum ('task','document','budget_line');
create type line_status as enum ('prevue','active','cloturee');
create type line_category as enum ('investissement','fonctionnement','projet','autre');
create type indicator_kind as enum ('quantitatif','qualitatif');
create type indicator_periodicity as enum ('mensuel','trimestriel','annuel','ponctuel');
create type indicator_source as enum ('manuelle','taches','import','document');
create type meeting_kind as enum ('copil','technique','terrain');
create type decision_status as enum ('a_faire','en_cours','fait');
create type audit_action as enum ('cree','modifie','soumis','en_revue','valide','rejete','paye','archive');

-- ============================================================
-- TABLES CORE
-- ============================================================

-- Profils utilisateurs (complète auth.users de Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null default '',
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Organisations
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type org_type not null default 'autre',
  country text not null default 'France',
  email text,
  status org_status not null default 'active',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Memberships utilisateur ↔ organisation
create table memberships (
  user_id uuid not null references profiles(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role membership_role not null default 'membre',
  primary key (user_id, org_id)
);

-- Projets
create table projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  country text,
  zone text,
  lat numeric,
  lng numeric,
  start_date date,
  end_date date,
  status project_status not null default 'en_preparation',
  budget numeric,
  currency text not null default 'EUR',
  lead_org_id uuid references organizations(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Rôles des organisations dans les projets
create table project_organizations (
  project_id uuid not null references projects(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  role project_org_role not null,
  primary key (project_id, org_id)
);

-- Membres du projet (rôle individuel)
create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role project_member_role not null,
  primary key (project_id, user_id)
);

-- Circuit de validation configurable par projet
create table validation_rules (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  doc_type doc_type not null default 'devis',
  role project_org_role not null
);

-- Phases
create table phases (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  position int not null default 0,
  start_date date,
  end_date date,
  status phase_status not null default 'a_venir',
  budget numeric
);

-- Tâches
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  phase_id uuid not null references phases(id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references profiles(id),
  start_date date,
  end_date date,
  status task_status not null default 'a_faire',
  progress int not null default 0 check (progress between 0 and 100),
  comment text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references tasks(id) on delete set null,
  budget_line_id uuid, -- FK vers budget_lines (ajoutée après)
  type doc_type not null,
  filename text not null,
  storage_path text,
  amount numeric,
  paid boolean not null default false,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

-- Validations de devis
create table validations (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references documents(id) on delete cascade,
  org_id uuid not null references organizations(id),
  decision validation_decision not null default 'en_attente',
  decided_by uuid references profiles(id),
  decided_at timestamptz,
  comment text
);

-- ============================================================
-- BUDGET (Phase 2)
-- ============================================================

-- Catégories budgétaires paramétrables
create table budget_categories (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id) on delete cascade, -- null = défaut plateforme
  name text not null
);

-- Lignes budgétaires
create table budget_lines (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  poste text not null,
  description text,
  category line_category not null default 'autre',
  funder_org_id uuid references organizations(id),
  owner_org_id uuid references organizations(id),
  year int,
  planned_amount numeric not null default 0,
  is_valorisation boolean not null default false,
  status line_status not null default 'prevue',
  comment text,
  created_at timestamptz not null default now()
);

-- FK documents → budget_lines
alter table documents add constraint fk_doc_budget_line
  foreign key (budget_line_id) references budget_lines(id) on delete set null;

-- ============================================================
-- WORKFLOW DE REVUE (Phase 3)
-- ============================================================

create table reviews (
  id uuid primary key default uuid_generate_v4(),
  entity review_entity not null,
  entity_id uuid not null,
  state review_state not null default 'brouillon',
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now(),
  comment text,
  unique (entity, entity_id)
);

-- Journal d'audit (append-only)
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid references projects(id),
  entity text not null,
  entity_id uuid,
  label text,
  action audit_action not null,
  user_id uuid references profiles(id),
  at timestamptz not null default now(),
  comment text
);

-- Notifications
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- IMPACT & PILOTAGE (Phase 4)
-- ============================================================

create table indicators (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  kind indicator_kind not null default 'quantitatif',
  unit text,
  periodicity indicator_periodicity not null default 'trimestriel',
  source indicator_source not null default 'manuelle',
  baseline numeric,
  target numeric not null,
  phase_id uuid references phases(id) on delete set null,
  created_at timestamptz not null default now()
);

create table indicator_measures (
  id uuid primary key default uuid_generate_v4(),
  indicator_id uuid not null references indicators(id) on delete cascade,
  period text not null,
  value numeric not null,
  comment text,
  doc_id uuid references documents(id) on delete set null,
  entered_by uuid references profiles(id),
  at timestamptz not null default now()
);

create table meetings (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  kind meeting_kind not null default 'copil',
  date date not null,
  attendees text[],
  minutes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table decisions (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid references meetings(id) on delete set null,
  project_id uuid not null references projects(id) on delete cascade,
  text text not null,
  owner_user_id uuid references profiles(id),
  due_date date,
  status decision_status not null default 'a_faire',
  task_id uuid references tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEX
-- ============================================================
create index on tasks(phase_id);
create index on phases(project_id);
create index on documents(task_id);
create index on documents(budget_line_id);
create index on budget_lines(project_id);
create index on budget_lines(phase_id);
create index on validations(document_id);
create index on reviews(entity, entity_id);
create index on audit_log(project_id);
create index on audit_log(at desc);
create index on indicators(project_id);
create index on indicator_measures(indicator_id);
create index on meetings(project_id);
create index on decisions(project_id);
create index on notifications(user_id, read_at);

-- ============================================================
-- TRIGGER : créer un profil automatiquement à l'inscription
-- ============================================================
-- search_path = public : le trigger s'exécute aussi dans la session de
-- GoTrue, dont le search_path ne contient pas public (cf. migration 0022).
create or replace function handle_new_user()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- RLS — Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table memberships enable row level security;
alter table projects enable row level security;
alter table project_organizations enable row level security;
alter table project_members enable row level security;
alter table phases enable row level security;
alter table tasks enable row level security;
alter table documents enable row level security;
alter table validations enable row level security;
alter table budget_lines enable row level security;
alter table reviews enable row level security;
alter table audit_log enable row level security;
alter table notifications enable row level security;
alter table indicators enable row level security;
alter table indicator_measures enable row level security;
alter table meetings enable row level security;
alter table decisions enable row level security;

-- Fonction helper : est-ce que l'utilisateur est membre d'un projet ?
create or replace function is_project_member(pid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from project_members
    where project_id = pid and user_id = auth.uid()
  ) or exists (
    select 1 from project_organizations po
    join memberships m on m.org_id = po.org_id
    where po.project_id = pid and m.user_id = auth.uid()
  );
$$;

-- Policies : profiles
create policy "Own profile" on profiles for all using (id = auth.uid());
create policy "Admins see all profiles" on profiles for select using (
  exists(select 1 from profiles where id = auth.uid() and is_platform_admin = true)
);

-- Policies : organizations (lisibles par tous les membres connectés)
create policy "Authenticated read orgs" on organizations for select using (auth.uid() is not null);
create policy "Org admins manage their org" on organizations for all using (
  exists(select 1 from memberships where user_id = auth.uid() and org_id = organizations.id and role = 'admin_org')
  or exists(select 1 from profiles where id = auth.uid() and is_platform_admin = true)
);
create policy "Auth users create orgs" on organizations for insert with check (auth.uid() is not null);

-- Policies : memberships
create policy "Read own memberships" on memberships for select using (user_id = auth.uid());
create policy "Org admin manage memberships" on memberships for all using (
  exists(select 1 from memberships m2 where m2.user_id = auth.uid() and m2.org_id = memberships.org_id and m2.role = 'admin_org')
);

-- Policies : projects
create policy "Members see projects" on projects for select using (is_project_member(id));
create policy "Admins see all projects" on projects for select using (
  exists(select 1 from profiles where id = auth.uid() and is_platform_admin = true)
);
create policy "Org admins create projects" on projects for insert with check (
  exists(select 1 from memberships where user_id = auth.uid() and role = 'admin_org')
);
create policy "Chef modify project" on projects for update using (
  exists(select 1 from project_members where project_id = id and user_id = auth.uid() and role in ('chef_projet'))
);

-- Policies : phases, tasks, documents, budget_lines, indicators, meetings, decisions
-- (accès via appartenance au projet)
create policy "Project members see phases" on phases for select using (is_project_member(project_id));
create policy "Chef manage phases" on phases for all using (
  exists(select 1 from project_members where project_id = phases.project_id and user_id = auth.uid() and role = 'chef_projet')
);

create policy "Project members see tasks" on tasks for select using (
  is_project_member((select project_id from phases where id = tasks.phase_id))
);
create policy "Contributeur manage tasks" on tasks for all using (
  exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id = auth.uid()
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
);

create policy "Project members see documents" on documents for select using (
  is_project_member((
    select ph.project_id from tasks t join phases ph on ph.id = t.phase_id where t.id = documents.task_id
  )) or is_project_member((
    select bl.project_id from budget_lines bl where bl.id = documents.budget_line_id
  ))
);
create policy "Upload documents" on documents for insert with check (auth.uid() is not null);

create policy "See budget lines" on budget_lines for select using (is_project_member(project_id));
create policy "Manage budget lines" on budget_lines for all using (
  exists(select 1 from project_members where project_id = budget_lines.project_id and user_id = auth.uid() and role in ('chef_projet','resp_financier'))
);

create policy "See indicators" on indicators for select using (is_project_member(project_id));
create policy "Manage indicators" on indicators for all using (
  exists(select 1 from project_members where project_id = indicators.project_id and user_id = auth.uid() and role in ('chef_projet','resp_financier'))
);

create policy "See measures" on indicator_measures for select using (
  is_project_member((select project_id from indicators where id = indicator_measures.indicator_id))
);
create policy "Add measure" on indicator_measures for insert with check (auth.uid() is not null);

create policy "See meetings" on meetings for select using (is_project_member(project_id));
create policy "Chef manage meetings" on meetings for all using (
  exists(select 1 from project_members where project_id = meetings.project_id and user_id = auth.uid() and role = 'chef_projet')
);

create policy "See decisions" on decisions for select using (is_project_member(project_id));
create policy "Manage decisions" on decisions for all using (
  exists(select 1 from project_members where project_id = decisions.project_id and user_id = auth.uid() and role in ('chef_projet'))
  or (owner_user_id = auth.uid())
);

create policy "Own notifications" on notifications for all using (user_id = auth.uid());
create policy "See audit" on audit_log for select using (is_project_member(project_id));

-- Validations
create policy "See validations" on validations for select using (auth.uid() is not null);
create policy "Decide validation" on validations for update using (
  exists(
    select 1 from memberships m
    where m.user_id = auth.uid() and m.org_id = validations.org_id
  )
);

-- ════════════════ 0002_rls_admin_patch.sql ════════════════

-- ============================================================
-- PATCH RLS — Les admins plateforme voient tout
-- À exécuter dans le SQL Editor Supabase
-- ============================================================
-- En redéfinissant is_project_member pour inclure les admins,
-- toutes les policies existantes laissent voir l'admin.

create or replace function is_project_member(pid uuid)
returns boolean language sql security definer as $$
  select
    exists (select 1 from profiles where id = auth.uid() and is_platform_admin = true)
    or exists (
      select 1 from project_members
      where project_id = pid and user_id = auth.uid()
    )
    or exists (
      select 1 from project_organizations po
      join memberships m on m.org_id = po.org_id
      where po.project_id = pid and m.user_id = auth.uid()
    );
$$;

-- ════════════════ 0003_rls_fix_recursion.sql ════════════════

-- ============================================================
-- FIX RLS — Récursion infinie sur profiles
-- À exécuter dans le SQL Editor Supabase
-- ============================================================
-- Problème : la policy "Admins see all profiles" interroge
-- profiles, ce qui déclenche à nouveau la policy => récursion.
-- Solution : fonction is_admin() en SECURITY DEFINER (bypass RLS).

-- 1. Fonction admin sans récursion
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_platform_admin = true
  );
$$;

-- 2. Recréer is_project_member avec is_admin()
create or replace function is_project_member(pid uuid)
returns boolean language sql security definer stable as $$
  select
    is_admin()
    or exists (
      select 1 from public.project_members
      where project_id = pid and user_id = auth.uid()
    )
    or exists (
      select 1 from public.project_organizations po
      join public.memberships m on m.org_id = po.org_id
      where po.project_id = pid and m.user_id = auth.uid()
    );
$$;

-- 3. Remplacer la policy récursive sur profiles
drop policy if exists "Admins see all profiles" on profiles;
create policy "Admins see all profiles" on profiles
  for select using (is_admin());

-- 4. Remplacer la policy récursive sur organizations
drop policy if exists "Org admins manage their org" on organizations;
create policy "Org admins manage their org" on organizations
  for all using (
    is_admin()
    or exists(select 1 from memberships where user_id = auth.uid() and org_id = organizations.id and role = 'admin_org')
  );

-- 5. Remplacer la policy récursive sur projects
drop policy if exists "Admins see all projects" on projects;
create policy "Admins see all projects" on projects
  for select using (is_admin());

-- ════════════════ 0004_rls_fix_project_orgs.sql ════════════════

-- ============================================================
-- FIX RLS — Policies manquantes sur project_organizations
-- et project_members (RLS activé mais aucune policy => deny)
-- À exécuter dans le SQL Editor Supabase
-- ============================================================

-- project_organizations : visible par les membres du projet et admins
drop policy if exists "See project orgs" on project_organizations;
create policy "See project orgs" on project_organizations
  for select using (is_project_member(project_id));

drop policy if exists "Manage project orgs" on project_organizations;
create policy "Manage project orgs" on project_organizations
  for all using (
    is_admin()
    or exists(
      select 1 from project_members
      where project_id = project_organizations.project_id
      and user_id = auth.uid() and role = 'chef_projet'
    )
  );

-- project_members : visible par les membres du projet et admins
drop policy if exists "See project members" on project_members;
create policy "See project members" on project_members
  for select using (is_project_member(project_id));

drop policy if exists "Manage project members" on project_members;
create policy "Manage project members" on project_members
  for all using (
    is_admin()
    or exists(
      select 1 from project_members pm2
      where pm2.project_id = project_members.project_id
      and pm2.user_id = auth.uid() and pm2.role = 'chef_projet'
    )
  );

-- ════════════════ 0005_rls_completed_tasks_admin.sql ════════════════

-- ============================================================
-- PATCH RLS — Modification des tâches terminées
-- À exécuter dans le SQL Editor Supabase
-- ============================================================
-- Règle métier :
--   · Une tâche TERMINÉE ne peut plus être modifiée par les
--     contributeurs / chefs de projet / resp. financiers.
--   · Seuls les admins plateforme et les admins d'organisation
--     YCID / LEY peuvent la rouvrir et la modifier.
--   · Toute modification est tracée dans audit_log (l'insertion
--     est autorisée par la policy ajoutée en bas de ce fichier).

-- Qui a le droit de modifier une tâche terminée ?
create or replace function can_edit_completed_tasks()
returns boolean language sql security definer as $$
  select
    exists (select 1 from profiles where id::text = auth.uid()::text and is_platform_admin = true)
    or exists (
      select 1 from memberships m
      join organizations o on o.id = m.org_id
      where m.user_id::text = auth.uid()::text
        and m.role = 'admin_org'
        and (upper(o.name) like '%YCID%' or upper(o.name) like '%LEY%')
    );
$$;

-- L'ancienne policy laissait les contributeurs modifier toutes les
-- tâches, y compris terminées. On la remplace par des policies par
-- commande pour exclure les tâches terminées.
drop policy if exists "Contributeur manage tasks" on tasks;
drop policy if exists "Contributeur insert tasks" on tasks;
drop policy if exists "Contributeur update open tasks" on tasks;
drop policy if exists "Contributeur delete open tasks" on tasks;
drop policy if exists "Admins manage tasks" on tasks;

create policy "Contributeur insert tasks" on tasks for insert with check (
  exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id::text = auth.uid()::text
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
);

-- USING porte sur la ligne existante : une tâche déjà terminée est
-- verrouillée. WITH CHECK ne re-teste que l'appartenance, pour que
-- l'on puisse encore passer une tâche EN COURS → TERMINÉE.
create policy "Contributeur update open tasks" on tasks for update using (
  tasks.status <> 'terminee'
  and exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id::text = auth.uid()::text
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
) with check (
  exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id::text = auth.uid()::text
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
);

create policy "Contributeur delete open tasks" on tasks for delete using (
  tasks.status <> 'terminee'
  and exists(
    select 1 from project_members pm
    join phases ph on ph.id = tasks.phase_id
    where pm.project_id = ph.project_id and pm.user_id::text = auth.uid()::text
    and pm.role in ('chef_projet','resp_financier','contributeur')
  )
);

-- Les admins YCID / LEY et admins plateforme gardent la main sur
-- toutes les tâches, terminées comprises.
create policy "Admins manage tasks" on tasks for all
  using (can_edit_completed_tasks())
  with check (can_edit_completed_tasks());

-- audit_log n'avait pas de policy d'insertion : nécessaire pour
-- tracer la réouverture d'une tâche terminée.
drop policy if exists "Insert audit" on audit_log;
create policy "Insert audit" on audit_log for insert with check (
  user_id::text = auth.uid()::text
  and (is_project_member(project_id) or can_edit_completed_tasks())
);

-- ════════════════ 0006_rls_security_hardening.sql ════════════════

-- ============================================================
-- PATCH SÉCURITÉ — Durcissement RLS
-- À exécuter dans le SQL Editor Supabase (après les patchs
-- rls-fix-recursion.sql et rls-fix-project-orgs.sql)
-- ============================================================
-- Corrige :
--   1. Escalade de privilèges : un utilisateur pouvait passer
--      son propre profil en is_platform_admin via l'API REST.
--   2. validation_rules et budget_categories sans RLS (lecture
--      et écriture ouvertes à tout utilisateur connecté).
--   3. Policies trop permissives (auth.uid() is not null) sur
--      documents, indicator_measures, organizations, validations.

-- ------------------------------------------------------------
-- 1. Verrou sur is_platform_admin
-- ------------------------------------------------------------
-- is_admin() est définie par rls-fix-recursion.sql ; on la
-- (re)crée ici pour rendre le patch autonome.
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id::text = auth.uid()::text and is_platform_admin = true
  );
$$;

create or replace function protect_profile_flags()
returns trigger language plpgsql security definer as $$
begin
  if TG_OP = 'INSERT' then
    if new.is_platform_admin and not is_admin() then
      raise exception 'is_platform_admin ne peut être attribué que par un administrateur';
    end if;
  elsif new.is_platform_admin is distinct from old.is_platform_admin and not is_admin() then
    raise exception 'is_platform_admin ne peut être modifié que par un administrateur';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_flags on profiles;
create trigger trg_protect_profile_flags
  before insert or update on profiles
  for each row execute function protect_profile_flags();

-- ------------------------------------------------------------
-- 2. RLS manquant : validation_rules et budget_categories
-- ------------------------------------------------------------
alter table validation_rules enable row level security;

drop policy if exists "See validation rules" on validation_rules;
create policy "See validation rules" on validation_rules
  for select using (is_project_member(project_id));

drop policy if exists "Chef manage validation rules" on validation_rules;
create policy "Chef manage validation rules" on validation_rules
  for all using (
    is_admin()
    or exists(
      select 1 from project_members
      where project_id = validation_rules.project_id
      and user_id::text = auth.uid()::text and role = 'chef_projet'
    )
  );

alter table budget_categories enable row level security;

-- project_id null = catégories par défaut de la plateforme
drop policy if exists "See budget categories" on budget_categories;
create policy "See budget categories" on budget_categories
  for select using (project_id is null or is_project_member(project_id));

drop policy if exists "Manage budget categories" on budget_categories;
create policy "Manage budget categories" on budget_categories
  for all using (
    is_admin()
    or (project_id is not null and exists(
      select 1 from project_members pm
      where pm.project_id = budget_categories.project_id
      and pm.user_id::text = auth.uid()::text and pm.role in ('chef_projet','resp_financier')
    ))
  );

-- ------------------------------------------------------------
-- 3. Policies trop permissives
-- ------------------------------------------------------------
-- Documents : l'upload exige d'être membre du projet de la tâche
-- ou de la ligne budgétaire cible (avant : tout connecté).
drop policy if exists "Upload documents" on documents;
create policy "Upload documents" on documents
  for insert with check (
    (task_id is not null and is_project_member((
      select ph.project_id from tasks t
      join phases ph on ph.id = t.phase_id
      where t.id = documents.task_id
    )))
    or (budget_line_id is not null and is_project_member((
      select bl.project_id from budget_lines bl
      where bl.id = documents.budget_line_id
    )))
  );

-- Mesures d'indicateurs : membres du projet uniquement.
drop policy if exists "Add measure" on indicator_measures;
create policy "Add measure" on indicator_measures
  for insert with check (
    is_project_member((
      select project_id from indicators
      where id = indicator_measures.indicator_id
    ))
  );

-- Création d'organisations : réservée aux admins plateforme
-- (aucune UI de création aujourd'hui ; à rouvrir avec l'écran
-- d'administration si besoin).
drop policy if exists "Auth users create orgs" on organizations;
create policy "Admins create orgs" on organizations
  for insert with check (is_admin());

-- Validations : visibles par les membres du projet du document
-- (avant : tout connecté).
drop policy if exists "See validations" on validations;
create policy "See validations" on validations
  for select using (
    is_project_member((
      select coalesce(
        (select ph.project_id from tasks t join phases ph on ph.id = t.phase_id where t.id = d.task_id),
        (select bl.project_id from budget_lines bl where bl.id = d.budget_line_id)
      )
      from documents d where d.id = validations.document_id
    ))
  );

-- ════════════════ 0007_admin_users.sql ════════════════

-- ============================================================
-- MIGRATION 0007 — Écran Administration > Utilisateurs
-- ============================================================
-- Les admins d'organisation YCID / LEY doivent pouvoir voir la
-- liste des utilisateurs et leurs rattachements (jusqu'ici seuls
-- les admins plateforme voyaient tous les profils, et personne
-- ne voyait les memberships des autres).

create or replace function is_lead_org_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id::text = auth.uid()::text
      and m.role = 'admin_org'
      and (upper(o.name) like '%YCID%' or upper(o.name) like '%LEY%')
  );
$$;

drop policy if exists "Lead org admins see profiles" on profiles;
create policy "Lead org admins see profiles" on profiles
  for select using (is_lead_org_admin());

drop policy if exists "Admins see memberships" on memberships;
create policy "Admins see memberships" on memberships
  for select using (is_admin() or is_lead_org_admin());

-- ════════════════ 0008_project_creation.sql ════════════════

-- ============================================================
-- MIGRATION 0008 — Création de projet depuis l'application
-- ============================================================
-- 1. Les admins plateforme peuvent créer des projets (la policy
--    d'origine exigeait un rôle admin_org dans une organisation).
-- 2. Juste après la création, le créateur doit pouvoir enregistrer
--    l'organisation porteuse et se déclarer chef de projet — les
--    policies « Manage ... » exigeaient d'être déjà chef_projet
--    (poule et œuf).

drop policy if exists "Org admins create projects" on projects;
create policy "Org admins create projects" on projects
  for insert with check (
    is_admin()
    or exists(select 1 from memberships where user_id::text = auth.uid()::text and role = 'admin_org')
  );

drop policy if exists "Creator bootstrap project orgs" on project_organizations;
create policy "Creator bootstrap project orgs" on project_organizations
  for insert with check (
    exists(
      select 1 from projects p
      where p.id = project_organizations.project_id and p.created_by::text = auth.uid()::text
    )
  );

drop policy if exists "Creator bootstrap project members" on project_members;
create policy "Creator bootstrap project members" on project_members
  for insert with check (
    user_id::text = auth.uid()::text and role = 'chef_projet'
    and exists(
      select 1 from projects p
      where p.id = project_members.project_id and p.created_by::text = auth.uid()::text
    )
  );

-- ════════════════ 0009_avatars.sql ════════════════

-- ============================================================
-- MIGRATION 0009 — Photo de profil (page Préférences)
-- ============================================================
-- Colonne avatar sur profiles + bucket Storage public « avatars ».
-- Chaque utilisateur ne peut écrire que dans son propre dossier
-- (avatars/<uid>/...), lecture publique (images de profil).

alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar read" on storage.objects;
create policy "Avatar read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Avatar upload" on storage.objects;
create policy "Avatar upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar update" on storage.objects;
create policy "Avatar update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Avatar delete" on storage.objects;
create policy "Avatar delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ════════════════ 0010_rls_fix_members_recursion.sql ════════════════

-- ============================================================
-- MIGRATION 0010 — Fix récursion infinie memberships / project_members
-- ============================================================
-- Deux policies s'auto-référençaient (« Org admin manage memberships »
-- sur memberships, « Manage project members » sur project_members),
-- provoquant « infinite recursion detected in policy » et des 500 en
-- cascade sur toutes les tables dont les policies interrogent
-- memberships ou project_members (organizations, phases, tasks,
-- documents, budget_lines, validations, indicators, meetings,
-- decisions). Même pattern de correction que le fix profiles (0003) :
-- fonctions SECURITY DEFINER qui contournent le RLS pour la
-- vérification d'appartenance.

-- Est-on admin_org de cette organisation ? (bypass RLS, pas de boucle)
create or replace function is_org_admin_of(oid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and org_id = oid and role = 'admin_org'
  );
$$;

-- Est-on chef de projet de ce projet ? (bypass RLS, pas de boucle)
create or replace function is_chef_projet(pid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.project_members
    where user_id = auth.uid() and project_id = pid and role = 'chef_projet'
  );
$$;

drop policy if exists "Org admin manage memberships" on memberships;
create policy "Org admin manage memberships" on memberships
  for all using (is_admin() or is_org_admin_of(org_id));

drop policy if exists "Manage project members" on project_members;
create policy "Manage project members" on project_members
  for all using (is_admin() or is_chef_projet(project_id));

-- ════════════════ 0011_admin_manage_phases.sql ════════════════

-- ============================================================
-- MIGRATION 0011 — Les admins gèrent les phases
-- ============================================================
-- La policy « Chef manage phases » (0001) réservait la gestion des
-- phases au seul chef_projet ; les admins plateforme / YCID / LEY
-- doivent pouvoir créer et modifier les phases de tout projet
-- (écran Tâches, PR 9).

drop policy if exists "Admins manage phases" on phases;
create policy "Admins manage phases" on phases
  for all
  using (is_admin() or is_lead_org_admin())
  with check (is_admin() or is_lead_org_admin());

-- ════════════════ 0012_import_runs.sql ════════════════

-- ============================================================
-- MIGRATION 0012 — Journal des imports CSV (PR 10)
-- ============================================================
-- Chaque exécution d'import devient un « run » tracé : type, fichier,
-- compteurs créées/ignorées, erreurs détaillées, auteur, date.
-- (pattern « Journal des synchronisations » d'OrthoPilot)

create table if not exists import_runs (
  id uuid primary key default uuid_generate_v4(),
  kind text not null,
  filename text,
  created_count int not null default 0,
  skipped_count int not null default 0,
  errors jsonb,
  status text not null default 'succes',
  by_user uuid references profiles(id),
  at timestamptz not null default now()
);

create index if not exists import_runs_at_idx on import_runs (at desc);

alter table import_runs enable row level security;

drop policy if exists "See import runs" on import_runs;
create policy "See import runs" on import_runs
  for select using (is_admin() or is_lead_org_admin() or by_user = auth.uid());

drop policy if exists "Insert import runs" on import_runs;
create policy "Insert import runs" on import_runs
  for insert with check (by_user = auth.uid());

-- ════════════════ 0013_admin_manage_project_data.sql ════════════════

-- ============================================================
-- MIGRATION 0013 — Les admins gèrent budget, impact et COPIL
-- ============================================================
-- Les policies d'origine réservaient ces tables aux rôles projet
-- (chef, resp_financier...) ; les admins plateforme / YCID / LEY
-- doivent pouvoir tout gérer (écrans Budget / Impact / COPIL, PR 15).

drop policy if exists "Admins manage budget lines" on budget_lines;
create policy "Admins manage budget lines" on budget_lines
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

drop policy if exists "Admins manage indicators" on indicators;
create policy "Admins manage indicators" on indicators
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

drop policy if exists "Admins manage measures" on indicator_measures;
create policy "Admins manage measures" on indicator_measures
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

drop policy if exists "Admins manage meetings" on meetings;
create policy "Admins manage meetings" on meetings
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

drop policy if exists "Admins manage decisions" on decisions;
create policy "Admins manage decisions" on decisions
  for all using (is_admin() or is_lead_org_admin()) with check (is_admin() or is_lead_org_admin());

-- ════════════════ 0014_roadmap.sql ════════════════

-- ============================================================
-- MIGRATION 0014 — Roadmap participative (PR 18)
-- ============================================================
-- Idées d'évolution proposées par les utilisateurs, votables et
-- commentables ; arbitrage (statut/priorité/difficulté) réservé aux
-- admins, appliqué côté serveur. Spec : docs/roadmap-feature-spec.md

create table if not exists ideas (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text not null default 'idee',
  priority text not null default 'moyenne',
  difficulty int check (difficulty between 1 and 5),
  tags text[],
  author_id uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists idea_votes (
  idea_id uuid not null references ideas(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create table if not exists idea_comments (
  id uuid primary key default uuid_generate_v4(),
  idea_id uuid not null references ideas(id) on delete cascade,
  author_id uuid references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists ideas_created_idx on ideas (created_at desc);
create index if not exists idea_comments_idea_idx on idea_comments (idea_id);

alter table ideas enable row level security;
alter table idea_votes enable row level security;
alter table idea_comments enable row level security;

-- Lecture : tous les connectés (la roadmap est commune)
drop policy if exists "Read ideas" on ideas;
create policy "Read ideas" on ideas for select using (auth.uid() is not null);
drop policy if exists "Read idea votes" on idea_votes;
create policy "Read idea votes" on idea_votes for select using (auth.uid() is not null);
drop policy if exists "Read idea comments" on idea_comments;
create policy "Read idea comments" on idea_comments for select using (auth.uid() is not null);

-- Proposer : chacun, en son nom
drop policy if exists "Propose idea" on ideas;
create policy "Propose idea" on ideas for insert with check (author_id = auth.uid());

-- Modifier / supprimer : l'auteur ou un admin (le tri statut/priorité/
-- difficulté réservé admin est appliqué par la server action)
drop policy if exists "Update own idea" on ideas;
create policy "Update own idea" on ideas for update
  using (author_id = auth.uid() or is_admin() or is_lead_org_admin());
drop policy if exists "Delete own idea" on ideas;
create policy "Delete own idea" on ideas for delete
  using (author_id = auth.uid() or is_admin() or is_lead_org_admin());

-- Votes : un par utilisateur, réversible
drop policy if exists "Vote" on idea_votes;
create policy "Vote" on idea_votes for insert with check (user_id = auth.uid());
drop policy if exists "Unvote" on idea_votes;
create policy "Unvote" on idea_votes for delete using (user_id = auth.uid());

-- Commentaires : chacun en son nom ; suppression auteur ou admin
drop policy if exists "Comment" on idea_comments;
create policy "Comment" on idea_comments for insert with check (author_id = auth.uid());
drop policy if exists "Delete comment" on idea_comments;
create policy "Delete comment" on idea_comments for delete
  using (author_id = auth.uid() or is_admin() or is_lead_org_admin());

-- ════════════════ 0015_project_members_mgmt.sql ════════════════

-- ============================================================
-- MIGRATION 0015 — Gestion des membres de projet
-- ============================================================
-- 1. Les admins YCID/LEY (non plateforme) doivent pouvoir gérer les
--    membres (la policy « Manage project members » ne couvrait que
--    is_admin() et le chef de projet).
-- 2. Tous les connectés peuvent lire les profils (noms/emails) :
--    nécessaire pour afficher les membres, assigner des tâches et
--    choisir un utilisateur à rattacher — outil interne, comptes
--    créés uniquement sur invitation.

drop policy if exists "Lead admins manage project members" on project_members;
create policy "Lead admins manage project members" on project_members
  for all using (is_lead_org_admin()) with check (is_lead_org_admin());

drop policy if exists "Members read profiles" on profiles;
create policy "Members read profiles" on profiles
  for select using (auth.uid() is not null);

-- ════════════════ 0016_admin_crud.sql ════════════════

-- ============================================================
-- MIGRATION 0016 — CRUD admin : organisations + suppression projet
-- ============================================================

-- 1. Les admins plateforme et YCID/LEY gèrent toutes les organisations
drop policy if exists "Admins manage all orgs" on organizations;
create policy "Admins manage all orgs" on organizations
  for all
  using (is_admin() or is_lead_org_admin())
  with check (is_admin() or is_lead_org_admin());

-- 2. Suppression de projet réservée aux admins (aucune policy delete
--    n'existait : la suppression était donc impossible pour tous)
drop policy if exists "Admins delete projects" on projects;
create policy "Admins delete projects" on projects
  for delete using (is_admin() or is_lead_org_admin());

-- 3. La suppression d'un projet doit emporter son journal d'audit.
--    audit_log.project_id n'avait pas de ON DELETE CASCADE : sans ça,
--    la suppression échouait sur la contrainte de clé étrangère.
alter table audit_log drop constraint if exists audit_log_project_id_fkey;
alter table audit_log
  add constraint audit_log_project_id_fkey
  foreign key (project_id) references projects(id) on delete cascade;

-- ════════════════ 0017_user_management.sql ════════════════

-- ============================================================
-- MIGRATION 0017 — Module de gestion des utilisateurs
-- ============================================================
-- Rôle plateforme à 3 niveaux + statut actif, sur profiles :
--   admin → Administrateur (accès complet, gère tout le monde)
--   ycid  → YCID (super user : accès complet, mais ne peut ni
--           supprimer ni modifier un Administrateur)
--   user  → Utilisateur
-- is_platform_admin reste synchronisé (admin/ycid => true) pour ne
-- rien casser des policies existantes.

alter table profiles add column if not exists platform_role text not null default 'user'
  check (platform_role in ('admin', 'ycid', 'user'));
alter table profiles add column if not exists active boolean not null default true;

-- Backfill : les admins plateforme existants deviennent 'admin'
update profiles set platform_role = 'admin' where is_platform_admin = true and platform_role = 'user';

-- is_admin() reconnaît aussi platform_role (admin/ycid), en plus du flag
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (is_platform_admin = true or platform_role in ('admin', 'ycid'))
  );
$$;

-- ============================================================
-- MIGRATION 0018 — Configuration de la marque (white-label)
-- ============================================================
create table if not exists platform_settings (
  id boolean primary key default true check (id),
  brand_name text not null default 'Solid''Pilot',
  tagline text not null default 'Pilotage de projets de solidarité internationale',
  accent_color text not null default '#0E6B5C',
  accent_soft_color text not null default '#E4F0EC',
  logo_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
insert into platform_settings (id) values (true) on conflict (id) do nothing;
alter table platform_settings enable row level security;
drop policy if exists "Platform settings read" on platform_settings;
create policy "Platform settings read" on platform_settings
  for select using (true);
drop policy if exists "Platform settings write" on platform_settings;
create policy "Platform settings write" on platform_settings
  for update using (is_admin()) with check (is_admin());
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;
drop policy if exists "Branding read" on storage.objects;
create policy "Branding read" on storage.objects
  for select using (bucket_id = 'branding');
drop policy if exists "Branding insert" on storage.objects;
create policy "Branding insert" on storage.objects
  for insert with check (bucket_id = 'branding' and is_admin());
drop policy if exists "Branding update" on storage.objects;
create policy "Branding update" on storage.objects
  for update using (bucket_id = 'branding' and is_admin());
drop policy if exists "Branding delete" on storage.objects;
create policy "Branding delete" on storage.objects
  for delete using (bucket_id = 'branding' and is_admin());

-- ============================================================
-- MIGRATION 0019 — Campagnes de communication (PR 26)
-- ============================================================
create table if not exists comm_campaigns (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  phase_id uuid references phases(id) on delete set null,
  trigger_kind text not null default 'manuelle'
    check (trigger_kind in ('kickoff', 'phase', 'objectif', 'cloture', 'manuelle')),
  title text not null,
  scheduled_date date,
  responsible_id uuid references profiles(id) on delete set null,
  status text not null default 'proposee'
    check (status in ('proposee', 'brouillon', 'validee', 'publiee', 'annulee')),
  languages text[] not null default array['fr', 'en', 'ar'],
  contents jsonb,
  checklist jsonb not null default
    '{"chiffres_ok": false, "mentions_ok": false, "images_ok": false}'::jsonb,
  published_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists comm_campaigns_project_idx
  on comm_campaigns(project_id, scheduled_date);
alter table comm_campaigns enable row level security;
drop policy if exists "See campaigns" on comm_campaigns;
create policy "See campaigns" on comm_campaigns
  for select using (is_project_member(project_id) or is_admin() or is_lead_org_admin());
drop policy if exists "Chef manage campaigns" on comm_campaigns;
create policy "Chef manage campaigns" on comm_campaigns
  for all
  using (is_chef_projet(project_id) or is_admin() or is_lead_org_admin())
  with check (is_chef_projet(project_id) or is_admin() or is_lead_org_admin());
drop policy if exists "Responsible update campaigns" on comm_campaigns;
create policy "Responsible update campaigns" on comm_campaigns
  for update using (responsible_id = auth.uid()) with check (responsible_id = auth.uid());

-- ============================================================
-- MIGRATION 0020 — Programme de rattachement (PR 27)
-- ============================================================
alter table projects add column if not exists programme text;
update projects set programme = 'CEM' where programme is null;

-- ============================================================
-- MIGRATION 0022 — Fix création de comptes : search_path des triggers
-- ============================================================
create or replace function public.protect_profile_flags()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if TG_OP = 'INSERT' then
    if new.is_platform_admin and not is_admin() then
      raise exception 'is_platform_admin ne peut être attribué que par un administrateur';
    end if;
  elsif new.is_platform_admin is distinct from old.is_platform_admin and not is_admin() then
    raise exception 'is_platform_admin ne peut être modifié que par un administrateur';
  end if;
  return new;
end;
$$;

-- ============================================================
-- MIGRATION 0021 — Page vitrine publique par projet (PR 28)
-- ============================================================
alter table projects add column if not exists public_token uuid;
create unique index if not exists projects_public_token_idx
  on projects(public_token) where public_token is not null;

-- ============================================================
-- MIGRATION 0023 — Configuration IA administrable (PR 31)
-- ============================================================
create table if not exists ai_settings (
  id boolean primary key default true check (id),
  provider text not null default 'gemini'
    check (provider in ('gemini', 'groq', 'openrouter', 'kimi', 'openai', 'autre')),
  base_url text not null default 'https://generativelanguage.googleapis.com/v1beta/openai',
  model text not null default 'gemini-3.5-flash',
  api_key text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
insert into ai_settings (id) values (true) on conflict (id) do nothing;
alter table ai_settings enable row level security;
drop policy if exists "Admins read ai settings" on ai_settings;
create policy "Admins read ai settings" on ai_settings
  for select using (is_admin());
drop policy if exists "Admins update ai settings" on ai_settings;
create policy "Admins update ai settings" on ai_settings
  for update using (is_admin()) with check (is_admin());

-- ============================================================
-- MIGRATION 0024 — Historique des rapports IA + brief de campagne
-- ============================================================
-- Rapport de test du 25/07/2026 :
--  · P0-3 « Aucune persistance » : fermer l'onglet perdait le rapport,
--    alors que l'usage attendu est un reporting daté et comparable ;
--  · P2-13 « Il n'y a pas de brief de campagne » : l'IA ne recevait que
--    titre, date et langues — d'où des contenus génériques.

-- ------------------------------------------------------------
-- 1. Historique des rapports d'expertise
-- ------------------------------------------------------------
create table if not exists ai_reports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  content text not null,
  model text,
  instructions text,
  truncated boolean not null default false,
  tokens int,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_reports_project_idx
  on ai_reports(project_id, created_at desc);

alter table ai_reports enable row level security;

drop policy if exists "See ai reports" on ai_reports;
create policy "See ai reports" on ai_reports
  for select using (is_project_member(project_id) or is_admin() or is_lead_org_admin());

drop policy if exists "Create ai reports" on ai_reports;
create policy "Create ai reports" on ai_reports
  for insert with check (is_project_member(project_id) or is_admin() or is_lead_org_admin());

drop policy if exists "Delete ai reports" on ai_reports;
create policy "Delete ai reports" on ai_reports
  for delete using (is_chef_projet(project_id) or is_admin() or is_lead_org_admin());

-- ------------------------------------------------------------
-- 2. Brief de campagne (canaux, audience, objectif, ton, message clé)
-- ------------------------------------------------------------
alter table comm_campaigns add column if not exists brief jsonb;

-- ============================================================
-- MIGRATION 0025 — Mentions légales administrables (RGPD)
-- ============================================================
-- Rapport de test du 25/07/2026, point 21 : les pages légales
-- contenaient encore « [adresse à compléter] » et « [email de contact à
-- compléter] » EN PRODUCTION. Plutôt que de figer ces valeurs dans le
-- code, elles deviennent paramétrables par un administrateur.
--
-- Ces informations sont PUBLIQUES par nature (mentions légales) : elles
-- rejoignent donc platform_settings, dont la lecture est publique et
-- l'écriture réservée aux administrateurs.

alter table platform_settings add column if not exists legal_entity text
  not null default 'YCID — Yvelines Coopération Internationale et Développement';
alter table platform_settings add column if not exists legal_address text;
alter table platform_settings add column if not exists legal_publisher text;
alter table platform_settings add column if not exists legal_email text;
alter table platform_settings add column if not exists legal_retention text;

-- ============================================================
-- MIGRATION 0026 — Modèle de rôles : expert et référent Mairie
-- ============================================================
-- Décision produit du 25/07/2026 :
--  · un chef de projet est rattaché à une organisation « expert » et
--    peut intervenir sur PLUSIEURS projets, y compris de communes
--    différentes — déjà possible, les rôles étant portés par projet ;
--  · une commune ne voit QUE ses projets — déjà garanti par
--    is_project_member(), qui accorde la visibilité aux membres d'une
--    organisation rattachée au projet (memberships → project_organizations) ;
--  · le référent d'une commune est un rôle DISTINCT du chef de projet :
--    sans cette distinction, la règle « chef de projet = organisation
--    expert » contredisait le cas d'un agent municipal pilotant le
--    projet de sa propre commune.
--
-- YCID / Département des Yvelines conserve la vision de l'ensemble des
-- projets via is_admin() / is_lead_org_admin() (inchangé).

-- 1. Type d'organisation « expert » (cabinets, experts indépendants)
-- (base neuve : valeur déjà présente dans l'énumération)

-- 2. Rôle projet « référent Mairie » (agent de la collectivité porteuse)
-- (base neuve : valeur déjà présente dans l'énumération)

-- 3. Durcissement : is_project_member() est SECURITY DEFINER sans
--    search_path figé — même faiblesse que celle corrigée en 0022 pour
--    les triggers. La logique est inchangée (membre du projet OU membre
--    d'une organisation rattachée au projet).
create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid()
  ) or exists (
    select 1 from public.project_organizations po
    join public.memberships m on m.org_id = po.org_id
    where po.project_id = pid and m.user_id = auth.uid()
  );
$$;

-- ============================================================================
-- CORRECTIF FINAL — promotion du premier admin depuis le SQL Editor
-- ============================================================================
-- Le trigger protect_profile_flags (migration 0006) bloque toute modification
-- de is_platform_admin par un non-admin. Or dans le SQL Editor (et via la clé
-- service_role côté serveur), auth.uid() est NULL : sans cette exception, il
-- serait impossible de promouvoir le tout premier administrateur.
-- auth.uid() NULL = contexte privilégié (superuser/service role), jamais un
-- utilisateur final : l'exception est donc sûre (le RLS bloque déjà les anon).
create or replace function protect_profile_flags()
returns trigger language plpgsql security definer as $$
begin
  if auth.uid() is null then
    return new; -- SQL Editor / service role : autorisé
  end if;
  if TG_OP = 'INSERT' then
    if new.is_platform_admin and not is_admin() then
      raise exception 'is_platform_admin ne peut être attribué que par un administrateur';
    end if;
  elsif new.is_platform_admin is distinct from old.is_platform_admin and not is_admin() then
    raise exception 'is_platform_admin ne peut être modifié que par un administrateur';
  end if;
  return new;
end;
$$;


-- ============================================================================
-- MIGRATION 0027 — task budget link
-- ============================================================================

-- ============================================================
-- PR 40 — Lien lignes budgétaires ↔ tâches
-- ============================================================
-- Cadrage YCID : « une ligne budgétaire est une tâche ; on peut ajouter
-- une tâche supplémentaire sans budget (signer un contrat…) ».
--
-- Modèle retenu : N lignes → 1 tâche, et non un 1:1 strict. Trois cas
-- réels du programme CEM ne rentrent pas dans un 1:1 :
--   · co-financement — un même livrable financé par le Département, la
--     Mairie et l'association donne trois lignes (financeurs distincts) ;
--     en 1:1 le même travail apparaîtrait trois fois dans les tâches ;
--   · valorisations (bénévolat, locaux) — ce ne sont pas des tâches ;
--   · frais de structure — aucun livrable daté.
-- Les deux extrémités restent possibles : tâche sans ligne, ligne sans
-- tâche. D'où une colonne NULLABLE.

alter table budget_lines
  add column if not exists task_id uuid references tasks(id) on delete set null;

create index if not exists budget_lines_task_id_idx on budget_lines(task_id);

-- Cohérence structurelle. Rien ne vérifiait jusqu'ici que la phase d'une
-- ligne appartenait bien au projet de cette ligne : on ferme aussi ce
-- trou au passage, sinon le regroupement par phase peut afficher des
-- lignes venues d'un autre projet.
create or replace function public.check_budget_line_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_phase uuid;
  v_phase_project uuid;
begin
  if new.task_id is not null then
    select t.phase_id into v_task_phase from tasks t where t.id = new.task_id;
    if v_task_phase is null then
      raise exception 'Tâche introuvable.';
    end if;
    if new.phase_id is null then
      -- Aligner plutôt que refuser : choisir la tâche suffit à situer la ligne.
      new.phase_id := v_task_phase;
    elsif new.phase_id <> v_task_phase then
      raise exception 'La tâche financée n''appartient pas à la phase de la ligne budgétaire.';
    end if;
  end if;

  if new.phase_id is not null then
    select ph.project_id into v_phase_project from phases ph where ph.id = new.phase_id;
    if v_phase_project is distinct from new.project_id then
      raise exception 'La phase sélectionnée n''appartient pas au projet de la ligne budgétaire.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_budget_line_coherence on budget_lines;
create trigger trg_budget_line_coherence
  before insert or update on budget_lines
  for each row execute function public.check_budget_line_coherence();

-- ============================================================================
-- MIGRATION 0028 — budget line task split
-- ============================================================================

-- ============================================================
-- PR 40b — Répartition d'une ligne budgétaire sur plusieurs tâches
-- ============================================================
-- Précision du cadrage YCID (25/07/2026), postérieure à la 0027 :
-- « une ligne budgétaire peut avoir plusieurs tâches ; un budget de
-- 40 000 € peut être divisé en deux tâches, 10 000 € et 30 000 € ».
--
-- La 0027 posait `budget_lines.task_id` : UNE ligne → UNE tâche, pour
-- la TOTALITÉ du montant. Cette colonne ne peut structurellement pas
-- porter une répartition — il n'y a nulle part où écrire « 10 000 sur
-- celle-ci, 30 000 sur celle-là ». D'où une table de liaison portant
-- le montant affecté.
--
-- Le modèle devient N:M avec montant, et couvre les quatre cas réels :
--   · co-financement — plusieurs lignes financent une même tâche
--     (Département + Mairie + association sur le même livrable) ;
--   · répartition — une ligne se répartit sur plusieurs tâches ;
--   · ligne sans tâche — valorisation, frais de structure ;
--   · tâche sans ligne — « signer la convention », budget 0 €.
--
-- La ligne conserve son `planned_amount` intact : c'est la vérité de
-- la convention de financement, qu'on ne découpe pas. La répartition
-- est opérationnelle et vient par-dessus. La somme des affectations
-- peut donc être INFÉRIEURE au montant de la ligne (reste non
-- affecté), jamais supérieure.

create table if not exists budget_line_tasks (
  budget_line_id uuid not null references budget_lines(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  amount numeric not null default 0 check (amount >= 0),
  primary key (budget_line_id, task_id)
);

create index if not exists budget_line_tasks_task_id_idx on budget_line_tasks(task_id);

-- Reprise des données de la 0027 : le lien 1:1 existant devient une
-- affectation de la totalité du montant. Sans cela, les rattachements
-- saisis entre les deux migrations seraient perdus en silence.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'budget_lines' and column_name = 'task_id'
  ) then
    insert into budget_line_tasks (budget_line_id, task_id, amount)
    select bl.id, bl.task_id, coalesce(bl.planned_amount, 0)
      from budget_lines bl
     where bl.task_id is not null
    on conflict do nothing;
  end if;
end $$;

drop index if exists budget_lines_task_id_idx;
alter table budget_lines drop column if exists task_id;

-- ------------------------------------------------------------
-- RLS : strictement alignée sur budget_lines. Une affectation n'a pas
-- de droits propres — elle suit la ligne qu'elle découpe.
-- ------------------------------------------------------------
alter table budget_line_tasks enable row level security;

drop policy if exists "See budget line tasks" on budget_line_tasks;
create policy "See budget line tasks" on budget_line_tasks for select using (
  exists (
    select 1 from budget_lines bl
     where bl.id = budget_line_tasks.budget_line_id
       and is_project_member(bl.project_id)
  )
);

drop policy if exists "Manage budget line tasks" on budget_line_tasks;
create policy "Manage budget line tasks" on budget_line_tasks for all using (
  exists (
    select 1 from budget_lines bl
      join project_members pm on pm.project_id = bl.project_id
     where bl.id = budget_line_tasks.budget_line_id
       and pm.user_id = auth.uid()
       and pm.role in ('chef_projet', 'resp_financier')
  )
) with check (
  exists (
    select 1 from budget_lines bl
      join project_members pm on pm.project_id = bl.project_id
     where bl.id = budget_line_tasks.budget_line_id
       and pm.user_id = auth.uid()
       and pm.role in ('chef_projet', 'resp_financier')
  )
);

drop policy if exists "Admins manage budget line tasks" on budget_line_tasks;
create policy "Admins manage budget line tasks" on budget_line_tasks
  for all using (is_admin() or is_lead_org_admin())
  with check (is_admin() or is_lead_org_admin());

-- ------------------------------------------------------------
-- Cohérence
-- ------------------------------------------------------------
-- La 0027 validait `new.task_id`, colonne qui vient de disparaître :
-- la fonction est remplacée, sans quoi les écritures sur budget_lines
-- échoueraient. Elle conserve le contrôle phase ↔ projet (trou de la
-- 0001) et gagne deux règles liées à la répartition.
create or replace function public.check_budget_line_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phase_project uuid;
  v_bad_task text;
  v_allocated numeric;
begin
  if new.phase_id is not null then
    select ph.project_id into v_phase_project from phases ph where ph.id = new.phase_id;
    if v_phase_project is distinct from new.project_id then
      raise exception 'La phase sélectionnée n''appartient pas au projet de la ligne budgétaire.';
    end if;
  end if;

  -- Changer la phase d'une ligne déjà répartie rendrait ses
  -- affectations incohérentes : on refuse plutôt que de les détacher
  -- en silence.
  if tg_op = 'UPDATE' and new.phase_id is distinct from old.phase_id then
    select t.title into v_bad_task
      from budget_line_tasks blt
      join tasks t on t.id = blt.task_id
     where blt.budget_line_id = new.id
       and (new.phase_id is null or t.phase_id <> new.phase_id)
     limit 1;
    if v_bad_task is not null then
      raise exception 'La tâche « % » financée par cette ligne n''appartient pas à la nouvelle phase. Retirez l''affectation avant de changer de phase.', v_bad_task;
    end if;
  end if;

  -- Baisser le montant sous la somme déjà répartie créerait une ligne
  -- qui finance plus qu'elle ne porte.
  if tg_op = 'UPDATE' then
    select coalesce(sum(blt.amount), 0) into v_allocated
      from budget_line_tasks blt where blt.budget_line_id = new.id;
    if v_allocated > coalesce(new.planned_amount, 0) then
      raise exception 'Le montant de la ligne (%) est inférieur à la somme déjà répartie sur les tâches (%).', coalesce(new.planned_amount, 0), v_allocated;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_budget_line_coherence on budget_lines;
create trigger trg_budget_line_coherence
  before insert or update on budget_lines
  for each row execute function public.check_budget_line_coherence();

-- Symétrique, côté affectation.
create or replace function public.check_budget_line_task_coherence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line_phase uuid;
  v_line_amount numeric;
  v_task_phase uuid;
  v_allocated numeric;
begin
  select bl.phase_id, coalesce(bl.planned_amount, 0)
    into v_line_phase, v_line_amount
    from budget_lines bl where bl.id = new.budget_line_id;
  select t.phase_id into v_task_phase from tasks t where t.id = new.task_id;
  if v_task_phase is null then
    raise exception 'Tâche introuvable.';
  end if;

  if v_line_phase is null then
    -- Aligner plutôt que refuser : affecter une tâche suffit à situer
    -- la ligne dans une phase (comportement retenu en 0027).
    update budget_lines set phase_id = v_task_phase where id = new.budget_line_id;
  elsif v_line_phase <> v_task_phase then
    raise exception 'La tâche financée n''appartient pas à la phase de la ligne budgétaire.';
  end if;

  select coalesce(sum(blt.amount), 0) into v_allocated
    from budget_line_tasks blt
   where blt.budget_line_id = new.budget_line_id
     and blt.task_id <> new.task_id;
  if v_allocated + new.amount > v_line_amount then
    raise exception 'La répartition (%) dépasse le montant de la ligne (%).', v_allocated + new.amount, v_line_amount;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_budget_line_task_coherence on budget_line_tasks;
create trigger trg_budget_line_task_coherence
  before insert or update on budget_line_tasks
  for each row execute function public.check_budget_line_task_coherence();

-- ============================================================================
-- MIGRATION 0029 — documents storage
-- ============================================================================

-- ============================================================
-- PR 38a — Socle documentaire : bucket, rattachement, RLS
-- ============================================================
-- État de départ : la table `documents` existe depuis la 0001 (colonnes
-- storage_path, type, amount, paid…) et l'enum doc_type couvre déjà les
-- dix natures utiles. Mais RIEN n'était branché : aucun bucket Storage,
-- aucune server action, aucun composant de dépôt, aucune requête
-- `from('documents')` dans l'application. Le seul usage était le
-- compteur « 📎 N doc » sur les tâches, structurellement toujours à 0.
--
-- Cette migration ne livre pas de fonction métier visible : c'est la
-- plomberie sur laquelle reposent les PR 38b à 38e.

-- ------------------------------------------------------------
-- 1. Rattachement élargi
-- ------------------------------------------------------------
-- Un document ne pouvait se rattacher qu'à une tâche ou à une ligne
-- budgétaire. Impossible d'attacher une convention au projet, ou des
-- photos à une phase, sans inventer une tâche pour les porter.
--
-- `project_id` devient le rattachement de référence : toutes les RLS
-- s'appuient dessus. Les policies d'origine remontaient au projet par
-- sous-requête à travers tasks → phases, ce qui les rendait à la fois
-- coûteuses et aveugles aux documents sans tâche.
alter table documents
  add column if not exists project_id uuid references projects(id) on delete cascade,
  add column if not exists phase_id   uuid references phases(id)   on delete set null;

-- Reprise de l'existant AVANT la contrainte NOT NULL : le projet se
-- déduit de la tâche ou de la ligne selon le cas.
update documents d set project_id = ph.project_id
  from tasks t join phases ph on ph.id = t.phase_id
 where d.task_id = t.id and d.project_id is null;

update documents d set project_id = bl.project_id
  from budget_lines bl
 where d.budget_line_id = bl.id and d.project_id is null;

update documents d set phase_id = t.phase_id
  from tasks t
 where d.task_id = t.id and d.phase_id is null;

-- Un document sans projet n'est rattachable à rien et invisible sous
-- RLS : on refuse plutôt que de laisser des orphelins silencieux.
do $$
declare n int;
begin
  select count(*) into n from documents where project_id is null;
  if n > 0 then
    raise exception 'Migration 0029 : % document(s) sans projet identifiable. Rattachez-les ou supprimez-les avant de rejouer.', n;
  end if;
end $$;

alter table documents alter column project_id set not null;

create index if not exists documents_project_id_idx on documents(project_id);
create index if not exists documents_phase_id_idx   on documents(phase_id);

-- ------------------------------------------------------------
-- 2. Qui peut déposer
-- ------------------------------------------------------------
-- La lecture suit l'appartenance au projet ; le dépôt exige un rôle
-- actif. `validateur`, `auditeur` et `lecteur` consultent sans déposer.
create or replace function public.can_upload_document(pid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(pid is not null and (
    exists (
      select 1 from project_members pm
       where pm.project_id = pid and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'resp_financier', 'contributeur', 'referent_mairie')
    )
    or is_admin() or is_lead_org_admin()
  ), false);
$$;

-- ------------------------------------------------------------
-- 3. RLS de la table documents
-- ------------------------------------------------------------
-- Les policies de la 0001 / 0006 passaient par task_id ou
-- budget_line_id : un document rattaché seulement au projet ou à une
-- phase serait resté invisible. Elles sont remplacées, pas complétées.
drop policy if exists "Project members see documents" on documents;
create policy "Project members see documents" on documents
  for select using (is_project_member(project_id) or is_admin() or is_lead_org_admin());

drop policy if exists "Upload documents" on documents;
create policy "Upload documents" on documents
  for insert with check (can_upload_document(project_id));

drop policy if exists "Update documents" on documents;
create policy "Update documents" on documents
  for update using (can_upload_document(project_id))
  with check (can_upload_document(project_id));

-- Suppression : l'auteur du dépôt, ou un profil de pilotage. Un
-- contributeur ne doit pas pouvoir effacer la facture d'un autre.
drop policy if exists "Delete documents" on documents;
create policy "Delete documents" on documents
  for delete using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from project_members pm
       where pm.project_id = documents.project_id and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'resp_financier')
    )
    or is_admin() or is_lead_org_admin()
  );

-- ------------------------------------------------------------
-- 4. Bucket Storage privé
-- ------------------------------------------------------------
-- PRIVÉ, contrairement à « avatars » : un devis, une facture ou une
-- photo de terrain ne doivent pas être atteignables par URL devinable.
-- L'accès passe par des URL signées à durée limitée.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Chemin : projets/<project_id>/<phase_id|_>/<uuid>-<nom>
-- soit foldername(name) = {projets, <project_id>, <phase_id|_>}.
-- Le cast en uuid est isolé dans une fonction : un objet au chemin
-- inattendu ferait autrement échouer TOUTE requête sur storage.objects,
-- Postgres ne garantissant pas l'ordre d'évaluation d'un AND.
create or replace function public.document_path_project_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return ((storage.foldername(object_name))[2])::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists "Documents read" on storage.objects;
create policy "Documents read" on storage.objects
  for select using (
    bucket_id = 'documents'
    and is_project_member(public.document_path_project_id(name))
  );

drop policy if exists "Documents upload" on storage.objects;
create policy "Documents upload" on storage.objects
  for insert with check (
    bucket_id = 'documents'
    and public.can_upload_document(public.document_path_project_id(name))
  );

drop policy if exists "Documents update" on storage.objects;
create policy "Documents update" on storage.objects
  for update using (
    bucket_id = 'documents'
    and public.can_upload_document(public.document_path_project_id(name))
  );

drop policy if exists "Documents delete" on storage.objects;
create policy "Documents delete" on storage.objects
  for delete using (
    bucket_id = 'documents'
    and public.can_upload_document(public.document_path_project_id(name))
  );

-- ============================================================================
-- MIGRATION 0030 — validations circuit
-- ============================================================================

-- ============================================================
-- PR 38b — Devis, factures et circuit de validation
-- ============================================================
-- La table `validations` existe depuis la 0001 mais n'a JAMAIS servi.
-- Et pour cause : elle porte une policy de lecture et une policy de
-- décision (update), mais AUCUNE policy d'insertion. Personne ne pouvait
-- donc créer une validation — le circuit était structurellement mort,
-- pas seulement inutilisé.
--
-- Cette migration ouvre l'insertion, réaligne la lecture sur
-- documents.project_id (posé en 0029), et ajoute le peu qui manquait au
-- suivi des montants : la date de paiement.

-- ------------------------------------------------------------
-- 1. Date de paiement
-- ------------------------------------------------------------
-- `documents.paid` (booléen) existe depuis la 0001, mais sans date : on
-- pouvait savoir QU'une facture était payée, jamais QUAND. Un financeur
-- public demande l'échéancier réel, pas un état à l'instant T.
alter table documents
  add column if not exists paid_at date;

-- ------------------------------------------------------------
-- 2. RLS de validations
-- ------------------------------------------------------------
-- Lecture : la 0006 remontait au projet par sous-requête à travers
-- tasks → phases ou budget_lines. Depuis la 0029, documents.project_id
-- est renseigné et NOT NULL : la jointure devient directe, et cesse
-- d'être aveugle aux documents rattachés au seul projet.
drop policy if exists "See validations" on validations;
create policy "See validations" on validations
  for select using (
    exists (
      select 1 from documents d
       where d.id = validations.document_id
         and (is_project_member(d.project_id) or is_admin() or is_lead_org_admin())
    )
  );

-- Insertion : c'est ce qui manquait. Créer une validation revient à
-- soumettre une pièce au circuit — même droit que déposer la pièce.
drop policy if exists "Create validation" on validations;
create policy "Create validation" on validations
  for insert with check (
    exists (
      select 1 from documents d
       where d.id = validations.document_id
         and can_upload_document(d.project_id)
    )
  );

-- Décision : membre de l'organisation sollicitée, ou pilotage du projet.
-- La 0001 n'admettait QUE le membre de l'organisation : un devis adressé
-- à une organisation sans compte actif restait bloqué pour toujours,
-- sans recours.
drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update using (
    exists (select 1 from memberships m where m.user_id = auth.uid() and m.org_id = validations.org_id)
    or exists (
      select 1 from documents d
        join project_members pm on pm.project_id = d.project_id
       where d.id = validations.document_id
         and pm.user_id = auth.uid() and pm.role in ('chef_projet', 'validateur')
    )
    or is_admin() or is_lead_org_admin()
  );

-- Suppression : retirer une pièce doit emporter ses validations. La
-- cascade de la FK s'en charge, mais un retrait manuel doit rester
-- possible pour le pilotage (soumission adressée à la mauvaise organisation).
drop policy if exists "Delete validation" on validations;
create policy "Delete validation" on validations
  for delete using (
    exists (
      select 1 from documents d
        join project_members pm on pm.project_id = d.project_id
       where d.id = validations.document_id
         and pm.user_id = auth.uid() and pm.role in ('chef_projet', 'resp_financier')
    )
    or is_admin() or is_lead_org_admin()
  );

create index if not exists validations_document_id_idx on validations(document_id);

-- ------------------------------------------------------------
-- 3. À qui adresser une validation
-- ------------------------------------------------------------
-- `validation_rules(project_id, doc_type, role)` existe depuis la 0001,
-- également inutilisée. Elle reste la source de vérité quand elle est
-- renseignée. Mais exiger une configuration préalable rendrait le
-- circuit invisible sur tout projet existant — d'où un repli explicite :
-- le financeur de la ligne, sinon l'organisation porteuse du projet.
create or replace function public.validation_orgs_for_document(doc_id uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  with doc as (
    select d.id, d.type, d.project_id, d.budget_line_id from documents d where d.id = doc_id
  ),
  par_regle as (
    select distinct po.org_id
      from doc
      join validation_rules vr on vr.project_id = doc.project_id and vr.doc_type = doc.type
      join project_organizations po on po.project_id = doc.project_id and po.role = vr.role
  ),
  repli as (
    select distinct org_id from (
      -- Financeur de la ligne budgétaire concernée
      select bl.funder_org_id as org_id
        from doc join budget_lines bl on bl.id = doc.budget_line_id
       where bl.funder_org_id is not null
      union all
      -- À défaut, l'organisation porteuse du projet
      select p.lead_org_id
        from doc join projects p on p.id = doc.project_id
       where p.lead_org_id is not null
    ) s where org_id is not null
  )
  select org_id from par_regle
  union
  select org_id from repli where not exists (select 1 from par_regle);
$$;

-- ============================================================================
-- MIGRATION 0031 — validation orgs fallback
-- ============================================================================

-- ============================================================
-- PR 38b (correctif) — Repli de validation : financeur PUIS porteuse
-- ============================================================
-- La 0030 annonçait « le financeur de la ligne, sinon l'organisation
-- porteuse », mais sollicitait les DEUX : le UNION ALL du repli
-- rassemblait funder_org_id et lead_org_id sans priorité entre eux.
-- Constaté en test — un devis sur une ligne financée par le Département
-- partait aussi en validation chez l'association porteuse, à qui l'on
-- demandait donc d'approuver un devis qu'elle avait elle-même obtenu.
--
-- Ordre rétabli : règles du projet si configurées, sinon financeur de la
-- ligne, sinon seulement l'organisation porteuse.

create or replace function public.validation_orgs_for_document(doc_id uuid)
returns setof uuid
language sql
security definer
set search_path = public
as $$
  with doc as (
    select d.id, d.type, d.project_id, d.budget_line_id from documents d where d.id = doc_id
  ),
  par_regle as (
    select distinct po.org_id
      from doc
      join validation_rules vr on vr.project_id = doc.project_id and vr.doc_type = doc.type
      join project_organizations po on po.project_id = doc.project_id and po.role = vr.role
  ),
  financeur as (
    select distinct bl.funder_org_id as org_id
      from doc join budget_lines bl on bl.id = doc.budget_line_id
     where bl.funder_org_id is not null
  ),
  porteuse as (
    select distinct p.lead_org_id as org_id
      from doc join projects p on p.id = doc.project_id
     where p.lead_org_id is not null
  )
  select org_id from par_regle
  union
  select org_id from financeur where not exists (select 1 from par_regle)
  union
  select org_id from porteuse
   where not exists (select 1 from par_regle)
     and not exists (select 1 from financeur);
$$;

-- ============================================================================
-- MIGRATION 0032 — photos moment
-- ============================================================================

-- ============================================================
-- PR 38c — Photos avant / pendant / après par phase
-- ============================================================
-- Matière première des rapports terrain et des supports de
-- communication : une photo de chantier ne vaut que rapprochée de son
-- état initial. Sans qualification du moment, une galerie de vingt
-- photos ne raconte rien.

create type doc_moment as enum ('avant', 'pendant', 'apres');

-- Nullable : seules les photos portent un moment. Un devis n'a pas
-- d'« avant ».
alter table documents
  add column if not exists moment doc_moment;

-- La galerie interroge les photos d'une phase non rattachées à une
-- tâche : c'est l'accès le plus fréquent de l'onglet Tâches.
create index if not exists documents_phase_photo_idx
  on documents(phase_id, type) where task_id is null;

-- ------------------------------------------------------------
-- Durcissement du bucket (dette signalée en 38a)
-- ------------------------------------------------------------
-- La limite de 10 Mo n'était vérifiée QUE dans le navigateur
-- (MAX_DOC_SIZE). Un appel direct à l'API Storage passait outre : pas
-- exploitable par un inconnu — les policies exigent d'être membre du
-- projet avec un rôle de dépôt — mais un membre légitime pouvait
-- saturer le stockage par accident. La limite est désormais appliquée
-- par le serveur, seul endroit où elle vaut quelque chose.
--
-- Les types autorisés couvrent large à dessein : bloquer un format
-- légitime en terrain associatif coûte plus cher que le risque écarté.
-- HEIC / HEIF sont indispensables — c'est le format par défaut des
-- iPhone, donc de la majorité des photos de chantier.
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array[
         'application/pdf',
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'image/heic', 'image/heif',
         'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-powerpoint',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation',
         'text/plain', 'text/csv'
       ]
 where id = 'documents';

-- ============================================================================
-- MIGRATION 0033 — phase budget computed
-- ============================================================================

-- ============================================================
-- PR 39 — Le budget de phase devient calculé
-- ============================================================
-- Cadrage YCID du 25/07/2026 : « on peut bouger un budget d'une
-- activité vers une autre ; le montant total ne devrait pas changer,
-- c'est un financement déjà voté ».
--
-- Cette règle tranche une question laissée ouverte depuis la 0001 :
-- l'invariant est l'ENVELOPPE, pas la ligne. D'où deux conséquences
-- opposées sur deux colonnes qui se ressemblaient :
--
--   · `projects.budget` CONSERVÉ, et change de sens : ce n'est pas un
--     doublon de la somme des lignes, c'est le MONTANT VOTÉ — la
--     référence contractuelle contre laquelle on compare la répartition.
--     Le seul chiffre qui ne doit pas bouger.
--
--   · `phases.budget` SUPPRIMÉ : lui n'était relié à rien. Saisi à la
--     main, jamais confronté aux lignes, il produisait des divergences
--     silencieuses — constatées en production sur le projet CEM Liban :
--     31 100 € déclarés contre 26 600 € de lignes sur une phase,
--     4 550 € contre 9 050 € sur une autre. Garder deux montants
--     modifiables pour la même chose ne fabrique que de l'écart.
--     Le budget d'une phase est désormais la somme de ses lignes.

-- Les valeurs saisies traduisaient une intention, même fausse : on les
-- archive au journal d'audit avant de supprimer la colonne, plutôt que
-- de les effacer sans trace.
insert into audit_log (project_id, entity, entity_id, label, action, user_id, comment)
select ph.project_id, 'phase', ph.id, ph.name, 'modifie', null,
       'Budget de phase archivé avant suppression du champ (PR 39) : ' || ph.budget || ' €'
  from phases ph
 where ph.budget is not null;

alter table phases drop column if exists budget;

-- ============================================================================
-- MIGRATION 0034 — storage stats
-- ============================================================================

-- ============================================================
-- PR 41 — Écran Stockage (Admin) : inventaire et nettoyage
-- ============================================================
-- Besoin apparu avec les PR 38a → 38e : les pièces s'accumulent — les
-- photos de chantier arrivent en HEIC depuis des iPhone, 3 à 5 Mo
-- l'unité — et personne ne voit le quota se remplir.
--
-- Deuxième besoin, créé par la 38a : `deleteDocument` retire la ligne
-- puis le fichier ; si le second échoue, l'échec est journalisé sans
-- bloquer (bon choix : l'utilisateur ne doit pas rester avec une ligne
-- qu'il croit supprimée). Mais rien ne remonte les fichiers orphelins
-- qui en résultent.
--
-- Pourquoi du SQL plutôt qu'un parcours de bucket : `storage.list()`
-- est paginé et ne descend que d'un niveau. Inventorier
-- projets/<projet>/<phase>/<fichier> imposerait des dizaines d'appels,
-- et le rapprochement avec la table `documents` — c'est-à-dire la
-- détection des orphelins — se ferait de toute façon mieux ici.

-- ------------------------------------------------------------
-- 1. Occupation par bucket
-- ------------------------------------------------------------
create or replace function public.storage_stats()
returns table (bucket text, files bigint, bytes bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ces fonctions lisent TOUT le stockage, tous projets confondus :
  -- réservées aux administrateurs, contrôle à l'intérieur puisqu'une
  -- fonction security definer contourne la RLS par construction.
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select o.bucket_id::text,
           count(*)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.objects o
     group by o.bucket_id
     order by 3 desc;
end;
$$;

-- ------------------------------------------------------------
-- 2. Fichiers orphelins du bucket « documents »
-- ------------------------------------------------------------
-- Présents dans le bucket, sans ligne correspondante en base : ils
-- consomment du quota et ne sont atteignables par aucun écran.
create or replace function public.storage_orphans()
returns table (path text, bytes bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select o.name::text,
           coalesce((o.metadata->>'size')::bigint, 0)::bigint,
           o.created_at
      from storage.objects o
     where o.bucket_id = 'documents'
       and not exists (select 1 from documents d where d.storage_path = o.name)
     order by o.created_at;
end;
$$;

-- ------------------------------------------------------------
-- 3. Occupation par projet
-- ------------------------------------------------------------
-- Le projet se lit dans le chemin projets/<project_id>/… : passer par
-- la table `documents` raterait précisément les orphelins, qu'on veut
-- justement voir peser.
create or replace function public.storage_by_project()
returns table (project_id uuid, project_name text, files bigint, bytes bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select p.id, p.name::text, count(*)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.objects o
      join projects p
        on p.id = public.document_path_project_id(o.name)
     where o.bucket_id = 'documents'
     group by p.id, p.name
     order by 4 desc;
end;
$$;

-- ============================================================================
-- MIGRATION 0035 — storage stats all buckets
-- ============================================================================

-- ============================================================
-- Correctif PR 41 — lister TOUS les espaces de stockage
-- ============================================================
-- Constaté en recette : l'écran Stockage n'affichait qu'un seul espace
-- (« Pièces des projets ») au lieu des trois. Cause : la fonction
-- agrégeait `storage.objects` en groupant par bucket_id. Un bucket sans
-- aucun objet ne produit aucune ligne, donc disparaît — et rien ne
-- distingue « bucket vide » de « bucket inexistant ».
--
-- Pour un écran dont la fonction est l'inventaire, c'est un défaut de
-- fond : on ne peut pas constater qu'un espace est vide s'il n'est pas
-- affiché. On part donc de `storage.buckets`, avec une jointure externe.

create or replace function public.storage_stats()
returns table (bucket text, files bigint, bytes bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (is_admin() or is_lead_org_admin()) then
    raise exception 'Réservé aux administrateurs.';
  end if;
  return query
    select b.id::text,
           count(o.id)::bigint,
           coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
      from storage.buckets b
      left join storage.objects o on o.bucket_id = b.id
     group by b.id
     order by 3 desc, 1;
end;
$$;

-- ============================================================================
-- MIGRATION 0036 — validation decision scope
-- ============================================================================

-- ============================================================
-- Correctif 38b — qui peut décider d'une validation
-- ============================================================
-- Constaté en recette : un compte de rôle YCID a pu valider un devis
-- adressé à « Libanais en Yvelines ». La décision s'enregistre alors
-- sous l'organisation LEY, sans que rien n'indique qu'une autre
-- organisation a tranché à sa place.
--
-- Cause : la policy posée en 0030 admettait `is_admin()`, vrai pour
-- tout membre `admin_org` d'une organisation nommée YCID ou LEY. Le
-- garde-fou visait à débloquer un devis adressé à une organisation sans
-- compte actif — intention légitime, portée beaucoup trop large : il
-- autorisait n'importe quel administrateur à se prononcer au nom de
-- n'importe qui.
--
-- C'est d'autant plus grave avec la règle d'unanimité arbitrée le
-- 25/07 : si un administrateur peut décider pour toutes les
-- organisations, l'unanimité ne veut plus rien dire.
--
-- Règle retenue : décide qui est MEMBRE de l'organisation sollicitée.
-- Le recours subsiste, mais réservé aux administrateurs PLATEFORME
-- (`is_platform_admin`) — un rôle d'exploitation, pas un rôle
-- partenaire. Et il devient visible : voir `decided_by` ci-dessous.

drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update using (
    -- Cas normal : membre de l'organisation sollicitée.
    exists (
      select 1 from memberships m
       where m.user_id = auth.uid() and m.org_id = validations.org_id
    )
    -- Recours d'exploitation : rôle « admin » UNIQUEMENT.
    --
    -- Ni is_admin(), qui englobe le rôle « ycid ». Ni is_platform_admin,
    -- piège moins visible : l'écran de gestion des comptes pose
    -- `is_platform_admin = (role <> 'user')` (user-actions.ts), si bien
    -- que TOUT compte de rôle « ycid » a ce drapeau à true. S'y fier
    -- rouvrirait exactement le trou qu'on ferme — c'est un compte de
    -- rôle ycid qui a validé au nom de LEY.
    --
    -- Le coalesce reprend la dérivation de l'application pour les
    -- comptes antérieurs à la 0017, dont platform_role est nul.
    or exists (
      select 1 from profiles p
       where p.id = auth.uid()
         and coalesce(p.platform_role, case when p.is_platform_admin then 'admin' else 'user' end) = 'admin'
    )
  );

-- Le chef de projet perd ce droit, qu'il n'aurait jamais dû avoir : il
-- est le plus souvent le déposant du devis. Se valider soi-même vide le
-- circuit de son sens.

-- ------------------------------------------------------------
-- Rendre la décision hors organisation VISIBLE
-- ------------------------------------------------------------
-- `decided_by` était déjà renseigné, mais rien ne permettait de savoir
-- si le décideur appartenait à l'organisation sollicitée. Pour une
-- piste d'audit destinée à un financeur, « validé par LEY » et « validé
-- par un administrateur au nom de LEY » ne sont pas la même affirmation.
create or replace function public.validation_decided_outside_org(validation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select v.decided_by is not null
     and not exists (
       select 1 from memberships m
        where m.user_id = v.decided_by and m.org_id = v.org_id
     )
    from validations v
   where v.id = validation_id;
$$;

-- ============================================================================
-- MIGRATION 0037 — two platform roles
-- ============================================================================

-- ============================================================
-- PR 42 — Deux rôles plateforme : Administrateur et Utilisateur
-- ============================================================
-- Arbitrage YCID du 26/07 : « YCID est une organisation, pas un rôle ».
--
-- Le modèle d'origine confondait trois axes indépendants :
--   · l'APPARTENANCE — à quelle organisation on appartient (YCID, LEY,
--     Mairie d'Azour) ;
--   · le PÉRIMÈTRE — quels projets on voit ;
--   · la CAPACITÉ — ce qu'on peut y faire.
--
-- Le rôle « ycid » les écrasait tous les trois en un seul réglage
-- global, et donnait l'administration complète à qui n'avait besoin que
-- de voir le programme. C'est ce qui a ouvert la console de gestion des
-- comptes à Maria Maroun, dont ce n'est pas la fonction.
--
-- Le modèle devient explicite :
--   · le PÉRIMÈTRE vient de l'appartenance à une organisation —
--     is_project_member() joignait DÉJÀ project_organizations, donc un
--     membre d'YCID voit tous les projets auxquels YCID est rattachée.
--     Le rôle global ne faisait que court-circuiter ce mécanisme ;
--   · la CAPACITÉ vient du rôle PROJET (chef de projet, responsable
--     financier, terrain, validateur…) ;
--   · le rôle PLATEFORME ne garde qu'une question : administre-t-on
--     l'outil lui-même ? Deux valeurs suffisent.
--
-- ⚠️ Conséquence assumée : is_admin() est utilisé par une soixantaine de
-- policies. Les comptes « ycid » y perdent l'accès global — c'est
-- précisément l'objet du changement. Ils conservent leurs droits par
-- leurs rôles projet et leur organisation.

-- ------------------------------------------------------------
-- 1. Administrer l'outil : le seul rôle « admin »
-- ------------------------------------------------------------
create or replace function is_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end) = 'admin'
  );
$$;

-- ------------------------------------------------------------
-- 2. Voir un projet : appartenance, pas rôle global
-- ------------------------------------------------------------
-- L'administrateur conserve la vision complète : il doit pouvoir
-- diagnostiquer un projet sans s'y ajouter comme membre. Mais c'est
-- désormais le SEUL raccourci global.
create or replace function is_project_member(pid uuid)
returns boolean language sql security definer as $$
  select
    is_admin()
    or exists (
      select 1 from project_members
      where project_id = pid and user_id = auth.uid()
    )
    -- Le vrai mécanisme de périmètre : appartenir à une organisation
    -- rattachée au projet. Un membre d'YCID voit les projets où YCID
    -- figure ; il suffit de l'y rattacher pour élargir sa vue.
    or exists (
      select 1 from project_organizations po
      join memberships m on m.org_id = po.org_id
      where po.project_id = pid and m.user_id = auth.uid()
    );
$$;

-- ------------------------------------------------------------
-- 3. Arbitrer la roadmap : une capacité, pas un rôle
-- ------------------------------------------------------------
-- La gouvernance produit n'est ni un droit projet ni de l'administration
-- technique. Le Product Owner arbitre le backlog sans toucher aux
-- comptes. Une case à cocher exprime cela sans inventer un rôle.
alter table profiles
  add column if not exists can_manage_roadmap boolean not null default false;

create or replace function is_roadmap_manager()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid()
       and (can_manage_roadmap = true
            or coalesce(platform_role, case when is_platform_admin then 'admin' else 'user' end) = 'admin')
  );
$$;

drop policy if exists "Update own idea" on ideas;
create policy "Update own idea" on ideas for update
  using (author_id = auth.uid() or is_roadmap_manager());

drop policy if exists "Delete own idea" on ideas;
create policy "Delete own idea" on ideas for delete
  using (author_id = auth.uid() or is_roadmap_manager());

-- ------------------------------------------------------------
-- 4. Reprise des comptes existants
-- ------------------------------------------------------------
-- Les comptes « ycid » deviennent « utilisateur » — ils perdent la
-- console d'administration, ce qui est le but — mais CONSERVENT
-- l'arbitrage de la roadmap. Retirer d'un coup deux droits dont un seul
-- était en cause priverait Bérengère Ayoub de sa fonction sans
-- décision. La case reste décochable compte par compte.
update profiles
   set can_manage_roadmap = true
 where platform_role = 'ycid';

update profiles
   set platform_role = 'user'
 where platform_role = 'ycid';

-- `is_platform_admin` retrouve enfin le sens de son nom : vrai pour le
-- seul administrateur. L'écran de gestion des comptes le posait à
-- « rôle <> user », ce qui en faisait un synonyme trompeur de « pas un
-- utilisateur ordinaire » — et c'est ce qui avait rendu mon correctif
-- 0036 inopérant.
update profiles
   set is_platform_admin = (platform_role = 'admin')
 where platform_role is not null
   and is_platform_admin is distinct from (platform_role = 'admin');

-- ============================================================================
-- MIGRATION 0038 — reader role merge
-- ============================================================================

-- ============================================================
-- 0038 — L'auditeur, seul rôle de consultation
-- ============================================================
-- Arbitrage du 26/07 : « je n'ai besoin ni du rôle lecteur ni du
-- validateur — à quoi ça sert de se connecter pour voir, on peut lui
-- transmettre un rapport. Un auditeur c'est autre chose. »
--
-- Deux rôles sortent :
--
--   · « validateur » ne validait plus rien depuis la 0036, qui a
--     restreint la décision aux MEMBRES de l'organisation sollicitée —
--     un mécanisme d'appartenance, pas un rôle projet — et retiré au
--     passage la clause `pm.role in ('chef_projet','validateur')` posée
--     en 0030. Le libellé promettait depuis un jour un pouvoir que le
--     code avait supprimé ;
--
--   · « lecteur » n'avait pas de raison d'être. Un compte qui ne sert
--     qu'à regarder duplique deux choses qui existent déjà mieux : le
--     rapport d'expert IA, et la page vitrine publique par projet
--     (0021, lien non devinable). Créer un compte, gérer son mot de
--     passe et son cycle de vie pour un spectateur, c'est du coût sans
--     contrepartie — et une surface d'accès de plus.
--
-- « auditeur » subsiste, et devient le SEUL rôle de consultation. Sa
-- mission n'est pas de regarder mais de contrôler, et elle exige le
-- journal d'audit — qui, lui, ne se transmet pas dans un rapport.
--
-- Un enum PostgreSQL ne perd jamais ses valeurs (`alter type ... drop
-- value` n'existe pas). « validateur » et « lecteur » restent donc dans
-- `project_member_role` ; ce qui change, c'est qu'ils ne sont plus
-- proposés à la saisie (ASSIGNABLE_ROLES, lib/rbac.ts) et que plus
-- personne ne les porte.
--
-- ⚠️ Cette migration remplace une première version, diffusée le même
-- jour, qui convertissait vers « lecteur ». Elle est SANS RISQUE à
-- relancer : si la première a déjà tourné, celle-ci reprend les
-- « lecteur » ainsi créés et les mène à « auditeur ». Le résultat est
-- identique dans les deux cas.

-- ------------------------------------------------------------
-- 1. Reprise des membres existants
-- ------------------------------------------------------------
-- Aucun droit n'est retiré à personne : ces trois rôles avaient déjà
-- rigoureusement les mêmes. La conversion aligne l'affichage sur la
-- réalité.
insert into audit_log (project_id, entity, entity_id, label, action, comment)
select pm.project_id, 'project_member', pm.user_id,
       coalesce(p.full_name, p.email, pm.user_id::text),
       'modifie',
       format('Rôle « %s » converti en « auditeur » (0038 — rôle de consultation unique)', pm.role)
  from project_members pm
  left join profiles p on p.id = pm.user_id
 where pm.role in ('validateur', 'lecteur');

update project_members
   set role = 'auditeur'
 where role in ('validateur', 'lecteur');

-- ------------------------------------------------------------
-- 2. Un auditeur ne saisit pas les chiffres qu'il contrôle
-- ------------------------------------------------------------
-- La policy de la 0006 admettait tout membre du projet. Tant que la
-- consultation n'était qu'un statut passif, la nuance était théorique ;
-- avec un rôle dont la mission est le contrôle, elle ne l'est plus.
-- Quelqu'un qui vérifie des indicateurs d'impact ne doit pas pouvoir en
-- saisir.
drop policy if exists "Add measure" on indicator_measures;
create policy "Add measure" on indicator_measures
  for insert with check (
    exists (
      select 1 from indicators i
       join project_members pm on pm.project_id = i.project_id
       where i.id = indicator_measures.indicator_id
         and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier', 'contributeur')
    )
    or is_admin()
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- Doit renvoyer zéro ligne. Sinon, c'est qu'un membre a été créé avec un
-- rôle retiré de la saisie — donc que le garde-fou applicatif
-- (MEMBER_ROLES, actions.ts) a été contourné.
--
--   select role, count(*) from project_members
--    where role in ('validateur','lecteur') group by role;

-- ============================================================================
-- MIGRATION 0039 — read only org scope
-- ============================================================================

-- ============================================================
-- 0039 — Le droit de regard ne doit rien pouvoir écrire
-- ============================================================
-- Arbitrage du 26/07, énoncé par YCID :
--
--   « On ouvre un compte aux gens qui agissent. Mais quand on crée un
--     compte pour une organisation — Commune de Villepreux par exemple —
--     les gens ont accès aux informations des projets de la commune :
--     ils ont un droit de REGARD. Ce ne sont pas les gens opérationnels.
--     Un membre de la commune qui est chef de projet, lui, pourra agir :
--     créer une tâche, un devis, etc. »
--
-- Le modèle repose donc sur deux couches indépendantes :
--
--   · l'ORGANISATION donne le PÉRIMÈTRE — quels projets on voit.
--     is_project_member() joint project_organizations depuis la 0037 ;
--   · le RÔLE PROJET donne la CAPACITÉ — ce qu'on peut y faire.
--     lib/rbac.ts, et les policies nommant explicitement les rôles.
--
-- Le modèle ne tient que si AUCUNE règle d'écriture ne se contente de
-- l'appartenance. Vérification faite sur les policies encore en vigueur
-- (les réécritures successives en avaient neutralisé plusieurs) : deux
-- seulement s'appuyaient sur is_project_member() en écriture.
--
--   · audit_log « Insert audit » — LÉGITIME, et nécessaire. La trace est
--     écrite par celui qui agit, sous son propre identifiant
--     (`user_id = auth.uid()`). L'interdire empêcherait de tracer.
--     Inchangée.
--
--   · ai_reports « Create ai reports » — FUITE, corrigée ci-dessous.

-- ------------------------------------------------------------
-- Générer un rapport est une action, pas un regard
-- ------------------------------------------------------------
-- La 0024 ouvrait l'insertion à tout membre du projet. À l'époque, être
-- membre supposait un rôle : la nuance n'existait pas. Depuis la 0037,
-- l'appartenance à une organisation suffit à voir un projet — et donc,
-- par cette policy, à y générer un rapport.
--
-- Deux raisons de fermer, dont une qui ne se rattrape pas :
--   · la génération consomme la clé du fournisseur d'IA (0023) — un
--     droit de regard qui engage une dépense n'est plus un droit de
--     regard ;
--   · le rapport s'inscrit dans l'historique du projet, sous le nom de
--     qui l'a lancé.
--
-- La LECTURE reste ouverte à tout le périmètre : quelqu'un qui a le
-- droit de regard peut lire les rapports produits par d'autres. C'est
-- même le cœur de ce droit.
drop policy if exists "Create ai reports" on ai_reports;
create policy "Create ai reports" on ai_reports
  for insert with check (
    exists (
      select 1 from project_members pm
       where pm.project_id = ai_reports.project_id
         and pm.user_id = auth.uid()
         and pm.role in ('chef_projet', 'referent_mairie', 'resp_financier', 'contributeur')
    )
    or is_admin()
    or is_lead_org_admin()
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- Recense les policies d'écriture qui s'appuient encore sur la seule
-- appartenance. Attendu APRÈS cette migration : la seule ligne
-- `audit_log / Insert audit`.
--
--   select tablename, policyname, cmd
--     from pg_policies
--    where schemaname = 'public'
--      and cmd <> 'SELECT'
--      and coalesce(qual, '') || coalesce(with_check, '') like '%is_project_member%'
--    order by tablename, policyname;

-- ============================================================================
-- MIGRATION 0040 — email settings
-- ============================================================================

-- ============================================================
-- 0040 — Envoi d'emails, entièrement configurable
-- ============================================================
-- Arbitrage du 25/07 : « il faut envoyer des mails à chaque fois qu'il y
-- a une notification, surtout de validation ou d'action terminée. Il
-- faut que ce soit complètement configurable, SMTP etc. Je ne veux pas
-- que ça soit en dur. »
--
-- Même raisonnement que la configuration IA (0023) : un secret ne se
-- met pas dans un fichier sur le serveur, où le changer suppose un accès
-- SSH et un redémarrage. Il se saisit depuis l'administration.
--
-- SÉCURITÉ : le mot de passe SMTP est un secret. Cette table est donc
-- séparée de `platform_settings` — lisible publiquement pour la marque —
-- et n'est accessible qu'aux administrateurs. Côté serveur la lecture
-- passe par la clé service ; le mot de passe n'est JAMAIS renvoyé au
-- navigateur, seul un booléen « configuré » l'est.
--
-- POURQUOI CETTE MIGRATION MAINTENANT : l'unanimité arbitrée le 25/07
-- rend une organisation silencieuse BLOQUANTE pour l'engagé. Sans
-- notification, personne ne sait qu'on l'attend, et le circuit
-- s'arrêterait au premier devis. Les deux se livrent ensemble.

create table if not exists email_settings (
  id boolean primary key default true check (id),
  -- Interrupteur général. À false, l'application n'envoie rien et se
  -- contente des notifications internes : c'est l'état par défaut, pour
  -- qu'une installation neuve ne tente pas d'écrire à des inconnus.
  enabled boolean not null default false,
  host text,
  port integer not null default 587,
  -- true = TLS implicite (port 465). false = STARTTLS (port 587), le
  -- cas courant.
  secure boolean not null default false,
  username text,
  password text,
  from_name text not null default 'Solid''Pilot',
  from_email text,
  -- Adresse publique de l'application, pour les liens des messages. Un
  -- email qui annonce qu'une décision attend sans donner le chemin pour
  -- s'y rendre ne sert à rien. Ici plutôt qu'en variable
  -- d'environnement : la changer ne doit pas supposer un accès SSH et un
  -- redémarrage.
  site_url text,
  -- Trace du dernier essai : sans elle, un envoi qui échoue en
  -- silence — mot de passe changé, quota atteint — ne se découvre que
  -- le jour où quelqu'un s'étonne de n'avoir rien reçu.
  last_test_at timestamptz,
  last_test_ok boolean,
  last_test_error text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

insert into email_settings (id) values (true) on conflict (id) do nothing;

alter table email_settings enable row level security;

drop policy if exists "Admins read email settings" on email_settings;
create policy "Admins read email settings" on email_settings
  for select using (is_admin());

drop policy if exists "Admins update email settings" on email_settings;
create policy "Admins update email settings" on email_settings
  for update using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------
-- Ne pas écrire deux fois la même chose à la même personne
-- ------------------------------------------------------------
-- Un devis soumis à trois organisations engendre trois notifications ;
-- une personne membre de deux d'entre elles en recevrait deux. La
-- colonne porte l'adresse réellement servie, ce qui permet de constater
-- après coup ce qui est parti — et de ne pas réémettre.
alter table notifications
  add column if not exists emailed_at timestamptz;

create index if not exists notifications_unread_idx
  on notifications (user_id, read_at) where read_at is null;

-- ============================================================================
-- MIGRATION 0041 — validation chain
-- ============================================================================

-- ============================================================
-- 0041 — Le circuit réel : porteur, PUIS coordinateur
-- ============================================================
-- Arbitrage YCID du 27/07, qui invalide le routage précédent :
--
--   « Le schéma est très simple. Maria, chef de projet, propose ; LEY, le
--     porteur, valide ; puis YCID valide. Nous n'allons pas solliciter le
--     ministère des Affaires étrangères pour chaque ligne : nous avons
--     déjà eu le budget, nous le gérons et nous rendons compte. »
--
-- Deux erreurs de conception sont corrigées d'un coup.
--
-- 1. LE MAUVAIS DESTINATAIRE. La 0031 adressait le devis au FINANCEUR de
--    la ligne. Sur ce programme, les financeurs sont le MEAE et le
--    Département — qui ont voté une enveloppe et attendent un
--    compte rendu, pas une approbation ligne à ligne. Le circuit
--    sollicitait donc des organisations qui n'ont ni compte, ni vocation
--    à répondre : chaque devis restait bloqué, et l'unanimité livrée
--    hier aurait gelé l'engagé de tout le programme.
--
--    Le financeur ne joue plus aucun rôle dans le routage. Le budget est
--    voté en amont ; la redevabilité s'exerce en aval, par le rapport.
--
-- 2. L'ABSENCE D'ORDRE. `validations` était un ensemble plat : toutes les
--    organisations sollicitées en même temps. Or « le porteur valide,
--    PUIS YCID valide » est une hiérarchie — l'association engage sa
--    dépense, le coordinateur du programme l'entérine. Laisser YCID se
--    prononcer avant le porteur viderait le premier échelon de son sens.
--
-- La chaîne devient donc : étape 1, l'organisation PORTEUSE du projet ;
-- étape 2, l'organisation COORDINATRICE du programme. Quand les deux
-- coïncident — la Coordination est portée par YCID — la chaîne se réduit
-- à une seule étape plutôt que de demander deux fois la même signature.

-- ------------------------------------------------------------
-- 1. Qui coordonne
-- ------------------------------------------------------------
-- En configuration, pas en dur : l'application est en marque blanche
-- (0018), et « YCID » n'est le coordinateur que de CE déploiement.
alter table platform_settings
  add column if not exists coordinator_org_id uuid references organizations(id) on delete set null;

update platform_settings
   set coordinator_org_id = (select id from organizations where name = 'YCID' limit 1)
 where coordinator_org_id is null;

-- ------------------------------------------------------------
-- 2. L'ordre
-- ------------------------------------------------------------
alter table validations
  add column if not exists step smallint not null default 1;

-- Les validations déjà en base sont toutes de premier échelon : elles ont
-- été créées sans notion d'ordre, et rien ne permet de deviner après coup
-- laquelle aurait été seconde.
create index if not exists validations_doc_step_idx on validations (document_id, step);

-- ------------------------------------------------------------
-- 3. La chaîne
-- ------------------------------------------------------------
-- Remplace validation_orgs_for_document(), qui partait du financeur.
--
-- `validation_rules` n'est plus consultée. Cette table, prévue dans la
-- 0001 pour paramétrer le circuit par rôle d'organisation, n'a jamais
-- reçu une seule ligne en un an — et surtout, elle ne sait pas exprimer
-- un ORDRE. La consulter ici casserait la garantie qu'apporte l'étape.
-- Elle reste en base, dormante ; c'est une candidate au retrait.
drop function if exists public.validation_orgs_for_document(uuid);

create or replace function public.validation_chain_for_document(doc_id uuid)
returns table (org_id uuid, step smallint)
language sql
security definer
set search_path = public
as $$
  with doc as (
    select d.id, d.project_id from documents d where d.id = doc_id
  ),
  porteur as (
    select p.lead_org_id as org_id
      from doc join projects p on p.id = doc.project_id
     where p.lead_org_id is not null
  ),
  coordinateur as (
    select s.coordinator_org_id as org_id
      from platform_settings s
     where s.id = true and s.coordinator_org_id is not null
  )
  select org_id, 1::smallint from porteur
  union all
  -- Le coordinateur n'est sollicité qu'en second, et seulement s'il n'est
  -- pas déjà le porteur : sur la Coordination, YCID porte le projet et
  -- signerait sinon deux fois.
  select c.org_id, 2::smallint
    from coordinateur c
   where not exists (select 1 from porteur p where p.org_id = c.org_id)
  union all
  -- Repli : si le projet n'a pas d'organisation porteuse, le
  -- coordinateur devient le premier et unique échelon. Sans cela un
  -- devis ne partirait nulle part, et la panne serait muette.
  select c.org_id, 1::smallint
    from coordinateur c
   where not exists (select 1 from porteur);
$$;

-- ------------------------------------------------------------
-- 4. On ne saute pas son tour
-- ------------------------------------------------------------
-- L'ordre serait décoratif s'il n'était pas opposable : un lien direct,
-- un rafraîchissement mal placé, et le second échelon se prononcerait
-- avant le premier. La règle est donc posée au niveau de la base, comme
-- toutes celles qui protègent l'argent public.
drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update using (
    -- Aucun échelon antérieur ne doit rester en attente ou refusé.
    not exists (
      select 1 from validations prev
       where prev.document_id = validations.document_id
         and prev.step < validations.step
         and prev.decision is distinct from 'valide'
    )
    and (
      -- Cas normal : membre de l'organisation sollicitée.
      exists (
        select 1 from memberships m
         where m.user_id = auth.uid() and m.org_id = validations.org_id
      )
      -- Recours d'exploitation, réservé au rôle « admin » (0036).
      or exists (
        select 1 from profiles p
         where p.id = auth.uid()
           and coalesce(p.platform_role, case when p.is_platform_admin then 'admin' else 'user' end) = 'admin'
      )
    )
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select pr.name as projet,
--          porteur.name as etape_1,
--          coord.name   as etape_2
--     from projects pr
--     left join organizations porteur on porteur.id = pr.lead_org_id
--     left join platform_settings s on s.id = true
--     left join organizations coord on coord.id = s.coordinator_org_id
--    order by pr.name;
--
-- Attendu : Triade Villepreux → LEY puis YCID ; Triade Jouy → Comité de
-- Jumelage puis YCID ; Coordination → YCID seul (porteur et coordinateur
-- confondus).

-- ============================================================================
-- MIGRATION 0042 — validation settings
-- ============================================================================

-- ============================================================
-- 0042 — Le circuit devient réglable depuis l'application
-- ============================================================
-- La 0041 a posé la chaîne réelle — porteur, puis coordinateur — mais
-- ses deux réglages n'avaient aucun écran : `coordinator_org_id` ne se
-- changeait qu'en SQL, et `projects.lead_org_id` se figeait à la
-- création. Annoncer un circuit « paramétrable » dans ces conditions
-- serait une affirmation de documentation, pas une réalité d'usage : le
-- jour où la mairie donne son vrai contact et où le porteur change, on
-- ne peut rien corriger.
--
-- Cette migration ajoute le seul réglage qui manquait vraiment, et les
-- écrans arrivent avec elle.

-- ------------------------------------------------------------
-- Seuil de sollicitation du coordinateur
-- ------------------------------------------------------------
-- Faire signer deux organisations pour 80 € de fournitures use le
-- circuit — et un circuit qu'on trouve pénible finit contourné. En
-- dessous du seuil, l'organisation porteuse valide seule.
--
-- Le porteur, LUI, n'est jamais sauté : une dépense engage toujours
-- quelqu'un. Un seuil qui supprimerait toute validation ferait du
-- circuit une option, ce qu'il ne doit pas être sur de l'argent public.
--
-- Zéro = aucun seuil, donc comportement de la 0041 inchangé. C'est le
-- défaut : un réglage neuf ne doit pas modifier un circuit en service
-- sans décision explicite.
alter table platform_settings
  add column if not exists coordinator_min_amount numeric not null default 0;

-- ------------------------------------------------------------
-- La chaîne tient compte du seuil
-- ------------------------------------------------------------
-- Le montant lu est celui du DOCUMENT, pas de la ligne budgétaire : ce
-- qu'on soumet à validation est un devis précis, pas l'enveloppe qui le
-- contient. Un devis sans montant ne bénéficie d'aucune dispense — il
-- n'y a rien à comparer, et le passe-droit irait au dossier le moins
-- renseigné.
create or replace function public.validation_chain_for_document(doc_id uuid)
returns table (org_id uuid, step smallint)
language sql
security definer
set search_path = public
as $$
  with doc as (
    select d.id, d.project_id, d.amount from documents d where d.id = doc_id
  ),
  reglages as (
    select s.coordinator_org_id, s.coordinator_min_amount
      from platform_settings s where s.id = true
  ),
  porteur as (
    select p.lead_org_id as org_id
      from doc join projects p on p.id = doc.project_id
     where p.lead_org_id is not null
  ),
  coordinateur as (
    select r.coordinator_org_id as org_id
      from reglages r, doc
     where r.coordinator_org_id is not null
       -- Sous le seuil, le coordinateur n'est pas sollicité.
       and (r.coordinator_min_amount <= 0
            or doc.amount is null
            or doc.amount >= r.coordinator_min_amount)
  ),
  -- Sans coordinateur — non configuré, ou écarté par le seuil — le
  -- porteur reste le seul échelon.
  coordinateur_toujours as (
    select r.coordinator_org_id as org_id
      from reglages r where r.coordinator_org_id is not null
  )
  select org_id, 1::smallint from porteur
  union all
  select c.org_id, 2::smallint
    from coordinateur c
   where not exists (select 1 from porteur p where p.org_id = c.org_id)
  union all
  -- Repli : projet sans organisation porteuse. Le coordinateur devient
  -- le premier et unique échelon, seuil ou non — sinon le devis ne
  -- partirait nulle part, et la panne serait muette.
  select c.org_id, 1::smallint
    from coordinateur_toujours c
   where not exists (select 1 from porteur);
$$;

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select brand_name, coordinator_org_id, coordinator_min_amount
--     from platform_settings where id = true;
--
-- Attendu après cette migration : coordinator_min_amount = 0, donc
-- aucune dispense tant qu'un administrateur n'en décide pas.

-- ============================================================================
-- MIGRATION 0043 — ai usage
-- ============================================================================

-- ============================================================
-- 0043 — Mesurer ce que l'IA consomme, et ce qu'elle coûte
-- ============================================================
-- Constat du 27/07 : l'application appelle un fournisseur d'IA payant à
-- l'usage, et ne sait pas ce qu'elle consomme.
--
--   · `lib/llm.ts` récupère bien les jetons renvoyés par le fournisseur,
--     mais SEUL le rapport d'expert en garde une trace
--     (`ai_reports.tokens`) ;
--   · la génération des contenus de communication appelle l'IA et
--     n'enregistre rien ;
--   · seul le TOTAL est conservé — or la sortie coûte trois à huit fois
--     l'entrée selon les fournisseurs. Un total ne permet donc pas de
--     calculer un coût ;
--   · aucun écran n'affiche quoi que ce soit.
--
-- Autrement dit : une dépense engagée automatiquement, sans compteur.
-- C'est exactement le genre de chose qu'on découvre sur une facture.

create table if not exists ai_usage (
  id uuid primary key default uuid_generate_v4(),
  at timestamptz not null default now(),
  -- Qui, et pour quoi. `project_id` est nullable : le test de connexion
  -- depuis l'administration ne relève d'aucun projet.
  user_id uuid references profiles(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  -- 'rapport' | 'campagne' | 'test' | autre. Texte libre plutôt qu'enum :
  -- une fonctionnalité nouvelle ne doit pas exiger une migration pour
  -- être comptée — sans quoi elle ne le serait pas, comme aujourd'hui.
  feature text not null,
  model text,
  -- Séparés, parce que leurs tarifs le sont.
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  -- Un appel en échec consomme quand même des jetons d'entrée : le
  -- compter permet de voir ce que coûtent les tentatives ratées.
  ok boolean not null default true,
  truncated boolean not null default false
);

create index if not exists ai_usage_at_idx on ai_usage (at desc);
create index if not exists ai_usage_feature_idx on ai_usage (feature, at desc);

alter table ai_usage enable row level security;

-- Lecture réservée aux administrateurs : la consommation d'IA est une
-- donnée d'exploitation, au même titre que le stockage.
drop policy if exists "Admins read ai usage" on ai_usage;
create policy "Admins read ai usage" on ai_usage for select using (is_admin());

-- Aucune policy d'insertion : l'écriture passe par la clé service, comme
-- les notifications. Un utilisateur ne doit pas pouvoir fabriquer ni
-- effacer une ligne de consommation — ce serait un compteur qu'on peut
-- truquer, donc pas un compteur.

-- ------------------------------------------------------------
-- Tarifs et budget
-- ------------------------------------------------------------
-- Les prix ne sont pas devinables : ils dépendent du fournisseur, du
-- modèle, et changent. On ne les met donc pas en dur — ils se saisissent,
-- et le coût affiché est une ESTIMATION assumée comme telle.
--
-- Le budget mensuel, lui, ne bloque rien pour l'instant : il sert de
-- repère et d'alerte. Interrompre une génération de rapport la veille
-- d'un COPIL parce qu'un plafond est atteint serait pire que la dépense
-- évitée — cette décision revient à YCID, pas au code.
alter table ai_settings
  add column if not exists price_input_per_million numeric not null default 0,
  add column if not exists price_output_per_million numeric not null default 0,
  add column if not exists monthly_budget numeric not null default 0,
  add column if not exists currency text not null default 'EUR';

-- ------------------------------------------------------------
-- Reprise de l'historique connu
-- ------------------------------------------------------------
-- Les rapports déjà générés portent un total de jetons. On ne connaît
-- pas leur répartition entrée/sortie — elle n'a jamais été enregistrée —
-- donc tout est porté en entrée, et signalé comme tel : l'estimation de
-- coût sur cette période sera BASSE. Mieux vaut un historique incomplet
-- et daté qu'un historique inventé.
insert into ai_usage (at, user_id, project_id, feature, model, prompt_tokens, completion_tokens, total_tokens, ok)
select r.created_at, r.created_by, r.project_id, 'rapport (historique)', r.model,
       coalesce(r.tokens, 0), 0, coalesce(r.tokens, 0), true
  from ai_reports r
 where r.tokens is not null
   and not exists (select 1 from ai_usage u where u.feature = 'rapport (historique)' and u.at = r.created_at);

-- ============================================================================
-- MIGRATION 0044 — email reply to
-- ============================================================================

-- ============================================================
-- 0044 — Adresse de réponse des notifications
-- ============================================================
-- La 0040 gérait l'expéditeur, pas la réponse. Or les deux diffèrent
-- souvent : on expédie depuis une boîte de service — « YCID Notifications
-- <cem.notif@…> » — et l'on veut que les réponses arrivent quelque part
-- de lu.
--
-- Sans `reply_to`, une réponse part vers l'adresse d'expédition. Si
-- celle-ci n'est relevée par personne, la réponse est perdue en silence —
-- et l'expéditeur croit avoir répondu. C'est le genre de perte qu'on ne
-- constate jamais, puisque personne ne sait qu'un message a existé.
alter table email_settings
  add column if not exists reply_to text;

-- Par défaut, l'adresse d'expédition : mieux vaut un repli explicite
-- qu'un champ vide dont le comportement dépend du client de messagerie.
update email_settings
   set reply_to = from_email
 where reply_to is null and from_email is not null;

-- ============================================================================
-- MIGRATION 0045 — fix validation policy recursion
-- ============================================================================

-- ============================================================
-- 0045 — La policy d'ordre se mordait la queue
-- ============================================================
-- Constat de recette, 27/07, premier essai réel du circuit à deux
-- échelons : cliquer sur « Valider » renvoyait
--
--   infinite recursion detected in policy for relation "validations"
--
-- Aucune décision n'était donc possible. Ni au porteur, ni au
-- coordinateur, ni à l'administrateur en recours. Le circuit livré en
-- 0041 était inopérant de bout en bout.
--
-- Cause : la policy « Decide validation » posée en 0041 interrogeait
-- `validations` dans son propre corps, pour vérifier qu'aucun échelon
-- antérieur ne restait en attente. PostgreSQL applique la RLS à cette
-- lecture interne aussi — laquelle rappelle la même policy, qui relit
-- la table, sans fin. Le moteur détecte la boucle et refuse.
--
-- Ce n'est pas une subtilité rare : c'est la même erreur que les 0003 et
-- 0010, corrigées sur `profiles` puis sur les memberships. La règle qui
-- s'en dégage, et qu'il faut tenir : **une policy ne lit jamais sa
-- propre table directement.** Elle passe par une fonction
-- `security definer`, qui n'est pas soumise à la RLS.
--
-- Pourquoi la recette ne l'avait pas vu : elle s'est faite sur la
-- Coordination, où l'organisation porteuse et le coordinateur sont la
-- même — un seul échelon. Mais la boucle ne dépend pas du nombre de
-- lignes : elle est déclenchée à l'évaluation, même sur une chaîne à un
-- échelon. Le vrai motif est plus simple, et plus embarrassant : depuis
-- la 0041, personne n'avait cliqué sur « Valider ».

-- ------------------------------------------------------------
-- 1. L'ordre, calculé hors RLS
-- ------------------------------------------------------------
-- La fonction ne divulgue rien : elle répond « l'échelon précédent
-- a-t-il signé ? » par oui ou non, sur un document dont l'appelant
-- détient déjà l'identifiant. Aucune donnée ne sort.
create or replace function public.validation_step_is_open(doc_id uuid, at_step smallint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from validations prev
     where prev.document_id = doc_id
       and prev.step < at_step
       and prev.decision is distinct from 'valide'
  );
$$;

revoke all on function public.validation_step_is_open(uuid, smallint) from public;
grant execute on function public.validation_step_is_open(uuid, smallint) to authenticated;

-- ------------------------------------------------------------
-- 2. La policy, sans auto-lecture
-- ------------------------------------------------------------
-- Règle inchangée sur le fond, y compris le `with check` que la 0041
-- avait omis : sans lui, une mise à jour pouvait déplacer une ligne
-- vers un état que la clause `using` n'aurait plus autorisé — on
-- contrôlait la ligne avant, jamais après.
drop policy if exists "Decide validation" on validations;
create policy "Decide validation" on validations
  for update
  using (
    public.validation_step_is_open(document_id, step)
    and (
      -- Cas normal : membre de l'organisation sollicitée.
      exists (
        select 1 from memberships m
         where m.user_id = auth.uid() and m.org_id = validations.org_id
      )
      -- Recours d'exploitation, réservé au rôle « admin » (0036).
      or exists (
        select 1 from profiles p
         where p.id = auth.uid()
           and coalesce(p.platform_role, case when p.is_platform_admin then 'admin' else 'user' end) = 'admin'
      )
    )
  )
  with check (
    public.validation_step_is_open(document_id, step)
    and (
      exists (
        select 1 from memberships m
         where m.user_id = auth.uid() and m.org_id = validations.org_id
      )
      or exists (
        select 1 from profiles p
         where p.id = auth.uid()
           and coalesce(p.platform_role, case when p.is_platform_admin then 'admin' else 'user' end) = 'admin'
      )
    )
  );

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
-- Doit renvoyer une ligne, et son corps ne doit plus contenir
-- « from validations » :
--
--   select policyname, qual
--     from pg_policies
--    where tablename = 'validations' and policyname = 'Decide validation';
--
-- Et, connecté comme le membre de l'organisation sollicitée, la
-- décision doit passer sans erreur de récursion.

-- ============================================================================
-- MIGRATION 0046 — email send trace
-- ============================================================================

-- ============================================================
-- 0046 — La trace des envois RÉELS
-- ============================================================
-- « Le SMTP est en place, pourquoi je n'ai pas reçu de mail ? » (27/07)
--
-- La question était sans réponse possible, et c'est cela le défaut. La
-- 0040 conserve `last_test_*` : le résultat du bouton « Tester la
-- connexion ». Or ce bouton appelle `verify()` — il ouvre la session,
-- s'authentifie, referme. Il ne prouve donc RIEN de ce qui échoue le
-- plus souvent en production :
--
--   · le relais accepte l'authentification mais refuse l'expéditeur
--     (ici : s'authentifier en joe@ezrya.fr pour écrire sous
--     cem.notif@ezrya.fr — Hostinger le refuse couramment) ;
--   · le message part et se fait classer en indésirable ;
--   · l'adresse du destinataire est inexploitable.
--
-- Dans les trois cas, l'écran affichait « connexion réussie » pendant
-- que rien n'arrivait. Un test vert et une boîte vide : la pire des
-- combinaisons, parce qu'elle oriente le soupçon vers le destinataire.
--
-- Deux colonnes de plus, et la question devient vérifiable : quand
-- l'application a-t-elle réellement tenté d'écrire à quelqu'un, et
-- qu'a répondu le relais.

alter table email_settings
  add column if not exists last_send_at    timestamptz,
  add column if not exists last_send_to    text,
  add column if not exists last_send_ok    boolean,
  add column if not exists last_send_error text;

comment on column email_settings.last_send_at is
  'Dernier envoi RÉEL tenté (pas un test de connexion). Renseigné par le serveur, clé service.';
comment on column email_settings.last_send_error is
  'Réponse du relais au dernier envoi réel en échec. Vide si le dernier envoi a réussi.';

-- Aucune policy nouvelle : la table est déjà réservée aux admins en
-- lecture (0040), et l'écriture passe par la clé service — comme le
-- compteur d'IA (0043), et pour la même raison. Une trace que
-- l'application peut réécrire depuis le navigateur n'est pas une trace.

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select last_test_at, last_test_ok,
--          last_send_at, last_send_to, last_send_ok, last_send_error
--     from email_settings;
--
-- `last_test_ok` à vrai avec `last_send_at` à nul signifie exactement
-- ceci : la connexion fonctionne, et l'application n'a jamais essayé
-- d'écrire à personne.

-- ============================================================================
-- MIGRATION 0047 — auditor seat
-- ============================================================================

-- ============================================================
-- 0047 — Le contrôlé ne choisit pas son contrôleur
-- ============================================================
-- Constat de recette, 27/07 : connectée en chef de projet, Maria voyait
-- les rôles de TOUS les membres en liste déroulante, auditeurs compris,
-- avec le bouton de retrait à côté.
--
-- Deux défauts, l'un de conception, l'autre de contrôle.
--
-- 1. La gestion des membres était adossée à `phases.manage`. La même
--    autorisation servait donc à créer une phase et à décider qui a
--    accès au projet. Ce sont deux pouvoirs de nature différente,
--    confondus par commodité : une capacité `membres.manage` les
--    sépare désormais côté application.
--
-- 2. Et surtout : un chef de projet pouvait retirer les auditeurs de
--    son propre projet. L'audité congédiait son auditeur. Pour un
--    dispositif qui rend compte à un financeur public, c'est le
--    contrôle lui-même qui saute — et rien ne l'aurait signalé, sinon
--    une ligne au journal que personne ne relit.
--
-- C'est la symétrie exacte de la 0038, qui a retiré à l'auditeur le
-- droit de saisir les mesures : un auditeur ne saisit pas les chiffres
-- qu'il contrôle, et le contrôlé ne nomme pas celui qui le contrôle.
--
-- Arbitrage du 27/07 : ajouter un contributeur ou changer un rôle
-- opérationnel reste au chef de projet — c'est son travail quotidien.
-- Nommer ou retirer un AUDITEUR revient à l'administrateur plateforme.

-- ------------------------------------------------------------
-- Des policies RESTRICTIVES
-- ------------------------------------------------------------
-- Les policies ordinaires sont permissives : elles s'ajoutent les unes
-- aux autres par OU. En ajouter une ici n'aurait rien restreint — elle
-- se serait contentée d'ouvrir une voie de plus. `as restrictive` se
-- combine par ET : la règle s'impose à toutes les autorisations
-- existantes, quelles qu'elles soient, présentes et à venir.
--
-- Restreint uniquement l'ÉCRITURE. Une restriction en lecture masquerait
-- les auditeurs à tout le monde sauf aux administrateurs : le projet
-- ignorerait qui le contrôle, ce qui est le contraire du but recherché.

drop policy if exists "Auditor seat add" on project_members;
create policy "Auditor seat add" on project_members
  as restrictive for insert
  with check (role <> 'auditeur' or is_admin());

-- `using` juge la ligne AVANT, `with check` la ligne APRÈS. Les deux
-- sont nécessaires : sans la première on rétrograderait un auditeur en
-- contributeur, sans la seconde on promouvrait quelqu'un auditeur.
drop policy if exists "Auditor seat change" on project_members;
create policy "Auditor seat change" on project_members
  as restrictive for update
  using (role <> 'auditeur' or is_admin())
  with check (role <> 'auditeur' or is_admin());

drop policy if exists "Auditor seat remove" on project_members;
create policy "Auditor seat remove" on project_members
  as restrictive for delete
  using (role <> 'auditeur' or is_admin());

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select policyname, permissive, cmd
--     from pg_policies
--    where tablename = 'project_members'
--      and policyname like 'Auditor seat%'
--    order by policyname;
--
-- Les trois lignes doivent porter `permissive = 'RESTRICTIVE'`. Une
-- seule qui reviendrait à `PERMISSIVE` annulerait la règle en silence,
-- en ouvrant une voie au lieu d'en fermer une.
--
-- Essai réel, en chef de projet non administrateur : retirer un
-- auditeur doit échouer. Retirer un contributeur doit réussir.

-- ============================================================================
-- FIN — Prochaines étapes (voir docs/procedure-deploiement.md) :
--   1. Créer votre compte via la page de connexion de l'app (ou Dashboard
--      Supabase > Authentication > Add user).
--   2. Vous promouvoir administrateur. Depuis la 0037, `is_admin()` lit
--      `platform_role` en priorité — poser les DEUX colonnes évite toute
--      ambiguïté sur un compte créé avant cette migration :
--        update profiles
--           set platform_role = 'admin', is_platform_admin = true
--         where email = 'votre@email';
--   3. Vous rattacher à votre organisation — c'est CE lien qui décide des
--      projets visibles depuis la 0037, pas le rôle plateforme :
--        insert into memberships (user_id, org_id, role)
--        select p.id, o.id, 'admin_org'
--          from profiles p, organizations o
--         where p.email = 'votre@email' and o.name = 'YCID';
--   4. (Optionnel) Charger les données de démonstration : seed.sql.
--   5. (Optionnel) Configurer l'envoi d'emails dans Administration ▸
--      Configuration ▸ Email. Sans cela l'application fonctionne, mais
--      les notifications restent internes.
--   6. Désigner l'organisation coordinatrice dans Administration ▸
--      Configuration ▸ Validation. Tant que `coordinator_org_id` est
--      nul, la chaîne de validation (0041) se limite à l'organisation
--      porteuse — un devis validé par le porteur est engagé sans second
--      regard. Ce n'est pas une panne, c'est un réglage absent, et rien
--      à l'écran ne le distingue d'un circuit complet.
--   7. (Optionnel) Renseigner les tarifs du fournisseur d'IA et le
--      budget mensuel dans Administration ▸ Configuration ▸ IA. Sans
--      tarifs, le compteur (0043) compte les jetons mais chiffre 0 €.
--   8. Désactiver le signup public (Authentication > Providers).
-- ============================================================================
