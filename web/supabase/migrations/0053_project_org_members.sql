-- ============================================================
-- MIGRATION 0053 — Qui compose les organisations d'un projet
-- ============================================================
-- Demande du 28/07 : inviter une réunion PAR ORGANISATION — « YCID
-- veut voir LEY », « Azour + LEY + Maria + Villepreux » — c'est-à-dire
-- cocher une organisation et inviter d'un coup ses comptes.
--
-- Le verrou : memberships n'est lisible que par soi-même ou l'admin de
-- l'organisation (0001) — un chef de projet ne peut pas savoir qui
-- compose LEY. Cette fonction SECURITY DEFINER l'autorise, dans un
-- périmètre étroit : les organisations RATTACHÉES au projet, pour les
-- MEMBRES du projet seulement. Elle ne révèle que le lien
-- « ce compte appartient à cette organisation » — un fait que l'écran
-- des partenaires laisse déjà deviner — jamais les rôles internes.

create or replace function public.project_org_members(pid uuid)
returns table (org_id uuid, org_name text, user_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select po.org_id, o.name as org_name, m.user_id
    from public.project_organizations po
    join public.organizations o on o.id = po.org_id
    join public.memberships m on m.org_id = po.org_id
   where po.project_id = pid
     and public.is_project_member(pid)
$$;

-- ------------------------------------------------------------
-- Contrôle
-- ------------------------------------------------------------
--   select org_name, count(*) from project_org_members('<un id de projet>')
--    group by org_name order by org_name;
