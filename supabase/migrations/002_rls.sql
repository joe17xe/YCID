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
