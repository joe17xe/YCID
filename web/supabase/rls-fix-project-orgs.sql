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
