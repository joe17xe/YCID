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
