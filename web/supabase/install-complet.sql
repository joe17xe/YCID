-- ============================================================================
-- SOLID'PILOT — INSTALLATION COMPLÈTE (Option A)
-- ============================================================================
-- ⚠️⚠️⚠️  SCRIPT DESTRUCTIF  ⚠️⚠️⚠️
-- Ce script SUPPRIME toutes les tables métier existantes (ancien schéma
-- simple comme nouveau schéma) puis installe le schéma complet du dépôt
-- (migrations 0001 → 0008 concaténées, à jour des correctifs).
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
create type org_type as enum ('association','collectivite','partenaire_local','partenaire_medical','financeur','financeur_public','mecene','autre');
create type org_status as enum ('active','inactive');
create type membership_role as enum ('admin_org','membre');
create type project_status as enum ('en_preparation','en_cours','suspendu','termine');
create type project_org_role as enum ('porteur','partenaire','financeur','observateur','partenaire_terrain','partenaire_medical','beneficiaire');
create type project_member_role as enum ('chef_projet','resp_financier','contributeur','validateur','auditeur','lecteur');
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
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name)
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
-- FIN — Prochaines étapes (voir docs/procedure-deploiement.md) :
--   1. Créer votre compte via la page de connexion de l'app (ou Dashboard
--      Supabase > Authentication > Add user).
--   2. Vous promouvoir admin plateforme :
--        update profiles set is_platform_admin = true where email = 'votre@email';
--   3. (Optionnel) Charger les données de démonstration : seed.sql.
--   4. Désactiver le signup public (Authentication > Providers).
-- ============================================================================
