-- ============================================================
-- PATCH RLS — Les admins plateforme voient tout
-- À exécuter dans le SQL Editor Supabase
-- ============================================================
-- En redéfinissant is_project_member pour inclure les admins,
-- toutes les policies existantes laissent voir l'admin.

create or replace function is_project_member(pid uuid)
returns boolean language sql security definer as $$
  select
    exists (select 1 from profiles where id = auth.uid() and is_platform_admin = true)
    or exists (
      select 1 from project_members
      where project_id = pid and user_id = auth.uid()
    )
    or exists (
      select 1 from project_organizations po
      join memberships m on m.org_id = po.org_id
      where po.project_id = pid and m.user_id = auth.uid()
    );
$$;
