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
