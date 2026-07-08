-- ============================================================
-- RESET COMPLET DU SCHEMA PUBLIC (efface l'ancienne app web/)
-- ============================================================
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on routines to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;

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
-- Solid'Pilot — Row Level Security V1
-- Matérialise côté serveur les permissions simulées dans le prototype.

-- Fonctions utilitaires
create or replace function public.current_profile_id() returns text
language sql stable security definer set search_path = public as
$$ select id from public.profiles where auth_user_id = auth.uid() $$;

create or replace function public.my_org_id() returns text
language sql stable security definer set search_path = public as
$$ select org_id from public.profiles where auth_user_id = auth.uid() $$;

create or replace function public.role_on(pid text) returns text
language sql stable security definer set search_path = public as
$$ select role from public.project_members where project_id = pid and user_id = public.current_profile_id() $$;

-- Visible si membre du projet OU si mon organisation y participe
create or replace function public.can_view(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members where project_id = pid and user_id = public.current_profile_id())
      or exists (select 1 from public.projects p where p.id = pid
                 and p.orgs @> jsonb_build_array(jsonb_build_object('orgId', public.my_org_id())))
$$;

create or replace function public.is_org_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce((select is_org_admin from public.profiles where auth_user_id = auth.uid()), false) $$;

create or replace function public.task_project(tid text) returns text
language sql stable security definer set search_path = public as
$$ select ph.project_id from public.tasks t join public.phases ph on ph.id = t.phase_id where t.id = tid $$;

create or replace function public.doc_project(did text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select public.task_project(d.task_id) from public.documents d where d.id = did and d.task_id is not null),
    (select bl.project_id from public.documents d join public.budget_lines bl on bl.id = d.line_id where d.id = did)
  )
$$;

-- Activation RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.phases enable row level security;
alter table public.tasks enable row level security;
alter table public.budget_lines enable row level security;
alter table public.documents enable row level security;
alter table public.validations enable row level security;
alter table public.audit_log enable row level security;
alter table public.indicators enable row level security;
alter table public.indicator_measures enable row level security;
alter table public.meetings enable row level security;
alter table public.decisions enable row level security;

-- Organisations et profils : lisibles par tout utilisateur connecté
create policy org_read on public.organizations for select to authenticated using (true);
create policy org_write on public.organizations for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

create policy profile_read on public.profiles for select to authenticated using (true);
create policy profile_self on public.profiles for update to authenticated
  using (auth_user_id = auth.uid());

-- Projets
create policy project_read on public.projects for select to authenticated using (public.can_view(id));
create policy project_insert on public.projects for insert to authenticated with check (public.is_org_admin());
create policy project_update on public.projects for update to authenticated
  using (public.role_on(id) = 'chef_projet');

create policy members_read on public.project_members for select to authenticated using (public.can_view(project_id));
create policy members_write on public.project_members for all to authenticated
  using (public.role_on(project_id) = 'chef_projet' or public.is_org_admin())
  with check (public.role_on(project_id) = 'chef_projet' or public.is_org_admin());

create policy phases_read on public.phases for select to authenticated using (public.can_view(project_id));
create policy phases_write on public.phases for all to authenticated
  using (public.role_on(project_id) = 'chef_projet')
  with check (public.role_on(project_id) = 'chef_projet');

-- Tâches : lecture membres/orgas, écriture comité, terrain, finances, validateur (revue)
create policy tasks_read on public.tasks for select to authenticated
  using (public.can_view(public.task_project(id)));
create policy tasks_write on public.tasks for all to authenticated
  using (public.role_on(public.task_project(id)) in ('chef_projet','contributeur','resp_financier','validateur'))
  with check (public.role_on(public.task_project(id)) in ('chef_projet','contributeur','resp_financier','validateur'));

create policy lines_read on public.budget_lines for select to authenticated using (public.can_view(project_id));
create policy lines_write on public.budget_lines for all to authenticated
  using (public.role_on(project_id) in ('chef_projet','resp_financier','validateur'))
  with check (public.role_on(project_id) in ('chef_projet','resp_financier','validateur'));

create policy docs_read on public.documents for select to authenticated
  using (public.can_view(public.doc_project(id)));
create policy docs_write on public.documents for all to authenticated
  using (public.role_on(public.doc_project(id)) in ('chef_projet','contributeur','resp_financier','validateur'))
  with check (true);

create policy validations_read on public.validations for select to authenticated
  using (public.can_view(public.doc_project(doc_id)));
create policy validations_insert on public.validations for insert to authenticated
  with check (public.role_on(public.doc_project(doc_id)) in ('chef_projet','contributeur','resp_financier'));
create policy validations_decide on public.validations for update to authenticated
  using (org_id = public.my_org_id());

-- Journal : lecture membres, insertion membres, JAMAIS de modification ni suppression
create policy audit_read on public.audit_log for select to authenticated using (public.can_view(project_id));
create policy audit_insert on public.audit_log for insert to authenticated
  with check (public.role_on(project_id) is not null);

create policy ind_read on public.indicators for select to authenticated using (public.can_view(project_id));
create policy ind_write on public.indicators for all to authenticated
  using (public.role_on(project_id) in ('chef_projet','resp_financier'))
  with check (public.role_on(project_id) in ('chef_projet','resp_financier'));

create policy meas_read on public.indicator_measures for select to authenticated
  using (public.can_view((select project_id from public.indicators i where i.id = indicator_id)));
create policy meas_write on public.indicator_measures for insert to authenticated
  with check (public.role_on((select project_id from public.indicators i where i.id = indicator_id))
              in ('chef_projet','resp_financier','contributeur'));

create policy meetings_read on public.meetings for select to authenticated using (public.can_view(project_id));
create policy meetings_write on public.meetings for all to authenticated
  using (public.role_on(project_id) = 'chef_projet')
  with check (public.role_on(project_id) = 'chef_projet');

create policy decisions_read on public.decisions for select to authenticated using (public.can_view(project_id));
create policy decisions_write on public.decisions for all to authenticated
  using (public.role_on(project_id) in ('chef_projet','contributeur','resp_financier'))
  with check (public.role_on(project_id) in ('chef_projet','contributeur','resp_financier'));
-- Solid'Pilot — Données du programme CEM Liban-Yvelines (106 200 EUR)
-- À exécuter APRÈS 001_schema.sql. Les profils sont liés aux comptes auth par email (trigger).

insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o1', 'YCID', 'financeur_public', 'France', 'bayoub@yvelines.fr', 'active');
insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o2', 'Libanais en Yvelines (LEY)', 'association', 'France', 'president@ley.fr', 'active');
insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o3', 'Comité de Jumelage de Jouy-en-Josas', 'association', 'France', 'contact@jumelage-jouy.fr', 'active');
insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o4', 'Commune de Villepreux', 'collectivite', 'France', 'c.beaucaire@villepreux.fr', 'active');
insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o5', 'Commune de Jouy-en-Josas', 'collectivite', 'France', 'c.neveu@jouy-en-josas.fr', 'active');
insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o6', 'Département des Yvelines (CD78)', 'collectivite', 'France', 'j.morice@yvelines.fr', 'active');
insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o7', 'MEAE', 'financeur_public', 'France', 'dctciv@diplomatie.gouv.fr', 'active');
insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o8', 'Municipalité d''Azour', 'partenaire_local', 'Liban', 'mairie@azour.gov.lb', 'active');
insert into public.organizations ("id", "name", "type", "country", "email", "status") values ('o9', 'Municipalité de Jeïta', 'partenaire_local', 'Liban', 'mairie@jeitavillage.com', 'active');

insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u1', 'Bérengère Ayoub', 'bayoub@yvelines.fr', 'o1', true);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u2', 'Président LEY (à nommer)', 'president@ley.fr', 'o2', true);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u3', 'Clara Beaucaire', 'c.beaucaire@villepreux.fr', 'o4', false);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u4', 'Céline Neveu', 'c.neveu@jouy-en-josas.fr', 'o5', false);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u5', 'Nour Azoury', 'nourazoury@gmail.com', 'o8', false);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u6', 'Mirna Seaibi', 'mirna.seaibi@jeitavillage.com', 'o9', false);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u7', 'Maria (experte locale)', 'maria@cem-liban.org', 'o8', false);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u8', 'Jordan Morice', 'j.morice@yvelines.fr', 'o6', false);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u9', 'Référent Comité de Jumelage (à nommer)', 'contact@jumelage-jouy.fr', 'o3', false);
insert into public.profiles ("id", "name", "email", "org_id", "is_org_admin") values ('u10', 'Joe Abinader', 'joe.abinader@gmail.com', 'o1', true);

insert into public.projects ("id", "name", "description", "country", "zone", "lat", "lng", "start_date", "end_date", "status", "lead_org_id", "budget", "currency", "orgs", "validation_roles") values ('p1', 'CEM Liban — Triade Villepreux · Azour · LEY', 'Valorisation du patrimoine naturel d''Azour (site du Shir, sentiers, camping), mobilisation des jeunes, formations de guides et trail annuel. LEY maître d''œuvre, transfert progressif à la municipalité d''Azour.', 'Liban', 'Azour (Jezzine)', 33.53, 35.57, '2025-09-01', '2027-01-31', 'en_cours', 'o2', 48650, 'EUR', '[{"orgId":"o2","role":"porteur"},{"orgId":"o4","role":"partenaire"},{"orgId":"o8","role":"beneficiaire"},{"orgId":"o7","role":"financeur"},{"orgId":"o1","role":"financeur"},{"orgId":"o6","role":"financeur"}]'::jsonb, '["porteur"]'::jsonb);
insert into public.projects ("id", "name", "description", "country", "zone", "lat", "lng", "start_date", "end_date", "status", "lead_org_id", "budget", "currency", "orgs", "validation_roles") values ('p2', 'CEM Liban — Triade Jouy-en-Josas · Jeïta · Comité de Jumelage', 'Sécurisation et signalétique des parcours vers la grotte de Jeïta, chantiers-jeunes, formations de guides et diagnostic pour un office de tourisme local. Comité de Jumelage maître d''œuvre, transfert progressif à la municipalité de Jeïta.', 'Liban', 'Jeïta (Kesrouan)', 33.96, 35.64, '2025-09-01', '2027-10-31', 'en_cours', 'o3', 28850, 'EUR', '[{"orgId":"o3","role":"porteur"},{"orgId":"o5","role":"partenaire"},{"orgId":"o9","role":"beneficiaire"},{"orgId":"o7","role":"financeur"},{"orgId":"o1","role":"financeur"}]'::jsonb, '["porteur"]'::jsonb);
insert into public.projects ("id", "name", "description", "country", "zone", "lat", "lng", "start_date", "end_date", "status", "lead_org_id", "budget", "currency", "orgs", "validation_roles") values ('p3', 'CEM Liban — Coordination et actions communes', 'Coordination YCID, COPIL, missions d''immersion croisées France-Liban, communication et capitalisation, sensibilisation grand public en Yvelines. Commun aux deux triades.', 'France / Liban', 'Yvelines', 48.8, 2.13, '2025-09-01', '2027-10-31', 'en_cours', 'o1', 28200, 'EUR', '[{"orgId":"o1","role":"porteur"},{"orgId":"o4","role":"partenaire"},{"orgId":"o5","role":"partenaire"},{"orgId":"o2","role":"partenaire"},{"orgId":"o3","role":"partenaire"},{"orgId":"o7","role":"financeur"},{"orgId":"o6","role":"financeur"},{"orgId":"o8","role":"observateur"},{"orgId":"o9","role":"observateur"}]'::jsonb, '["porteur"]'::jsonb);

insert into public.project_members ("project_id", "user_id", "role") values ('p1', 'u3', 'chef_projet');
insert into public.project_members ("project_id", "user_id", "role") values ('p1', 'u2', 'resp_financier');
insert into public.project_members ("project_id", "user_id", "role") values ('p1', 'u7', 'contributeur');
insert into public.project_members ("project_id", "user_id", "role") values ('p1', 'u5', 'contributeur');
insert into public.project_members ("project_id", "user_id", "role") values ('p1', 'u1', 'validateur');
insert into public.project_members ("project_id", "user_id", "role") values ('p1', 'u8', 'lecteur');
insert into public.project_members ("project_id", "user_id", "role") values ('p2', 'u4', 'chef_projet');
insert into public.project_members ("project_id", "user_id", "role") values ('p2', 'u9', 'resp_financier');
insert into public.project_members ("project_id", "user_id", "role") values ('p2', 'u6', 'contributeur');
insert into public.project_members ("project_id", "user_id", "role") values ('p2', 'u1', 'validateur');
insert into public.project_members ("project_id", "user_id", "role") values ('p2', 'u8', 'lecteur');
insert into public.project_members ("project_id", "user_id", "role") values ('p3', 'u1', 'chef_projet');
insert into public.project_members ("project_id", "user_id", "role") values ('p3', 'u3', 'contributeur');
insert into public.project_members ("project_id", "user_id", "role") values ('p3', 'u4', 'contributeur');
insert into public.project_members ("project_id", "user_id", "role") values ('p3', 'u2', 'contributeur');
insert into public.project_members ("project_id", "user_id", "role") values ('p3', 'u9', 'contributeur');
insert into public.project_members ("project_id", "user_id", "role") values ('p3', 'u8', 'validateur');

insert into public.phases ("id", "project_id", "name", "budget", "start_date", "end_date", "status") values ('ph1', 'p1', 'Action 1 — Aménagements et patrimoine (Azour)', 31100, '2025-09-01', '2027-01-31', 'en_cours');
insert into public.phases ("id", "project_id", "name", "budget", "start_date", "end_date", "status") values ('ph2', 'p1', 'Action 2 — Sensibilisation des jeunes', 4550, '2026-01-01', '2027-10-31', 'en_cours');
insert into public.phases ("id", "project_id", "name", "budget", "start_date", "end_date", "status") values ('ph3', 'p1', 'Action 3 — Trails et sport nature', 8000, '2026-03-01', '2027-09-30', 'a_venir');
insert into public.phases ("id", "project_id", "name", "budget", "start_date", "end_date", "status") values ('ph4', 'p2', 'Action 1 — Aménagements et patrimoine (Jeïta)', 22300, '2025-09-01', '2027-01-31', 'en_cours');
insert into public.phases ("id", "project_id", "name", "budget", "start_date", "end_date", "status") values ('ph5', 'p2', 'Action 2 — Sensibilisation des jeunes', 4550, '2026-01-01', '2027-10-31', 'a_venir');
insert into public.phases ("id", "project_id", "name", "budget", "start_date", "end_date", "status") values ('ph6', 'p2', 'Action 3 — Sensibilisation scolaire et sport', 1000, '2026-03-01', '2027-09-30', 'a_venir');
insert into public.phases ("id", "project_id", "name", "budget", "start_date", "end_date", "status") values ('ph7', 'p3', 'Missions et échanges de pratiques', 23100, '2025-09-01', '2027-10-31', 'en_cours');
insert into public.phases ("id", "project_id", "name", "budget", "start_date", "end_date", "status") values ('ph8', 'p3', 'Gouvernance, communication et reporting', 5100, '2025-09-01', '2027-10-31', 'en_cours');

insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t1', 'ph1', 'Diagnostic terrain et conception des maquettes', 'Site du Shir et sentiers d''Azour.', 'u7', '2025-10-01', '2025-12-15', 'terminee', 100, 'Maquettes livrées et partagées avec la municipalité.', 'u2', 'valide');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t2', 'ph1', 'Sélection et contractualisation du paysagiste', '', 'u2', '2026-05-01', '2026-07-17', 'en_cours', 60, 'Devis reçu, en validation.', 'u2', 'soumis');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t3', 'ph1', 'Chantier jeunes — défrichage du Shir', 'Jeunes du Club Sportif encadrés par les employés municipaux.', 'u7', '2026-07-15', '2026-08-15', 'a_faire', 0, '', 'u3', 'brouillon');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t4', 'ph2', 'Programme des sessions de sensibilisation été 2026', '3 sessions à Azour, 20 jeunes locaux + 20 de Jeïta par session.', 'u5', '2026-05-15', '2026-07-01', 'en_cours', 40, 'En attente des disponibilités du spéléologue.', 'u3', 'brouillon');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t5', 'ph3', 'Préparation du trail d''Azour 2027', 'Appui du Lebanon Mountain Trail, implication du club de basket féminin.', 'u5', '2026-09-01', '2027-03-31', 'a_faire', 0, '', 'u3', 'brouillon');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t6', 'ph4', 'Convention d''encadrement des chantiers-jeunes', '', 'u9', '2025-11-01', '2026-01-31', 'terminee', 100, '', 'u4', 'valide');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t7', 'ph4', 'Travaux de défrichage et terrassement (Jeïta)', 'Jeunes + ouvriers municipaux, parcours vers la grotte.', 'u6', '2026-04-01', '2026-09-30', 'en_cours', 45, '', 'u4', 'soumis');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t8', 'ph4', 'Diagnostic pour l''office de tourisme local', '', 'u6', '2026-09-01', '2026-12-15', 'a_faire', 0, '', 'u4', 'brouillon');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t9', 'ph7', 'Rapport succinct d''activités au MEAE', 'Condition du versement de la subvention.', 'u1', '2026-01-05', '2026-02-28', 'terminee', 100, 'Transmis à la DCTCIV.', 'u1', 'valide');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t10', 'ph7', 'Rapport intermédiaire MEAE (narratif + financier)', 'Volet narratif + justificatifs de dépenses.', 'u1', '2026-07-01', '2026-09-30', 'en_cours', 20, '', 'u1', 'brouillon');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t11', 'ph7', 'Organisation de l''immersion yvelinoise au Liban', 'Élus et agents de Villepreux, Jouy et YCID.', 'u1', '2026-06-01', '2026-10-15', 'en_cours', 50, '', 'u1', 'brouillon');
insert into public.tasks ("id", "phase_id", "title", "description", "assignee_id", "start_date", "end_date", "status", "progress", "comment", "created_by", "review") values ('t12', 'ph8', 'Points bimensuels des triades', 'Villepreux/Azour/LEY et Jouy/Jeïta/Comité, animés par YCID.', 'u1', '2025-12-01', '2027-10-31', 'en_cours', 50, '', 'u1', 'brouillon');

insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l1', 'p1', 'ph1', 'Diagnostic terrain et maquettes', '', 'projet', 'o2', 'o2', 2025, 3000, false, 'cloturee', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l2', 'p1', 'ph1', 'Aménagement du site principal du Shir', '', 'investissement', 'o6', 'o2', 2026, 8200, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l3', 'p1', 'ph1', 'Équipement de sensibilisation (panneaux, tablettes)', '', 'investissement', 'o1', 'o2', 2026, 3200, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l4', 'p1', 'ph1', 'Main d''œuvre et suivi du paysagiste', '', 'fonctionnement', 'o7', 'o2', 2026, 1000, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l5', 'p1', 'ph1', 'Sécurisation du chemin Shir el Joub', '', 'investissement', 'o4', 'o2', 2026, 1100, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l6', 'p1', 'ph1', 'Sentier vers la vallée du Bisri', 'Aires de repos, panneaux', 'investissement', 'o6', 'o2', 2026, 2750, false, 'active', '', 'soumis');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l7', 'p1', 'ph1', 'Site de camping El Abo - Le Cave', '', 'investissement', 'o6', 'o2', 2026, 2950, false, 'active', '', 'soumis');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l8', 'p1', 'ph2', 'Formations de jeunes guides (Azour)', '', 'projet', 'o7', 'o2', 2026, 4500, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l9', 'p1', 'ph1', 'Structuration de l''offre de randonnée', 'Cartographie, topographie', 'projet', 'o7', 'o2', 2026, 2900, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l10', 'p1', 'ph1', 'Cérémonie et randonnée d''inauguration (Azour)', '', 'projet', 'o8', 'o2', 2027, 1500, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l11', 'p1', 'ph2', 'Échanges jeunes Jeïta→Azour : animation, hébergement', '', 'projet', 'o7', 'o2', 2026, 2700, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l12', 'p1', 'ph2', 'Échanges jeunes Azour→Jeïta : transport', '', 'projet', 'o4', 'o2', 2026, 900, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l13', 'p1', 'ph2', 'Visites de terrain par un spécialiste (part Azour)', 'Spéléologue Habib Helou pressenti', 'projet', 'o7', 'o2', 2026, 450, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l14', 'p1', 'ph2', 'Rénovation de sentier par le CMJ de Villepreux', '', 'projet', 'o4', 'o4', 2026, 500, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l15', 'p1', 'ph3', 'Trail annuel à Azour', 'Organisation, logistique, communication', 'projet', 'o7', 'o2', 2027, 4000, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l16', 'p1', 'ph3', 'Trail annuel à Villepreux et Jouy-en-Josas', '', 'projet', 'o4', 'o4', 2026, 2000, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l17', 'p1', 'ph3', 'Participation d''une délégation libanaise au trail yvelinois', 'Édition octobre 2026', 'projet', 'o4', 'o4', 2026, 2000, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l18', 'p1', null, 'Mise à disposition — Commune de Villepreux', 'Temps de travail, ressources', 'fonctionnement', 'o4', 'o4', 2026, 2000, true, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l19', 'p1', null, 'Mise à disposition — Libanais en Yvelines', 'Temps de travail, ressources, déplacements', 'fonctionnement', 'o2', 'o2', 2026, 3000, true, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l20', 'p2', 'ph4', 'Coordination et encadrement technique des chantiers-jeunes', '', 'fonctionnement', 'o7', 'o3', 2026, 3000, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l21', 'p2', 'ph4', 'Travaux d''aménagement Jeïta (part YCID)', 'Défrichage, nettoyage, terrassement', 'investissement', 'o1', 'o3', 2026, 6700, false, 'active', 'Cofinancement : ligne scindée YCID / Jouy', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l22', 'p2', 'ph4', 'Travaux d''aménagement Jeïta (part Jouy-en-Josas)', '', 'investissement', 'o5', 'o3', 2026, 2000, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l23', 'p2', 'ph4', 'Travaux d''aménagement (complément)', '', 'investissement', 'o3', 'o3', 2026, 100, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l24', 'p2', 'ph4', 'Formations de jeunes guides (Jeïta)', '', 'projet', 'o7', 'o3', 2026, 6000, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l25', 'p2', 'ph4', 'Cérémonie et randonnée d''inauguration (Jeïta)', '', 'projet', 'o9', 'o3', 2027, 1500, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l26', 'p2', 'ph4', 'Diagnostic pour la création d''un office de tourisme', '', 'projet', 'o7', 'o3', 2026, 3000, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l27', 'p2', 'ph5', 'Échanges jeunes Jeïta→Azour : transport', '', 'projet', 'o3', 'o3', 2026, 900, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l28', 'p2', 'ph5', 'Échanges jeunes Azour→Jeïta : animation, hébergement', '', 'projet', 'o7', 'o3', 2026, 2700, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l29', 'p2', 'ph5', 'Visites de terrain par un spécialiste (part Jeïta)', '', 'projet', 'o7', 'o3', 2026, 450, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l30', 'p2', 'ph5', 'Rénovation de sentier par le CMJ de Jouy-en-Josas', '', 'projet', 'o7', 'o5', 2026, 500, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l31', 'p2', 'ph6', 'Sensibilisation scolaire en Yvelines (complément)', '', 'projet', 'o5', 'o3', 2026, 1000, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l32', 'p2', null, 'Mise à disposition — Comité de Jumelage', 'Temps de travail, ressources', 'fonctionnement', 'o3', 'o3', 2026, 1500, true, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l33', 'p3', 'ph7', 'Immersion des partenaires yvelinois au Liban', '', 'fonctionnement', 'o7', 'o1', 2026, 8000, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l34', 'p3', 'ph7', 'Immersion des partenaires libanais en France', '', 'fonctionnement', 'o7', 'o1', 2026, 8000, false, 'prevue', '', 'brouillon');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l35', 'p3', 'ph7', 'Mission de suivi et accompagnement des communes (YCID)', '', 'fonctionnement', 'o1', 'o1', 2026, 7100, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l36', 'p3', 'ph8', 'Réunions de travail et COPIL (défraiements)', '', 'fonctionnement', 'o6', 'o1', 2026, 1100, false, 'active', '', 'valide');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l37', 'p3', 'ph8', 'Communication (photo, vidéo, documentaire)', '', 'projet', 'o7', 'o1', 2026, 3000, false, 'active', '', 'soumis');
insert into public.budget_lines ("id", "project_id", "phase_id", "poste", "description", "category", "funder_org_id", "owner_org_id", "year", "planned", "valorisation", "status", "comment", "review") values ('l38', 'p3', 'ph8', 'Actions de sensibilisation grand public en Yvelines', '', 'projet', 'o7', 'o1', 2026, 1000, false, 'prevue', '', 'brouillon');

insert into public.documents ("id", "task_id", "line_id", "type", "filename", "amount", "by", "date") values ('d1', 't2', 'l2', 'devis', 'devis-paysagiste-shir.pdf', 7900, 'u2', '2026-06-20');
insert into public.documents ("id", "task_id", "line_id", "type", "filename", "amount", "by", "date") values ('d2', 't7', 'l21', 'devis', 'devis-signaletique-jeita.pdf', 2400, 'u6', '2026-06-28');
insert into public.documents ("id", "task_id", "line_id", "type", "filename", "amount", "paid", "by", "date", "review") values ('d3', 't1', 'l1', 'facture', 'facture-diagnostic-maquettes.pdf', 3000, true, 'u2', '2026-01-15', 'valide');
insert into public.documents ("id", "task_id", "line_id", "type", "filename", "amount", "by", "date", "review") values ('d4', null, 'l33', 'convention', 'convention-partenariat-2025.pdf', null, 'u1', '2025-12-19', 'valide');
insert into public.documents ("id", "task_id", "line_id", "type", "filename", "amount", "by", "date", "review") values ('d5', null, 'l36', 'rapport', 'cr-copil-lancement-2025-11-26.pdf', null, 'u1', '2025-12-02', 'valide');
insert into public.documents ("id", "task_id", "line_id", "type", "filename", "amount", "by", "date", "review") values ('d6', 't1', null, 'livrable', 'maquettes-amenagement-shir.pdf', null, 'u7', '2025-12-15', 'valide');
insert into public.documents ("id", "task_id", "line_id", "type", "filename", "amount", "by", "date", "review") values ('d7', 't9', null, 'livrable', 'rapport-succinct-meae-2026.pdf', null, 'u1', '2026-02-25', 'valide');

insert into public.validations ("id", "doc_id", "org_id", "role", "decision", "date", "comment") values ('v1', 'd1', 'o2', 'porteur', 'en_attente', '', '');
insert into public.validations ("id", "doc_id", "org_id", "role", "decision", "date", "comment") values ('v2', 'd2', 'o3', 'porteur', 'valide', '2026-07-02', '');

insert into public.audit_log ("id", "project_id", "entity", "entity_id", "label", "action", "by", "at", "comment") values ('a1', 'p3', 'reunion', 'mt1', 'COPIL de lancement', 'cree', 'u1', '2025-11-26 18:05', 'Matrice RACI adoptée');
insert into public.audit_log ("id", "project_id", "entity", "entity_id", "label", "action", "by", "at", "comment") values ('a2', 'p1', 'document', 'd6', 'Livrable maquettes-amenagement-shir.pdf', 'valide', 'u1', '2026-01-08 11:20', '');
insert into public.audit_log ("id", "project_id", "entity", "entity_id", "label", "action", "by", "at", "comment") values ('a3', 'p3', 'tache', 't9', 'Tâche Rapport succinct MEAE', 'valide', 'u8', '2026-03-05 09:40', 'Condition du versement remplie');
insert into public.audit_log ("id", "project_id", "entity", "entity_id", "label", "action", "by", "at", "comment") values ('a4', 'p1', 'document', 'd1', 'Devis devis-paysagiste-shir.pdf', 'soumis', 'u2', '2026-06-20 16:12', '');
insert into public.audit_log ("id", "project_id", "entity", "entity_id", "label", "action", "by", "at", "comment") values ('a5', 'p2', 'document', 'd2', 'Devis devis-signaletique-jeita.pdf', 'valide', 'u9', '2026-07-02 10:30', '');
insert into public.audit_log ("id", "project_id", "entity", "entity_id", "label", "action", "by", "at", "comment") values ('a6', 'p1', 'tache', 't2', 'Tâche Sélection du paysagiste', 'soumis', 'u2', '2026-06-21 08:50', '');

insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i1', 'p1', 'Kilomètres de sentiers restaurés (Azour)', 'quantitatif', 'km', 'trimestriel', 'manuelle', 0, 7, null);
insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i2', 'p1', 'Jeunes mobilisés sur les chantiers (Azour)', 'quantitatif', 'jeunes', 'trimestriel', 'manuelle', 0, 50, null);
insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i3', 'p1', 'Participants au trail d''Azour', 'quantitatif', 'participants', 'ponctuel', 'manuelle', 0, 250, null);
insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i4', 'p2', 'Jeunes mobilisés sur les chantiers (Jeïta)', 'quantitatif', 'jeunes', 'trimestriel', 'manuelle', 0, 50, null);
insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i5', 'p2', 'Jeunes formés guides (Jeïta)', 'quantitatif', 'jeunes', 'trimestriel', 'manuelle', 0, 30, null);
insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i6', 'p3', 'Jeunes sensibilisés lors des sessions croisées', 'quantitatif', 'jeunes', 'trimestriel', 'manuelle', 0, 240, null);
insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i7', 'p3', 'COPIL tenus', 'quantitatif', 'COPIL', 'trimestriel', 'manuelle', 0, 4, null);
insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i8', 'p3', 'Missions de terrain réalisées', 'quantitatif', 'missions', 'trimestriel', 'manuelle', 0, 4, null);
insert into public.indicators ("id", "project_id", "name", "kind", "unit", "periodicity", "source", "baseline", "target", "phase_id") values ('i9', 'p3', 'Qualité de la coopération entre triades', 'qualitatif', 'score /5', 'annuel', 'manuelle', 2, 4, null);

insert into public.indicator_measures ("id", "indicator_id", "period", "value", "comment", "by", "at") values ('me1', 'i1', '2026-T2', 1.5, 'Premier tronçon du Shir défriché', 'u7', '2026-07-01');
insert into public.indicator_measures ("id", "indicator_id", "period", "value", "comment", "by", "at") values ('me2', 'i2', '2026-T2', 12, 'Jeunes du Club Sportif d''Azour', 'u7', '2026-07-01');
insert into public.indicator_measures ("id", "indicator_id", "period", "value", "comment", "by", "at") values ('me3', 'i4', '2026-T2', 18, '', 'u6', '2026-07-01');
insert into public.indicator_measures ("id", "indicator_id", "period", "value", "comment", "by", "at") values ('me4', 'i7', '2025-T4', 1, 'COPIL de lancement du 26/11/2025', 'u1', '2025-12-01');
insert into public.indicator_measures ("id", "indicator_id", "period", "value", "comment", "by", "at") values ('me5', 'i8', '2026-T2', 1, 'Mission LEY à Azour (mai 2025) comptée hors projet ; 1re mission projet réalisée', 'u1', '2026-06-30');
insert into public.indicator_measures ("id", "indicator_id", "period", "value", "comment", "by", "at") values ('me6', 'i9', '2026', 3, 'Gouvernance RACI appropriée, points bimensuels réguliers', 'u1', '2026-06-30');

insert into public.meetings ("id", "project_id", "title", "kind", "date", "attendees", "minutes") values ('mt1', 'p3', 'COPIL de lancement', 'copil', '2025-11-26', 'YCID, CD78, Villepreux, Jouy-en-Josas, LEY, Comité de Jumelage, Azour, Jeïta', 'Adoption de la matrice RACI (rôles et responsabilités par tâche), validation du calendrier général et de la gouvernance : 2 COPIL par an, points bimensuels par triade animés par YCID, associations maîtresses d''œuvre avec transfert progressif aux municipalités libanaises.');
insert into public.meetings ("id", "project_id", "title", "kind", "date", "attendees", "minutes") values ('mt2', 'p1', 'Point triade Villepreux · Azour · LEY', 'technique', '2026-06-10', 'Clara Beaucaire, Président LEY, Nour Azoury, Maria, YCID', 'Revue des devis paysagiste, préparation du chantier jeunes de juillet et du programme de sensibilisation de l''été.');

insert into public.decisions ("id", "meeting_id", "project_id", "text", "owner_id", "due", "status") values ('dc1', 'mt1', 'p3', 'Signer la convention de partenariat (déclenche les premiers versements)', 'u1', '2025-12-31', 'fait');
insert into public.decisions ("id", "meeting_id", "project_id", "text", "owner_id", "due", "status") values ('dc2', 'mt1', 'p3', 'Soumettre le rapport succinct d''activités au MEAE', 'u1', '2026-02-28', 'fait');
insert into public.decisions ("id", "meeting_id", "project_id", "text", "owner_id", "due", "status") values ('dc3', 'mt1', 'p3', 'Préparer le rapport intermédiaire de septembre (narratif + financier)', 'u1', '2026-09-30', 'en_cours');
insert into public.decisions ("id", "meeting_id", "project_id", "text", "owner_id", "due", "status") values ('dc4', 'mt2', 'p1', 'Retenir le paysagiste et faire valider le devis par LEY', 'u2', '2026-07-10', 'en_cours');

-- Liaison des comptes auth déjà existants aux profils (au cas où l'utilisateur
-- s'est connecté avant le seed : le trigger on_auth_user_created ne se déclenche
-- que lors de la création du compte auth, pas aux connexions suivantes).
update public.profiles p
set auth_user_id = u.id
from auth.users u
where lower(p.email) = lower(u.email) and p.auth_user_id is null;
