-- Solid'Pilot — Accès administrateur complet (is_org_admin)
-- Idempotent : peut être exécuté sur une base déjà en place (drop policy if exists + recreate).
-- Un administrateur d'organisation peut tout voir et tout éditer.

-- can_view : un admin voit tous les projets
create or replace function public.can_view(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_org_admin()
      or exists (select 1 from public.project_members where project_id = pid and user_id = public.current_profile_id())
      or exists (select 1 from public.projects p where p.id = pid
                 and p.orgs @> jsonb_build_array(jsonb_build_object('orgId', public.my_org_id())))
$$;

-- Profils : un admin peut créer / modifier / supprimer des personnes
drop policy if exists profile_admin_write on public.profiles;
create policy profile_admin_write on public.profiles for all to authenticated
  using (public.is_org_admin()) with check (public.is_org_admin());

-- Organisations : suppression réservée aux admins (lecture + écriture déjà gérées)
drop policy if exists org_delete on public.organizations;
create policy org_delete on public.organizations for delete to authenticated
  using (public.is_org_admin());

-- Projets : édition par le chef de projet OU un admin ; suppression par un admin
drop policy if exists project_update on public.projects;
create policy project_update on public.projects for update to authenticated
  using (public.role_on(id) = 'chef_projet' or public.is_org_admin())
  with check (public.role_on(id) = 'chef_projet' or public.is_org_admin());
drop policy if exists project_delete on public.projects;
create policy project_delete on public.projects for delete to authenticated
  using (public.is_org_admin());

-- Phases
drop policy if exists phases_write on public.phases;
create policy phases_write on public.phases for all to authenticated
  using (public.role_on(project_id) = 'chef_projet' or public.is_org_admin())
  with check (public.role_on(project_id) = 'chef_projet' or public.is_org_admin());

-- Tâches
drop policy if exists tasks_write on public.tasks;
create policy tasks_write on public.tasks for all to authenticated
  using (public.role_on(public.task_project(id)) in ('chef_projet','contributeur','resp_financier','validateur') or public.is_org_admin())
  with check (public.role_on(public.task_project(id)) in ('chef_projet','contributeur','resp_financier','validateur') or public.is_org_admin());

-- Lignes budgétaires
drop policy if exists lines_write on public.budget_lines;
create policy lines_write on public.budget_lines for all to authenticated
  using (public.role_on(project_id) in ('chef_projet','resp_financier','validateur') or public.is_org_admin())
  with check (public.role_on(project_id) in ('chef_projet','resp_financier','validateur') or public.is_org_admin());

-- Documents
drop policy if exists docs_write on public.documents;
create policy docs_write on public.documents for all to authenticated
  using (public.role_on(public.doc_project(id)) in ('chef_projet','contributeur','resp_financier','validateur') or public.is_org_admin())
  with check (true);

-- Validations
drop policy if exists validations_insert on public.validations;
create policy validations_insert on public.validations for insert to authenticated
  with check (public.role_on(public.doc_project(doc_id)) in ('chef_projet','contributeur','resp_financier') or public.is_org_admin());
drop policy if exists validations_decide on public.validations;
create policy validations_decide on public.validations for update to authenticated
  using (org_id = public.my_org_id() or public.is_org_admin());

-- Journal d'audit : insertion par un membre projet OU un admin
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert to authenticated
  with check (public.role_on(project_id) is not null or public.is_org_admin());

-- Indicateurs
drop policy if exists ind_write on public.indicators;
create policy ind_write on public.indicators for all to authenticated
  using (public.role_on(project_id) in ('chef_projet','resp_financier') or public.is_org_admin())
  with check (public.role_on(project_id) in ('chef_projet','resp_financier') or public.is_org_admin());

-- Mesures d'indicateurs
drop policy if exists meas_write on public.indicator_measures;
create policy meas_write on public.indicator_measures for insert to authenticated
  with check (public.role_on((select project_id from public.indicators i where i.id = indicator_id)) in ('chef_projet','resp_financier','contributeur') or public.is_org_admin());

-- Réunions
drop policy if exists meetings_write on public.meetings;
create policy meetings_write on public.meetings for all to authenticated
  using (public.role_on(project_id) = 'chef_projet' or public.is_org_admin())
  with check (public.role_on(project_id) = 'chef_projet' or public.is_org_admin());

-- Décisions
drop policy if exists decisions_write on public.decisions;
create policy decisions_write on public.decisions for all to authenticated
  using (public.role_on(project_id) in ('chef_projet','contributeur','resp_financier') or public.is_org_admin())
  with check (public.role_on(project_id) in ('chef_projet','contributeur','resp_financier') or public.is_org_admin());
