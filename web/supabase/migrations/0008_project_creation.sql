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
