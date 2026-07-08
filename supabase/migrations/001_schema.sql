-- Solid'Pilot — Schéma V1 (identifiants texte pour compatibilité avec les données existantes)

create table public.organizations (
  id text primary key,
  name text not null,
  type text not null default 'autre',
  country text default '',
  email text default '',
  status text not null default 'active'
);

create table public.profiles (
  id text primary key,
  name text not null,
  email text unique not null,
  org_id text references public.organizations(id),
  is_org_admin boolean not null default false,
  auth_user_id uuid unique references auth.users(id)
);

create table public.projects (
  id text primary key,
  name text not null,
  description text default '',
  country text default '',
  zone text default '',
  lat double precision,
  lng double precision,
  start_date text default '',
  end_date text default '',
  status text not null default 'en_preparation',
  lead_org_id text references public.organizations(id),
  budget numeric,
  currency text not null default 'EUR',
  orgs jsonb not null default '[]',              -- [{orgId, role}]
  validation_roles jsonb not null default '[]'   -- circuit devis
);

create table public.project_members (
  project_id text references public.projects(id) on delete cascade,
  user_id text references public.profiles(id) on delete cascade,
  role text not null,  -- chef_projet | resp_financier | contributeur | validateur | auditeur | lecteur
  primary key (project_id, user_id)
);

create table public.phases (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  budget numeric,
  start_date text default '',
  end_date text default '',
  status text default 'a_venir'
);

create table public.tasks (
  id text primary key,
  phase_id text not null references public.phases(id) on delete cascade,
  title text not null,
  description text default '',
  assignee_id text default '',
  start_date text default '',
  end_date text default '',
  status text not null default 'a_faire',
  progress int not null default 0,
  comment text default '',
  created_by text,
  review text not null default 'brouillon'
);

create table public.budget_lines (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  phase_id text references public.phases(id),
  poste text not null,
  description text default '',
  category text not null default 'autre',
  funder_org_id text references public.organizations(id),
  owner_org_id text references public.organizations(id),
  year int,
  planned numeric not null default 0,
  valorisation boolean not null default false,
  status text not null default 'prevue',
  comment text default '',
  review text not null default 'brouillon'
);

create table public.documents (
  id text primary key,
  task_id text references public.tasks(id),
  line_id text references public.budget_lines(id),
  type text not null,
  filename text not null,
  amount numeric,
  paid boolean,
  by text,
  date text default '',
  review text
);

create table public.validations (
  id text primary key,
  doc_id text not null references public.documents(id) on delete cascade,
  org_id text not null references public.organizations(id),
  role text not null,
  decision text not null default 'en_attente',
  date text default '',
  comment text default ''
);

-- Journal en append-only : aucune policy UPDATE/DELETE ne sera créée
create table public.audit_log (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  entity text not null,
  entity_id text not null,
  label text not null,
  action text not null,
  by text,
  at text not null,
  comment text default ''
);

create table public.indicators (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  kind text not null default 'quantitatif',
  unit text default '',
  periodicity text not null default 'ponctuel',
  source text not null default 'manuelle',
  baseline numeric not null default 0,
  target numeric not null default 0,
  phase_id text references public.phases(id)
);

create table public.indicator_measures (
  id text primary key,
  indicator_id text not null references public.indicators(id) on delete cascade,
  period text not null,
  value numeric not null,
  comment text default '',
  by text,
  at text default ''
);

create table public.meetings (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  kind text not null default 'copil',
  date text default '',
  attendees text default '',
  minutes text default ''
);

create table public.decisions (
  id text primary key,
  meeting_id text not null references public.meetings(id) on delete cascade,
  project_id text not null references public.projects(id) on delete cascade,
  text text not null,
  owner_id text,
  due text default '',
  status text not null default 'a_faire'
);

-- Liaison automatique compte auth <-> profil provisionné (par email)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set auth_user_id = new.id
  where lower(email) = lower(new.email) and auth_user_id is null;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
