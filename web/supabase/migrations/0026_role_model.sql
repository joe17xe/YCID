-- ============================================================
-- MIGRATION 0026 — Modèle de rôles : expert et référent Mairie
-- ============================================================
-- Décision produit du 25/07/2026 :
--  · un chef de projet est rattaché à une organisation « expert » et
--    peut intervenir sur PLUSIEURS projets, y compris de communes
--    différentes — déjà possible, les rôles étant portés par projet ;
--  · une commune ne voit QUE ses projets — déjà garanti par
--    is_project_member(), qui accorde la visibilité aux membres d'une
--    organisation rattachée au projet (memberships → project_organizations) ;
--  · le référent d'une commune est un rôle DISTINCT du chef de projet :
--    sans cette distinction, la règle « chef de projet = organisation
--    expert » contredisait le cas d'un agent municipal pilotant le
--    projet de sa propre commune.
--
-- YCID / Département des Yvelines conserve la vision de l'ensemble des
-- projets via is_admin() / is_lead_org_admin() (inchangé).

-- 1. Type d'organisation « expert » (cabinets, experts indépendants)
alter type org_type add value if not exists 'expert';

-- 2. Rôle projet « référent Mairie » (agent de la collectivité porteuse)
alter type project_member_role add value if not exists 'referent_mairie';

-- 3. Durcissement : is_project_member() est SECURITY DEFINER sans
--    search_path figé — même faiblesse que celle corrigée en 0022 pour
--    les triggers. La logique est inchangée (membre du projet OU membre
--    d'une organisation rattachée au projet).
create or replace function public.is_project_member(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = pid and user_id = auth.uid()
  ) or exists (
    select 1 from public.project_organizations po
    join public.memberships m on m.org_id = po.org_id
    where po.project_id = pid and m.user_id = auth.uid()
  );
$$;
