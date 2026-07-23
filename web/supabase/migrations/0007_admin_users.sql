-- ============================================================
-- MIGRATION 0007 — Écran Administration > Utilisateurs
-- ============================================================
-- Les admins d'organisation YCID / LEY doivent pouvoir voir la
-- liste des utilisateurs et leurs rattachements (jusqu'ici seuls
-- les admins plateforme voyaient tous les profils, et personne
-- ne voyait les memberships des autres).

create or replace function is_lead_org_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.memberships m
    join public.organizations o on o.id = m.org_id
    where m.user_id = auth.uid()
      and m.role = 'admin_org'
      and (upper(o.name) like '%YCID%' or upper(o.name) like '%LEY%')
  );
$$;

drop policy if exists "Lead org admins see profiles" on profiles;
create policy "Lead org admins see profiles" on profiles
  for select using (is_lead_org_admin());

drop policy if exists "Admins see memberships" on memberships;
create policy "Admins see memberships" on memberships
  for select using (is_admin() or is_lead_org_admin());
