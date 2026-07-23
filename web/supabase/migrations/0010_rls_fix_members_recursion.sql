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
