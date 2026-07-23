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
